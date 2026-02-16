'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import {
  useBilling,
  type BillableMember,
  type InvoiceWithDetails,
  type ReminderNudge,
} from '@/hooks/use-billing';
import type { InvoiceStatus } from '@/types/database';

interface InvoiceFormState {
  title: string;
  description: string;
  amountDollars: string;
  dueDate: string;
  allowPartial: boolean;
  useInstallments: boolean;
  installmentCount: string;
  installmentFrequencyDays: string;
  firstInstallmentDueDate: string;
  recipientUserIds: string[];
}

const defaultInvoiceForm: InvoiceFormState = {
  title: '',
  description: '',
  amountDollars: '',
  dueDate: '',
  allowPartial: false,
  useInstallments: false,
  installmentCount: '3',
  installmentFrequencyDays: '30',
  firstInstallmentDueDate: '',
  recipientUserIds: [],
};

export function BillingDashboard() {
  const { user, currentTeam } = useAuth();
  const {
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
  } = useBilling();

  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutState = searchParams.get('checkout');
  const checkoutSessionId = searchParams.get('session_id');

  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [members, setMembers] = useState<BillableMember[]>([]);
  const [reminders, setReminders] = useState<ReminderNudge[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPayingKey, setIsPayingKey] = useState<string | null>(null);
  const [isRunningReminders, setIsRunningReminders] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>(defaultInvoiceForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const processedSessionId = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentTeam) {
      setInvoices([]);
      setMembers([]);
      setReminders([]);
      return;
    }

    setIsRefreshing(true);

    const [invoiceData, memberData, reminderData] = await Promise.all([
      getInvoices({ status: statusFilter }),
      canManageBilling ? getBillableMembers() : Promise.resolve([]),
      getMyReminders({ unreadOnly: false, limit: 20 }),
    ]);

    setInvoices(invoiceData);
    setMembers(memberData);
    setReminders(reminderData);
    setIsRefreshing(false);
  }, [
    canManageBilling,
    currentTeam,
    getBillableMembers,
    getInvoices,
    getMyReminders,
    statusFilter,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleCheckoutResult = async () => {
      if (checkoutState !== 'success' || !checkoutSessionId) {
        if (checkoutState === 'cancel') {
          setBanner({ type: 'error', text: 'Checkout was cancelled. No payment was recorded.' });
          router.replace('/dashboard/billing');
        }
        return;
      }

      if (processedSessionId.current === checkoutSessionId) {
        return;
      }

      processedSessionId.current = checkoutSessionId;
      const verifyResult = await verifyCheckoutSession(checkoutSessionId);

      if (verifyResult.success && verifyResult.status === 'paid') {
        setBanner({ type: 'success', text: 'Payment received. Invoice status has been updated.' });
        await loadData();
      } else if (verifyResult.success) {
        setBanner({ type: 'error', text: 'Payment is still pending. Please refresh in a moment.' });
      } else {
        setBanner({ type: 'error', text: verifyResult.error || 'Unable to verify checkout session.' });
      }

      router.replace('/dashboard/billing');
    };

    handleCheckoutResult();
  }, [checkoutSessionId, checkoutState, router, verifyCheckoutSession, loadData]);

  const financialSummary = useMemo(() => {
    const expected = invoices.reduce((sum, invoice) => sum + getExpectedInvoiceTotal(invoice), 0);
    const paid = invoices.reduce((sum, invoice) => sum + getPaidInvoiceTotal(invoice), 0);
    const outstanding = Math.max(0, expected - paid);
    const openInvoices = invoices.filter((invoice) => invoice.status !== 'paid' && invoice.status !== 'void').length;

    return { expected, paid, outstanding, openInvoices };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'all') {
      return invoices;
    }
    return invoices.filter((invoice) => invoice.status === statusFilter);
  }, [invoices, statusFilter]);

  const unreadReminders = reminders.filter((reminder) => !reminder.isRead);

  const handleRecipientToggle = (userId: string) => {
    setInvoiceForm((prev) => {
      const exists = prev.recipientUserIds.includes(userId);
      return {
        ...prev,
        recipientUserIds: exists
          ? prev.recipientUserIds.filter((id) => id !== userId)
          : [...prev.recipientUserIds, userId],
      };
    });
  };

  const selectAllRecipients = () => {
    setInvoiceForm((prev) => ({
      ...prev,
      recipientUserIds: members.map((member) => member.userId),
    }));
  };

  const clearRecipients = () => {
    setInvoiceForm((prev) => ({ ...prev, recipientUserIds: [] }));
  };

  const resetCreateForm = () => {
    setInvoiceForm(defaultInvoiceForm);
    setFormError(null);
  };

  const handleCreateInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsedAmount = Math.round(Number(invoiceForm.amountDollars) * 100);
    if (!invoiceForm.title.trim()) {
      setFormError('Invoice title is required.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Enter a valid amount greater than $0.');
      return;
    }
    if (invoiceForm.recipientUserIds.length === 0) {
      setFormError('Select at least one recipient.');
      return;
    }

    const installmentCount = invoiceForm.useInstallments
      ? clampInt(Number(invoiceForm.installmentCount), 2, 12)
      : 1;

    if (invoiceForm.useInstallments && !invoiceForm.firstInstallmentDueDate) {
      setFormError('Choose the first installment due date.');
      return;
    }

    const result = await createInvoice({
      team_id: currentTeam?.id || '',
      title: invoiceForm.title.trim(),
      description: invoiceForm.description.trim() || undefined,
      amount_cents: parsedAmount,
      due_date: invoiceForm.dueDate || undefined,
      allow_partial: invoiceForm.allowPartial || invoiceForm.useInstallments,
      currency: 'usd',
      installment_count: installmentCount,
      installment_frequency_days: invoiceForm.useInstallments
        ? clampInt(Number(invoiceForm.installmentFrequencyDays), 1, 90)
        : undefined,
      first_installment_due_date: invoiceForm.useInstallments
        ? invoiceForm.firstInstallmentDueDate
        : undefined,
      recipient_user_ids: invoiceForm.recipientUserIds,
    });

    if (!result.success) {
      setFormError(result.error || 'Unable to create invoice.');
      return;
    }

    setShowCreateModal(false);
    resetCreateForm();
    setBanner({ type: 'success', text: 'Invoice created successfully.' });
    await loadData();
  };

  const handlePayInvoice = async (
    invoiceId: string,
    recipientInstallmentId?: string,
    amountLabel?: string
  ) => {
    const payingKey = recipientInstallmentId || invoiceId;
    setIsPayingKey(payingKey);
    const result = await createCheckoutSession(invoiceId, recipientInstallmentId);
    setIsPayingKey(null);

    if (!result.success || !result.checkoutUrl) {
      setBanner({ type: 'error', text: result.error || 'Unable to start checkout.' });
      return;
    }

    if (amountLabel) {
      setBanner({ type: 'success', text: `Redirecting to checkout for ${amountLabel}...` });
    }

    window.location.href = result.checkoutUrl;
  };

  const handleRunReminders = async () => {
    if (!currentTeam) {
      return;
    }

    setIsRunningReminders(true);
    const result = await runReminderNudges(currentTeam.id);
    setIsRunningReminders(false);

    if (!result.success) {
      setBanner({ type: 'error', text: result.error || 'Failed to run reminder nudges.' });
      return;
    }

    setBanner({
      type: 'success',
      text: `Reminder run complete. ${result.created || 0} nudges created, ${result.overdueMarked || 0} installments marked overdue.`,
    });

    await loadData();
  };

  const handleMarkReminderRead = async (reminderId: string) => {
    const result = await markReminderRead(reminderId);
    if (!result.success) {
      setBanner({ type: 'error', text: result.error || 'Failed to mark reminder as read.' });
      return;
    }

    setReminders((prev) =>
      prev.map((reminder) =>
        reminder.id === reminderId ? { ...reminder, isRead: true } : reminder
      )
    );
  };

  if (!currentTeam) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
        Select a team to manage billing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            banner.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {banner.text}
        </div>
      )}

      {reminders.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Payment Nudges</h2>
              <p className="text-sm text-gray-600">Automated reminders for upcoming and overdue installments.</p>
            </div>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
              {unreadReminders.length} unread
            </span>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-auto">
            {reminders.map((reminder) => (
              <div key={reminder.id} className={`px-5 py-3 ${reminder.isRead ? 'bg-gray-50' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-800">{reminder.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {reminder.type === 'overdue' ? 'Overdue notice' : 'Upcoming reminder'} ·{' '}
                      {format(new Date(reminder.sentAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  {!reminder.isRead && (
                    <button
                      onClick={() => handleMarkReminderRead(reminder.id)}
                      className="text-xs text-primary hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Expected Revenue" value={formatCurrency(financialSummary.expected)} />
        <SummaryCard label="Collected" value={formatCurrency(financialSummary.paid)} />
        <SummaryCard label="Outstanding" value={formatCurrency(financialSummary.outstanding)} />
        <SummaryCard label="Open Invoices" value={String(financialSummary.openInvoices)} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
            <p className="text-sm text-gray-600">Collect team dues and track payment plans</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | InvoiceStatus)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>

            {canManageBilling && (
              <>
                <button
                  onClick={handleRunReminders}
                  disabled={isRunningReminders}
                  className="px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/5 disabled:opacity-50"
                >
                  {isRunningReminders ? 'Running Nudges...' : 'Run Reminder Nudges'}
                </button>
                <button
                  onClick={() => {
                    if (members.length > 0) {
                      setInvoiceForm((prev) => ({
                        ...prev,
                        recipientUserIds: members.map((member) => member.userId),
                      }));
                    }
                    setShowCreateModal(true);
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light"
                >
                  Create Invoice
                </button>
              </>
            )}
          </div>
        </div>

        {(isLoading || isRefreshing) && (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {!isLoading && !isRefreshing && filteredInvoices.length === 0 && (
          <div className="p-10 text-center text-gray-500">No invoices found for this filter.</div>
        )}

        {!isLoading && !isRefreshing && filteredInvoices.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Schedule</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Progress</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map((invoice) => {
                  const expectedTotal = getExpectedInvoiceTotal(invoice);
                  const paidTotal = getPaidInvoiceTotal(invoice);
                  const progress = expectedTotal > 0 ? Math.round((paidTotal / expectedTotal) * 100) : 0;

                  const currentRecipient = invoice.recipients.find((recipient) => recipient.user_id === user?.id);
                  const myTarget = currentRecipient
                    ? currentRecipient.amount_override_cents || invoice.amount_cents
                    : 0;
                  const myPaid = invoice.payments
                    .filter((payment) => payment.user_id === user?.id && payment.status === 'paid')
                    .reduce((sum, payment) => sum + payment.amount_cents, 0);
                  const myDue = Math.max(0, myTarget - myPaid);

                  const nextInstallment = getNextUserInstallment(invoice, user?.id || '');

                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{invoice.title}</div>
                        {invoice.description && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{invoice.description}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">{invoice.recipients.length} recipients</div>
                      </td>

                      <td className="px-4 py-4 text-gray-600">
                        {invoice.installment_plan_count > 1 ? (
                          <div>
                            <div>{invoice.installment_plan_count} installments</div>
                            <div className="text-xs text-gray-500">
                              every {invoice.installment_frequency_days} days
                            </div>
                            {nextInstallment?.dueDate && (
                              <div className="text-xs text-amber-700 mt-1">
                                Next due {format(new Date(`${nextInstallment.dueDate}T00:00:00`), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        ) : invoice.due_date ? (
                          format(new Date(`${invoice.due_date}T00:00:00`), 'MMM d, yyyy')
                        ) : (
                          'No due date'
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={invoice.status} />
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="font-medium text-gray-900">
                          {formatCurrency(paidTotal)} / {formatCurrency(expectedTotal)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{progress}% collected</div>
                      </td>

                      <td className="px-4 py-4 text-right">
                        {currentRecipient ? (
                          nextInstallment ? (
                            <button
                              onClick={() =>
                                handlePayInvoice(
                                  invoice.id,
                                  nextInstallment.id,
                                  formatCurrency(nextInstallment.amountCents)
                                )
                              }
                              disabled={isPayingKey !== null}
                              className="px-3 py-1.5 text-sm border border-primary text-primary rounded-md hover:bg-primary/5 disabled:opacity-50"
                            >
                              {isPayingKey === nextInstallment.id
                                ? 'Starting Checkout...'
                                : `Pay Installment ${nextInstallment.number} (${formatCurrency(nextInstallment.amountCents)})`}
                            </button>
                          ) : myDue > 0 ? (
                            <button
                              onClick={() =>
                                handlePayInvoice(invoice.id, undefined, formatCurrency(myDue))
                              }
                              disabled={isPayingKey !== null}
                              className="px-3 py-1.5 text-sm border border-primary text-primary rounded-md hover:bg-primary/5 disabled:opacity-50"
                            >
                              {isPayingKey === invoice.id
                                ? 'Starting Checkout...'
                                : `Pay ${formatCurrency(myDue)}`}
                            </button>
                          ) : (
                            <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">Paid</span>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">Not assigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Invoice</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-5 space-y-4">
              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Title</label>
                <input
                  value={invoiceForm.title}
                  onChange={(event) =>
                    setInvoiceForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Spring Dues - March"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount per Recipient (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={invoiceForm.amountDollars}
                    onChange={(event) =>
                      setInvoiceForm((prev) => ({ ...prev, amountDollars: event.target.value }))
                    }
                    placeholder="75.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Overall Due Date (optional)</label>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(event) =>
                      setInvoiceForm((prev) => ({ ...prev, dueDate: event.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={invoiceForm.description}
                  onChange={(event) =>
                    setInvoiceForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  placeholder="What this fee covers"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="rounded-md border border-gray-200 p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={invoiceForm.useInstallments}
                    onChange={(event) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        useInstallments: event.target.checked,
                        allowPartial: event.target.checked ? true : prev.allowPartial,
                      }))
                    }
                  />
                  Split this invoice into installments
                </label>

                {invoiceForm.useInstallments && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
                        Installments
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="12"
                        value={invoiceForm.installmentCount}
                        onChange={(event) =>
                          setInvoiceForm((prev) => ({ ...prev, installmentCount: event.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
                        Every (days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={invoiceForm.installmentFrequencyDays}
                        onChange={(event) =>
                          setInvoiceForm((prev) => ({
                            ...prev,
                            installmentFrequencyDays: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
                        First Due Date
                      </label>
                      <input
                        type="date"
                        value={invoiceForm.firstInstallmentDueDate}
                        onChange={(event) =>
                          setInvoiceForm((prev) => ({
                            ...prev,
                            firstInstallmentDueDate: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={invoiceForm.allowPartial}
                    onChange={(event) =>
                      setInvoiceForm((prev) => ({ ...prev, allowPartial: event.target.checked }))
                    }
                  />
                  Allow partial payments
                </label>
              </div>

              <div className="border border-gray-200 rounded-md">
                <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Recipients</p>
                  <div className="flex items-center gap-2 text-xs">
                    <button type="button" onClick={selectAllRecipients} className="text-primary hover:underline">
                      Select all
                    </button>
                    <button type="button" onClick={clearRecipients} className="text-gray-500 hover:underline">
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-56 overflow-auto divide-y divide-gray-100">
                  {members.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-gray-500">No billable members found (players/parents).</p>
                  ) : (
                    members.map((member) => (
                      <label
                        key={member.userId}
                        className="px-3 py-2 flex items-start gap-2 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={invoiceForm.recipientUserIds.includes(member.userId)}
                          onChange={() => handleRecipientToggle(member.userId)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-800">{member.fullName}</div>
                          <div className="text-xs text-gray-500">{member.email} · {member.role}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const classes: Record<InvoiceStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    open: 'bg-yellow-100 text-yellow-700',
    partially_paid: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    void: 'bg-slate-200 text-slate-700',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${classes[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function getExpectedInvoiceTotal(invoice: InvoiceWithDetails): number {
  if (!invoice.recipients || invoice.recipients.length === 0) {
    return invoice.amount_cents;
  }

  return invoice.recipients.reduce(
    (sum, recipient) => sum + (recipient.amount_override_cents || invoice.amount_cents),
    0
  );
}

function getPaidInvoiceTotal(invoice: InvoiceWithDetails): number {
  return invoice.payments
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.amount_cents, 0);
}

function getNextUserInstallment(invoice: InvoiceWithDetails, userId: string): {
  id: string;
  amountCents: number;
  dueDate: string;
  number: number;
  status: string;
} | null {
  if (!userId) {
    return null;
  }

  for (const installment of invoice.installments || []) {
    const recipientInstallment = (installment.recipient_installments || []).find(
      (item) => item.user_id === userId
    );

    if (
      recipientInstallment &&
      recipientInstallment.status !== 'paid' &&
      recipientInstallment.status !== 'void'
    ) {
      return {
        id: recipientInstallment.id,
        amountCents: recipientInstallment.amount_cents,
        dueDate: recipientInstallment.due_date,
        number: installment.installment_number,
        status: recipientInstallment.status,
      };
    }
  }

  return null;
}

function formatCurrency(valueInCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(valueInCents / 100);
}

function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, rounded));
}
