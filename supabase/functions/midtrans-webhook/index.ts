import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })

async function sha512(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-512', data)
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
    }

    // Midtrans HTTP Notification must NOT require a Supabase user JWT.
    // The request is authenticated using Midtrans signature_key below.
    const body = await req.json()

    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY') || ''
    if (!serverKey) {
      console.error('MIDTRANS_SERVER_KEY is missing')
      return json({ error: 'MIDTRANS_NOT_CONFIGURED' }, 503)
    }

    const orderId = String(body.order_id || '')
    const statusCode = String(body.status_code || '')
    const grossAmount = String(body.gross_amount || '')
    const signatureKey = String(body.signature_key || '')

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      return json({ error: 'INVALID_MIDTRANS_NOTIFICATION' }, 400)
    }

    const expected = await sha512(
      `${orderId}${statusCode}${grossAmount}${serverKey}`,
    )

    if (expected.toLowerCase() !== signatureKey.toLowerCase()) {
      console.warn('Invalid Midtrans signature', { orderId })
      return json({ error: 'INVALID_SIGNATURE' }, 401)
    }

    const transactionId = String(body.transaction_id || '')
    const transactionStatus = String(body.transaction_status || '').toLowerCase()
    const fraudStatus = String(body.fraud_status || '').toLowerCase()
    const eventId = `${orderId}:${transactionId}:${transactionStatus}`

    const { error: eventError } = await admin
      .from('webhook_events')
      .insert({
        provider: 'midtrans',
        event_id: eventId,
        payload: body,
        processed_at: new Date().toISOString(),
      })

    if (eventError) {
      const duplicate = String(eventError.message || '')
        .toLowerCase()
        .includes('duplicate')

      if (!duplicate) throw eventError

      // Midtrans retries notifications. Duplicate events are already handled.
      return json({ ok: true, duplicate: true })
    }

    const successful =
      statusCode === '200' &&
      ['settlement', 'capture'].includes(transactionStatus) &&
      (!fraudStatus || fraudStatus === 'accept')

    const failed =
      ['deny', 'cancel', 'expire', 'failure'].includes(transactionStatus) ||
      (transactionStatus === 'capture' && fraudStatus === 'challenge')

    // Keep existing wallet/top-up payment flow compatible.
    const topupId = body.metadata?.topup_id || body.custom_field1 || null

    if (successful && topupId) {
      const { error } = await admin.rpc('post_topup', {
        p_topup_id: String(topupId),
        p_provider_reference: transactionId || orderId,
      })

      if (error) throw error
    }

    return json({
      ok: true,
      order_id: orderId,
      transaction_status: transactionStatus,
      successful,
      failed,
      processed_topup: Boolean(successful && topupId),
    })
  } catch (error) {
    console.error('midtrans-webhook', error)
    return json({ error: 'WEBHOOK_PROCESSING_FAILED' }, 500)
  }
})
