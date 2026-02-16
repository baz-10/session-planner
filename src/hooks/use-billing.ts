'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type {
  BillingInstallment,
  BillingInvoice,
  BillingInvoiceRecipient,
  BillingPayment,
  BillingRecipientInstallment,
  BillingReminder,
  CreateBillingInvoiceInput,
  InvoiceStatus,
  Profile,
  TeamRole,
} from '@/types/database';

interface InvoiceRecipientWithUser extends BillingInvoiceRecipient {
  user?: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
}

interface InvoicePaymentWithUser extends BillingPayment {
  user?: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
}

interface RecipientInstallmentWithUser extends BillingRecipientInstallment {
  user?: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
}

interface InstallmentWithRecipients extends BillingInstallment {
  recipient_installments: RecipientInstallmentWithUser[];
}

interface BillingReminderWithRelations extends BillingReminder {
  invoice?: Pick<BillingInvoice, 'id' | 'title'> | null;
  recipient_installment?: Pick<
    BillingRecipientInstallment,
    'id' | 'due_date' | 'amount_cents' | 'status'
  > | null;
}

export interface InvoiceWithDetails extends BillingInvoice {
  recipients: InvoiceRecipientWithUser[];
  payments: InvoicePaymentWithUser[];
  installments: InstallmentWithRecipients[];
}

export interface BillableMember {
  userId: string;
  role: TeamRole;
  fullName: string;
  email: string;
}

export interface ReminderNudge {
  id: string;
  type: 'upcoming' | 'overdue';
  message: string;
  sentAt: string;
  isRead: boolean;
  invoiceId: string;
  invoiceTitle: string;
  installmentId: string | null;
  dueDate: string | null;
  amountCents: number | null;
}

interface CheckoutSessionResult {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}

interface VerifySessionResult {
  success: boolean;
  status?: 'paid' | 'pending' | 'expired';
  invoiceId?: string;
  error?: string;
}

interface RunReminderResult {
  success: boolean;
  processed?: number;
  created?: number;
  overdueMarked?: number;
  error?: string;
}

export function useBilling() {
  const { user, currentTeam, teamMemberships } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);

  const currentMembership = teamMemberships.find((membership) => membership.team.id === currentTeam?.id);
  const canManageBilling =
    currentMembership?.role === 'admin' || currentMembership?.role === 'coach';

  const getInvoices = useCallback(
    async (options?: { status?: InvoiceStatus | 'all' }): Promise<InvoiceWithDetails[]> => {
      if (!currentTeam) {
        return [];
      }

      let query = supabase
        .from('billing_invoices')
        .select(`
          *,
          recipients:billing_invoice_recipients(*, user:profiles(id, full_name, email)),
          payments:billing_payments(*, user:profiles(id, full_name, email)),
          installments:billing_installments(
            *,
            recipient_installments:billing_recipient_installments(*, user:profiles(id, full_name, email))
          )
        `)
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false });

      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading billing invoices:', error);
        return [];
      }

      return ((data || []) as InvoiceWithDetails[]).map((invoice) => ({
        ...invoice,
        installments: (invoice.installments || []).sort(
          (a, b) => a.installment_number - b.installment_number
        ),
      }));
    },
    [supabase, currentTeam]
  );

  const getBillableMembers = useCallback(async (): Promise<BillableMember[]> => {
    if (!currentTeam) {
      return [];
    }

    const { data, error } = await supabase
      .from('team_members')
      .select(`
        role,
        user_id,
        profile:profiles(id, full_name, email)
      `)
      .eq('team_id', currentTeam.id)
      .in('role', ['player', 'parent']);

    if (error) {
      console.error('Error loading billable members:', error);
      return [];
    }

    const uniqueMembers = new Map<string, BillableMember>();
    (data || []).forEach((row: any) => {
      const profile = row.profile;
      const userId = row.user_id as string;
      if (!profile || !userId || uniqueMembers.has(userId)) {
        return;
      }

      uniqueMembers.set(userId, {
        userId,
        role: row.role,
        fullName: profile.full_name || profile.email || 'Unknown User',
        email: profile.email || 'No email',
      });
    });

    return Array.from(uniqueMembers.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    );
  }, [supabase, currentTeam]);

  const createInvoice = useCallback(
    async (
      input: CreateBillingInvoiceInput
    ): Promise<{ success: boolean; invoice?: BillingInvoice; error?: string }> => {
      if (!user || !currentTeam) {
        return { success: false, error: 'Not authenticated or no team selected' };
      }

      if (!canManageBilling) {
        return { success: false, error: 'Only coaches/admins can create invoices' };
      }

      if (!input.recipient_user_ids || input.recipient_user_ids.length === 0) {
        return { success: false, error: 'Please select at least one recipient' };
      }

      setIsLoading(true);

      try {
        const installmentCount = clampInt(input.installment_count ?? 1, 1, 12);
        const installmentFrequencyDays = clampInt(input.installment_frequency_days ?? 30, 1, 90);
        const firstInstallmentDueDate =
          input.first_installment_due_date ||
          input.due_date ||
          addDaysToDateIso(getTodayDateIso(), installmentFrequencyDays);

        const { data: invoice, error: invoiceError } = await supabase
          .from('billing_invoices')
          .insert({
            team_id: currentTeam.id,
            title: input.title,
            description: input.description || null,
            amount_cents: input.amount_cents,
            currency: (input.currency || 'usd').toLowerCase(),
            due_date: input.due_date || null,
            status: 'open',
            allow_partial: Boolean(input.allow_partial),
            installment_plan_count: installmentCount,
            installment_frequency_days: installmentFrequencyDays,
            created_by: user.id,
          })
          .select()
          .single();

        if (invoiceError || !invoice) {
          console.error('Error creating invoice:', invoiceError);
          return { success: false, error: 'Failed to create invoice' };
        }

        const recipientRows = input.recipient_user_ids.map((recipientUserId) => ({
          invoice_id: invoice.id,
          user_id: recipientUserId,
        }));

        const { error: recipientsError } = await supabase
          .from('billing_invoice_recipients')
          .insert(recipientRows);

        if (recipientsError) {
          console.error('Error assigning invoice recipients:', recipientsError);
          return {
            success: false,
            error: 'Invoice created, but assigning recipients failed.',
          };
        }

        const installmentDueDates = buildInstallmentDueDates(
          firstInstallmentDueDate,
          installmentCount,
          installmentFrequencyDays
        );

        const installmentRows = installmentDueDates.map((dueDate, index) => ({
          invoice_id: invoice.id,
          installment_number: index + 1,
          due_date: dueDate,
        }));

        const { data: installments, error: installmentError } = await supabase
          .from('billing_installments')
          .insert(installmentRows)
          .select('*');

        if (installmentError || !installments || installments.length === 0) {
          console.error('Error creating installment schedule:', installmentError);
          return {
            success: false,
            error: 'Invoice created, but installment schedule setup failed.',
          };
        }

        const sortedInstallments = [...installments].sort(
          (a, b) => a.installment_number - b.installment_number
        ) as BillingInstallment[];

        const installmentAmounts = splitEvenly(input.amount_cents, installmentCount);

        const recipientInstallmentRows: Array<{
          invoice_id: string;
          installment_id: string;
          user_id: string;
          due_date: string;
          amount_cents: number;
          status: 'scheduled';
        }> = [];

        input.recipient_user_ids.forEach((recipientUserId) => {
          sortedInstallments.forEach((installment, index) => {
            recipientInstallmentRows.push({
              invoice_id: invoice.id,
              installment_id: installment.id,
              user_id: recipientUserId,
              due_date: installment.due_date,
              amount_cents: installmentAmounts[index],
              status: 'scheduled',
            });
          });
        });

        const { error: recipientInstallmentError } = await supabase
          .from('billing_recipient_installments')
          .insert(recipientInstallmentRows);

        if (recipientInstallmentError) {
          console.error('Error creating recipient installment rows:', recipientInstallmentError);
          return {
            success: false,
            error: 'Invoice created, but recipient installment setup failed.',
          };
        }

        return { success: true, invoice: invoice as BillingInvoice };
      } finally {
        setIsLoading(false);
      }
    },
    [user, currentTeam, canManageBilling, supabase]
  );

  const createCheckoutSession = useCallback(
    async (
      invoiceId: string,
      recipientInstallmentId?: string
    ): Promise<CheckoutSessionResult> => {
      if (!invoiceId) {
        return { success: false, error: 'Invoice ID is required' };
      }

      try {
        const response = await fetch('/api/billing/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoiceId, recipientInstallmentId }),
        });

        const result = (await response.json()) as CheckoutSessionResult;

        if (!response.ok || !result.success) {
          return { success: false, error: result.error || 'Unable to start checkout.' };
        }

        return result;
      } catch (error) {
        console.error('Checkout session creation failed:', error);
        return { success: false, error: 'Unable to connect to billing service.' };
      }
    },
    []
  );

  const verifyCheckoutSession = useCallback(
    async (sessionId: string): Promise<VerifySessionResult> => {
      if (!sessionId) {
        return { success: false, error: 'Session ID is required' };
      }

      try {
        const response = await fetch('/api/billing/verify-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        const result = (await response.json()) as VerifySessionResult;

        if (!response.ok || !result.success) {
          return { success: false, error: result.error || 'Unable to verify payment session.' };
        }

        return result;
      } catch (error) {
        console.error('Checkout session verification failed:', error);
        return { success: false, error: 'Unable to verify payment status right now.' };
      }
    },
    []
  );

  const runReminderNudges = useCallback(
    async (teamId: string): Promise<RunReminderResult> => {
      try {
        const response = await fetch('/api/billing/run-reminders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ teamId }),
        });

        const result = (await response.json()) as RunReminderResult;

        if (!response.ok || !result.success) {
          return {
            success: false,
            error: result.error || 'Unable to run reminder nudges.',
          };
        }

        return result;
      } catch (error) {
        console.error('Run reminders failed:', error);
        return {
          success: false,
          error: 'Unable to run reminder nudges right now.',
        };
      }
    },
    []
  );

  const getMyReminders = useCallback(
    async (options?: { unreadOnly?: boolean; limit?: number }): Promise<ReminderNudge[]> => {
      if (!user) {
        return [];
      }

      const limit = options?.limit ?? 20;

      let query = supabase
        .from('billing_reminders')
        .select(`
          *,
          invoice:billing_invoices(id, title),
          recipient_installment:billing_recipient_installments(id, due_date, amount_cents, status)
        `)
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (options?.unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error loading reminders:', error);
        return [];
      }

      return ((data || []) as BillingReminderWithRelations[]).map((row) => ({
        id: row.id,
        type: row.reminder_type,
        message: row.message,
        sentAt: row.sent_at,
        isRead: row.is_read,
        invoiceId: row.invoice_id,
        invoiceTitle: row.invoice?.title || 'Invoice',
        installmentId: row.recipient_installment_id,
        dueDate: row.recipient_installment?.due_date || null,
        amountCents: row.recipient_installment?.amount_cents || null,
      }));
    },
    [supabase, user]
  );

  const markReminderRead = useCallback(
    async (reminderId: string): Promise<{ success: boolean; error?: string }> => {
      if (!reminderId) {
        return { success: false, error: 'Reminder ID is required' };
      }

      const { error } = await supabase
        .from('billing_reminders')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', reminderId);

      if (error) {
        console.error('Error marking reminder as read:', error);
        return { success: false, error: 'Failed to update reminder.' };
      }

      return { success: true };
    },
    [supabase]
  );

  return {
    isLoading,
    canManageBilling,
    getInvoices,
    getBillableMembers,
    createInvoice,
    createCheckoutSession,
    verifyCheckoutSession,
    runReminderNudges,
    getMyReminders,
    markReminderRead,
  };
}

function clampInt(value: number, min: number, max: number): number {
  const safe = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, safe));
}

function splitEvenly(total: number, count: number): number[] {
  const safeCount = Math.max(1, count);
  const base = Math.floor(total / safeCount);
  const remainder = total - base * safeCount;
  return Array.from({ length: safeCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function getTodayDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToDateIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildInstallmentDueDates(
  firstDueDate: string,
  count: number,
  frequencyDays: number
): string[] {
  return Array.from({ length: count }, (_, index) =>
    addDaysToDateIso(firstDueDate, index * frequencyDays)
  );
}
