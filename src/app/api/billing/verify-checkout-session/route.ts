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
          error: 'Stripe is not configured. Set STRIPE_SECRET_KEY to verify payments.',
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { sessionId?: string };
    const sessionId = body.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
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

    const stripeResponse = await fetch(
      `${STRIPE_BASE_URL}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      }
    );

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      const stripeError = stripeData?.error?.message || 'Failed to load checkout session.';
      return NextResponse.json(
        { success: false, error: stripeError },
        { status: 400 }
      );
    }

    const metadata = (stripeData.metadata || {}) as {
      invoice_id?: string;
      user_id?: string;
      recipient_installment_id?: string;
    };
    const invoiceId = metadata.invoice_id;
    const ownerUserId = metadata.user_id;
    const recipientInstallmentId = metadata.recipient_installment_id;

    if (!invoiceId || !ownerUserId) {
      return NextResponse.json(
        { success: false, error: 'Checkout session metadata is incomplete.' },
        { status: 400 }
      );
    }

    if (ownerUserId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'This checkout session belongs to another user.' },
        { status: 403 }
      );
    }

    const paymentIntent = stripeData.payment_intent;
    const paymentIntentId =
      typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id || null;

    const amountTotal = Number(stripeData.amount_total || 0);
    const paymentStatus = stripeData.payment_status as string;
    const sessionStatus = stripeData.status as string;

    if (paymentStatus === 'paid') {
      let paymentRecordId: string | null = null;

      const { data: updatedPayment, error: updateError } = await supabase
        .from('billing_payments')
        .update({
          status: 'paid',
          provider_payment_intent_id: paymentIntentId,
          paid_at: new Date().toISOString(),
          amount_cents: amountTotal > 0 ? amountTotal : undefined,
        })
        .eq('provider_checkout_session_id', sessionId)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle();

      if (updateError) {
        console.error('Error updating billing payment to paid:', updateError);
        return NextResponse.json(
          { success: false, error: 'Unable to finalize this payment.' },
          { status: 500 }
        );
      }

      if (!updatedPayment) {
        let insertAmountCents = amountTotal;
        if (insertAmountCents <= 0) {
          const { data: invoiceFallback } = await supabase
            .from('billing_invoices')
            .select('amount_cents')
            .eq('id', invoiceId)
            .maybeSingle();
          insertAmountCents = invoiceFallback?.amount_cents || 0;
        }

        if (insertAmountCents <= 0) {
          return NextResponse.json(
            { success: false, error: 'Payment succeeded but amount could not be determined.' },
            { status: 500 }
          );
        }

        const { data: insertedPayment, error: insertError } = await supabase
          .from('billing_payments')
          .insert({
            invoice_id: invoiceId,
            user_id: user.id,
            amount_cents: insertAmountCents,
            status: 'paid',
            provider: 'stripe',
            provider_checkout_session_id: sessionId,
            provider_payment_intent_id: paymentIntentId,
            paid_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();

        if (insertError) {
          console.error('Error creating fallback payment row:', insertError);
          return NextResponse.json(
            { success: false, error: 'Payment succeeded but could not be recorded.' },
            { status: 500 }
          );
        }

        paymentRecordId = insertedPayment?.id || null;
      } else {
        paymentRecordId = updatedPayment.id;
      }

      if (recipientInstallmentId) {
        const { error: installmentUpdateError } = await supabase
          .from('billing_recipient_installments')
          .update({
            status: 'paid',
            paid_payment_id: paymentRecordId,
            paid_at: new Date().toISOString(),
          })
          .eq('id', recipientInstallmentId)
          .eq('invoice_id', invoiceId)
          .eq('user_id', user.id);

        if (installmentUpdateError) {
          console.error('Failed to mark installment as paid:', installmentUpdateError);
          return NextResponse.json(
            { success: false, error: 'Payment succeeded but installment status was not updated.' },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        status: 'paid',
        invoiceId,
      });
    }

    const mappedStatus = sessionStatus === 'expired' ? 'expired' : 'pending';

    await supabase
      .from('billing_payments')
      .update({ status: mappedStatus })
      .eq('provider_checkout_session_id', sessionId)
      .eq('user_id', user.id)
      .in('status', ['pending', 'failed']);

    return NextResponse.json({
      success: true,
      status: mappedStatus,
      invoiceId,
    });
  } catch (error) {
    console.error('Verify checkout session error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
