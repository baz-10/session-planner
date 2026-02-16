import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';

const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments.',
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { invoiceId?: string; recipientInstallmentId?: string };
    const invoiceId = body.invoiceId;
    const recipientInstallmentId = body.recipientInstallmentId;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: 'invoiceId is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
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

    const { data: invoice, error: invoiceError } = await supabase
      .from('billing_invoices')
      .select(`
        id,
        title,
        description,
        amount_cents,
        currency,
        status,
        due_date,
        recipients:billing_invoice_recipients(user_id, amount_override_cents)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found.' },
        { status: 404 }
      );
    }

    if (invoice.status === 'void' || invoice.status === 'paid') {
      return NextResponse.json(
        { success: false, error: 'This invoice is not payable.' },
        { status: 400 }
      );
    }

    const recipient = (invoice.recipients || []).find(
      (item: { user_id: string; amount_override_cents?: number | null }) => item.user_id === user.id
    );

    if (!recipient) {
      return NextResponse.json(
        { success: false, error: 'You are not assigned to this invoice.' },
        { status: 403 }
      );
    }

    let amountCents = recipient.amount_override_cents ?? invoice.amount_cents ?? 0;
    let payableDueDate = invoice.due_date ? String(invoice.due_date) : null;

    if (recipientInstallmentId) {
      const { data: recipientInstallment, error: recipientInstallmentError } = await supabase
        .from('billing_recipient_installments')
        .select('id, amount_cents, due_date, status, invoice_id, user_id')
        .eq('id', recipientInstallmentId)
        .eq('invoice_id', invoice.id)
        .eq('user_id', user.id)
        .single();

      if (recipientInstallmentError || !recipientInstallment) {
        return NextResponse.json(
          { success: false, error: 'Installment not found for this invoice.' },
          { status: 404 }
        );
      }

      if (recipientInstallment.status === 'paid' || recipientInstallment.status === 'void') {
        return NextResponse.json(
          { success: false, error: 'This installment is already resolved.' },
          { status: 400 }
        );
      }

      amountCents = recipientInstallment.amount_cents;
      payableDueDate = recipientInstallment.due_date;
    }

    if (amountCents <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invoice amount is invalid.' },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .maybeSingle();

    const origin =
      request.headers.get('origin') ||
      request.nextUrl.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${origin}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${origin}/dashboard/billing?checkout=cancel`);
    params.append('line_items[0][price_data][currency]', (invoice.currency || 'usd').toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', String(amountCents));
    params.append('line_items[0][price_data][product_data][name]', invoice.title || 'Team Invoice');
    if (invoice.description) {
      params.append('line_items[0][price_data][product_data][description]', invoice.description);
    }
    params.append('line_items[0][quantity]', '1');
    params.append('metadata[invoice_id]', invoice.id);
    params.append('metadata[user_id]', user.id);
    if (payableDueDate) {
      params.append('metadata[due_date]', payableDueDate);
    }
    if (recipientInstallmentId) {
      params.append('metadata[recipient_installment_id]', recipientInstallmentId);
    }
    if (profile?.email) {
      params.append('customer_email', profile.email);
    }

    const stripeResponse = await fetch(`${STRIPE_BASE_URL}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      const stripeError = stripeData?.error?.message || 'Stripe checkout creation failed.';
      return NextResponse.json(
        { success: false, error: stripeError },
        { status: 400 }
      );
    }

    const sessionId = stripeData.id as string;
    const checkoutUrl = stripeData.url as string;

    const { error: paymentInsertError } = await supabase.from('billing_payments').insert({
      invoice_id: invoice.id,
      user_id: user.id,
      amount_cents: amountCents,
      status: 'pending',
      provider: 'stripe',
      provider_checkout_session_id: sessionId,
    });

    if (paymentInsertError) {
      console.error('Failed to create pending payment record:', paymentInsertError);
      return NextResponse.json(
        { success: false, error: 'Could not initialize payment tracking for this invoice.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      checkoutUrl,
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
