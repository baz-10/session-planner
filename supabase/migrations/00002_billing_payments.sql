-- Billing + Payments MVP schema

-- ==========================================================================
-- ENUMS
-- ==========================================================================

CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'partially_paid', 'paid', 'void');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'expired');

-- ==========================================================================
-- TABLE: billing_invoices
-- ==========================================================================

CREATE TABLE billing_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  due_date DATE,
  status invoice_status NOT NULL DEFAULT 'open',
  allow_partial BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_billing_invoices_updated_at
  BEFORE UPDATE ON billing_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_billing_invoices_team_id ON billing_invoices(team_id);
CREATE INDEX idx_billing_invoices_status ON billing_invoices(status);
CREATE INDEX idx_billing_invoices_due_date ON billing_invoices(due_date);

-- ==========================================================================
-- TABLE: billing_invoice_recipients
-- ==========================================================================

CREATE TABLE billing_invoice_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_override_cents INTEGER CHECK (amount_override_cents IS NULL OR amount_override_cents > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(invoice_id, user_id)
);

CREATE INDEX idx_billing_invoice_recipients_invoice_id ON billing_invoice_recipients(invoice_id);
CREATE INDEX idx_billing_invoice_recipients_user_id ON billing_invoice_recipients(user_id);

-- ==========================================================================
-- TABLE: billing_payments
-- ==========================================================================

CREATE TABLE billing_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status payment_status NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_checkout_session_id TEXT UNIQUE,
  provider_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_billing_payments_updated_at
  BEFORE UPDATE ON billing_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_billing_payments_invoice_id ON billing_payments(invoice_id);
CREATE INDEX idx_billing_payments_user_id ON billing_payments(user_id);
CREATE INDEX idx_billing_payments_status ON billing_payments(status);
CREATE INDEX idx_billing_payments_checkout_session ON billing_payments(provider_checkout_session_id);

-- ==========================================================================
-- FUNCTIONS: Invoice status rollup
-- ==========================================================================

CREATE OR REPLACE FUNCTION refresh_invoice_status(invoice_uuid UUID)
RETURNS VOID AS $$
DECLARE
  invoice_total INTEGER := 0;
  total_paid INTEGER := 0;
  current_status invoice_status;
BEGIN
  SELECT amount_cents, status
  INTO invoice_total, current_status
  FROM billing_invoices
  WHERE id = invoice_uuid;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF current_status = 'void' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0)
  INTO total_paid
  FROM billing_payments
  WHERE invoice_id = invoice_uuid
    AND status = 'paid';

  UPDATE billing_invoices
  SET status = CASE
    WHEN total_paid <= 0 THEN 'open'::invoice_status
    WHEN total_paid < invoice_total THEN 'partially_paid'::invoice_status
    ELSE 'paid'::invoice_status
  END
  WHERE id = invoice_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_billing_payment_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_invoice_status(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_billing_payment_change
  AFTER INSERT OR UPDATE OR DELETE ON billing_payments
  FOR EACH ROW EXECUTE FUNCTION handle_billing_payment_change();

-- ==========================================================================
-- RLS
-- ==========================================================================

ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoice_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members and recipients can view invoices"
  ON billing_invoices FOR SELECT
  USING (
    is_team_member(team_id) OR
    EXISTS (
      SELECT 1 FROM billing_invoice_recipients bir
      WHERE bir.invoice_id = billing_invoices.id
        AND bir.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can create invoices"
  ON billing_invoices FOR INSERT
  WITH CHECK (
    is_team_admin_or_coach(team_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Coaches can update invoices"
  ON billing_invoices FOR UPDATE
  USING (is_team_admin_or_coach(team_id));

CREATE POLICY "Coaches can delete invoices"
  ON billing_invoices FOR DELETE
  USING (is_team_admin_or_coach(team_id));

CREATE POLICY "Recipients can view their assignments"
  ON billing_invoice_recipients FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM billing_invoices bi
      WHERE bi.id = billing_invoice_recipients.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );

CREATE POLICY "Coaches can create recipient assignments"
  ON billing_invoice_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM billing_invoices bi
      WHERE bi.id = billing_invoice_recipients.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );

CREATE POLICY "Coaches can update recipient assignments"
  ON billing_invoice_recipients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM billing_invoices bi
      WHERE bi.id = billing_invoice_recipients.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );

CREATE POLICY "Coaches can delete recipient assignments"
  ON billing_invoice_recipients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM billing_invoices bi
      WHERE bi.id = billing_invoice_recipients.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );

CREATE POLICY "Users can view own payments and coaches can view team payments"
  ON billing_payments FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM billing_invoices bi
      WHERE bi.id = billing_payments.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );

CREATE POLICY "Recipients can create their own payments"
  ON billing_payments FOR INSERT
  WITH CHECK (
    (
      user_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM billing_invoice_recipients bir
        WHERE bir.invoice_id = billing_payments.invoice_id
          AND bir.user_id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM billing_invoices bi
      WHERE bi.id = billing_payments.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );

CREATE POLICY "Users can update own payments and coaches can manage team payments"
  ON billing_payments FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM billing_invoices bi
      WHERE bi.id = billing_payments.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM billing_invoices bi
      WHERE bi.id = billing_payments.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );

CREATE POLICY "Coaches can delete team payments"
  ON billing_payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM billing_invoices bi
      WHERE bi.id = billing_payments.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );
