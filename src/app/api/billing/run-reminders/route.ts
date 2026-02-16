import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';
import { createAdminClient } from '@/lib/database/supabase';

const DEFAULT_DAYS_AHEAD = 2;

export async function GET(request: NextRequest) {
  return runReminders(request, { allowBody: false });
}

export async function POST(request: NextRequest) {
  return runReminders(request, { allowBody: true });
}

async function runReminders(
  request: NextRequest,
  options: { allowBody: boolean }
) {
  try {
    const payload = options.allowBody
      ? ((await request.json().catch(() => ({}))) as {
          teamId?: string;
          daysAhead?: number;
        })
      : ({} as { teamId?: string; daysAhead?: number });

    const teamId = payload.teamId;
    const daysAhead = clampInt(payload.daysAhead ?? DEFAULT_DAYS_AHEAD, 0, 14);

    const cronSecret = process.env.BILLING_REMINDER_CRON_SECRET;
    const providedSecret = request.headers.get('x-billing-cron-secret');
    const isCronRequest = Boolean(cronSecret && providedSecret === cronSecret);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabase: any;
    let sentBy: string | null = null;
    let scopedTeamIds: string[] = [];

    if (isCronRequest) {
      supabase = createAdminClient();
      if (teamId) {
        scopedTeamIds = [teamId];
      } else {
        const { data: invoiceTeams, error: teamsError } = await supabase
          .from('billing_invoices')
          .select('team_id')
          .in('status', ['open', 'partially_paid']);

        if (teamsError) {
          return NextResponse.json(
            { success: false, error: 'Failed to discover teams for reminder run.' },
            { status: 500 }
          );
        }

        scopedTeamIds = Array.from(
          new Set((invoiceTeams || []).map((row: { team_id: string }) => row.team_id))
        );
      }
    } else {
      if (!teamId) {
        return NextResponse.json(
          { success: false, error: 'teamId is required for manual reminder runs.' },
          { status: 400 }
        );
      }

      supabase = await createServerSupabaseClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const { data: membership, error: membershipError } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (
        membershipError ||
        !membership ||
        (membership.role !== 'admin' && membership.role !== 'coach')
      ) {
        return NextResponse.json(
          { success: false, error: 'Only coaches/admins can run reminder nudges.' },
          { status: 403 }
        );
      }

      sentBy = user.id;
      scopedTeamIds = [teamId];
    }

    if (scopedTeamIds.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        created: 0,
        overdueMarked: 0,
      });
    }

    const today = getTodayDateIso();
    const cutoff = addDaysToDateIso(today, daysAhead);

    const { data: invoices, error: invoicesError } = await supabase
      .from('billing_invoices')
      .select('id, team_id, title, status')
      .in('team_id', scopedTeamIds)
      .in('status', ['open', 'partially_paid']);

    if (invoicesError) {
      return NextResponse.json(
        { success: false, error: 'Failed to load invoices for reminders.' },
        { status: 500 }
      );
    }

    const invoiceRows = (invoices || []) as Array<{
      id: string;
      team_id: string;
      title: string;
      status: string;
    }>;

    if (invoiceRows.length === 0) {
      return NextResponse.json({ success: true, processed: 0, created: 0, overdueMarked: 0 });
    }

    const invoiceIds = invoiceRows.map((invoice) => invoice.id);
    const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));

    const { data: overdueCandidates, error: overdueCandidateError } = await supabase
      .from('billing_recipient_installments')
      .select('id')
      .in('invoice_id', invoiceIds)
      .eq('status', 'scheduled')
      .lt('due_date', today);

    if (overdueCandidateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to compute overdue installment statuses.' },
        { status: 500 }
      );
    }

    const overdueMarked = (overdueCandidates || []).length;

    if (overdueMarked > 0) {
      const { error: markOverdueError } = await supabase
        .from('billing_recipient_installments')
        .update({ status: 'overdue' })
        .in('id', (overdueCandidates || []).map((row: { id: string }) => row.id));

      if (markOverdueError) {
        return NextResponse.json(
          { success: false, error: 'Failed to mark overdue installments.' },
          { status: 500 }
        );
      }
    }

    const { data: dueInstallments, error: dueInstallmentsError } = await supabase
      .from('billing_recipient_installments')
      .select('id, invoice_id, user_id, amount_cents, status, due_date')
      .in('invoice_id', invoiceIds)
      .in('status', ['scheduled', 'overdue'])
      .lte('due_date', cutoff);

    if (dueInstallmentsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to load due installments for reminders.' },
        { status: 500 }
      );
    }

    const dueRows = (dueInstallments || []) as Array<{
      id: string;
      invoice_id: string;
      user_id: string;
      amount_cents: number;
      status: 'scheduled' | 'overdue';
      due_date: string;
    }>;

    if (dueRows.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        created: 0,
        overdueMarked,
      });
    }

    const dueInstallmentIds = dueRows.map((row) => row.id);

    const { data: existingToday, error: existingTodayError } = await supabase
      .from('billing_reminders')
      .select('recipient_installment_id, reminder_type')
      .in('recipient_installment_id', dueInstallmentIds)
      .eq('sent_on', today);

    if (existingTodayError) {
      return NextResponse.json(
        { success: false, error: 'Failed to load existing reminders.' },
        { status: 500 }
      );
    }

    const existingKeys = new Set(
      (existingToday || []).map(
        (row: { recipient_installment_id: string; reminder_type: 'upcoming' | 'overdue' }) =>
          `${row.recipient_installment_id}:${row.reminder_type}`
      )
    );

    const remindersToInsert = dueRows
      .map((row) => {
        const invoice = invoiceById.get(row.invoice_id);
        if (!invoice) {
          return null;
        }

        const reminderType = row.due_date < today ? 'overdue' : 'upcoming';
        const dedupeKey = `${row.id}:${reminderType}`;
        if (existingKeys.has(dedupeKey)) {
          return null;
        }

        return {
          team_id: invoice.team_id,
          invoice_id: row.invoice_id,
          recipient_installment_id: row.id,
          user_id: row.user_id,
          reminder_type: reminderType,
          message: buildReminderMessage({
            invoiceTitle: invoice.title,
            amountCents: row.amount_cents,
            dueDate: row.due_date,
            reminderType,
          }),
          sent_by: sentBy,
          sent_on: today,
        };
      })
      .filter(Boolean) as Array<{
      team_id: string;
      invoice_id: string;
      recipient_installment_id: string;
      user_id: string;
      reminder_type: 'upcoming' | 'overdue';
      message: string;
      sent_by: string | null;
      sent_on: string;
    }>;

    if (remindersToInsert.length > 0) {
      const { error: insertReminderError } = await supabase
        .from('billing_reminders')
        .insert(remindersToInsert);

      if (insertReminderError) {
        return NextResponse.json(
          { success: false, error: 'Failed to create reminder nudges.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      processed: dueRows.length,
      created: remindersToInsert.length,
      overdueMarked,
    });
  } catch (error) {
    console.error('Run billing reminders error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildReminderMessage(params: {
  invoiceTitle: string;
  amountCents: number;
  dueDate: string;
  reminderType: 'upcoming' | 'overdue';
}): string {
  const amountText = formatCentsAsUsd(params.amountCents);
  const dueDateText = params.dueDate;

  if (params.reminderType === 'overdue') {
    return `${params.invoiceTitle} installment (${amountText}) is overdue since ${dueDateText}. Open Billing to complete payment.`;
  }

  return `${params.invoiceTitle} installment (${amountText}) is due on ${dueDateText}. Open Billing to complete payment.`;
}

function formatCentsAsUsd(amountCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountCents / 100);
}

function getTodayDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToDateIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, rounded));
}
