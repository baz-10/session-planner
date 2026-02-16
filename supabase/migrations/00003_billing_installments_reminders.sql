-- Installment plans + reminder nudges

-- ==========================================================================
-- ENUMS
-- ==========================================================================

CREATE TYPE billing_installment_status AS ENUM ('scheduled', 'paid', 'overdue', 'void');
CREATE TYPE billing_reminder_type AS ENUM ('upcoming', 'overdue');

-- ==========================================================================
-- ALTER: billing_invoices
-- ==========================================================================

ALTER TABLE billing_invoices
  ADD COLUMN installment_plan_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN installment_frequency_days INTEGER NOT NULL DEFAULT 30,
  ADD CONSTRAINT billing_invoices_installment_plan_count_check CHECK (installment_plan_count >= 1 AND installment_plan_count <= 12),
  ADD CONSTRAINT billing_invoices_installment_frequency_days_check CHECK (installment_frequency_days >= 1 AND installment_frequency_days <= 90);

-- ==========================================================================
-- TABLE: billing_installments
-- ==========================================================================

CREATE TABLE billing_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(invoice_id, installment_number),
  CHECK (installment_number > 0)
);

CREATE INDEX idx_billing_installments_invoice_id ON billing_installments(invoice_id);
CREATE INDEX idx_billing_installments_due_date ON billing_installments(due_date);

-- ==========================================================================
-- TABLE: billing_recipient_installments
-- ==========================================================================

CREATE TABLE billing_recipient_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  installment_id UUID NOT NULL REFERENCES billing_installments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status billing_installment_status NOT NULL DEFAULT 'scheduled',
  paid_payment_id UUID REFERENCES billing_payments(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(installment_id, user_id)
);

CREATE TRIGGER update_billing_recipient_installments_updated_at
  BEFORE UPDATE ON billing_recipient_installments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_billing_recipient_installments_invoice_id ON billing_recipient_installments(invoice_id);
CREATE INDEX idx_billing_recipient_installments_user_id ON billing_recipient_installments(user_id);
CREATE INDEX idx_billing_recipient_installments_status ON billing_recipient_installments(status);
CREATE INDEX idx_billing_recipient_installments_due_date ON billing_recipient_installments(due_date);

-- ==========================================================================
-- TABLE: billing_reminders
-- ==========================================================================

CREATE TABLE billing_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  recipient_installment_id UUID REFERENCES billing_recipient_installments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_type billing_reminder_type NOT NULL,
  message TEXT NOT NULL,
  sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  sent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  UNIQUE(user_id, recipient_installment_id, reminder_type, sent_on)
);

CREATE INDEX idx_billing_reminders_user_id ON billing_reminders(user_id);
CREATE INDEX idx_billing_reminders_team_id ON billing_reminders(team_id);
CREATE INDEX idx_billing_reminders_sent_on ON billing_reminders(sent_on);
CREATE INDEX idx_billing_reminders_is_read ON billing_reminders(is_read);

-- ==========================================================================
-- RLS
-- ==========================================================================

ALTER TABLE billing_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_recipient_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients and coaches can view invoice installments"
  ON billing_installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM billing_invoices bi
      WHERE bi.id = billing_installments.invoice_id
        AND (
          is_team_admin_or_coach(bi.team_id)
          OR EXISTS (
            SELECT 1
            FROM billing_recipient_installments bri
            WHERE bri.installment_id = billing_installments.id
              AND bri.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Coaches can manage invoice installments"
  ON billing_installments FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM billing_invoices bi
      WHERE bi.id = billing_installments.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM billing_invoices bi
      WHERE bi.id = billing_installments.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );

CREATE POLICY "Recipients and coaches can view recipient installments"
  ON billing_recipient_installments FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM billing_invoices bi
      WHERE bi.id = billing_recipient_installments.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );

CREATE POLICY "Coaches can manage recipient installments"
  ON billing_recipient_installments FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM billing_invoices bi
      WHERE bi.id = billing_recipient_installments.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM billing_invoices bi
      WHERE bi.id = billing_recipient_installments.invoice_id
        AND is_team_admin_or_coach(bi.team_id)
    )
  );

CREATE POLICY "Recipients and coaches can view reminders"
  ON billing_reminders FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_team_admin_or_coach(team_id)
  );

CREATE POLICY "Coaches can create reminders"
  ON billing_reminders FOR INSERT
  WITH CHECK (
    is_team_admin_or_coach(team_id)
    AND (
      sent_by IS NULL OR sent_by = auth.uid()
    )
  );

CREATE POLICY "Recipients can mark reminders as read"
  ON billing_reminders FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Coaches can delete reminders"
  ON billing_reminders FOR DELETE
  USING (is_team_admin_or_coach(team_id));
