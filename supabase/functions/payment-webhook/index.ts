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
      'Access-Control-Allow-Origin': '*',
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
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const body = await req.json()
    const provider = String(Deno.env.get('PAYMENT_PROVIDER') || '').toLowerCase()
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY') || Deno.env.get('PAYMENT_PROVIDER_API_KEY') || ''

    if (provider !== 'midtrans' || !serverKey) {
      console.error('payment-webhook: Midtrans not configured')
      return json({ error: 'MIDTRANS_NOT_CONFIGURED' }, 503)
    }

    const orderId = String(body.order_id || '')
    const statusCode = String(body.status_code || '')
    const grossAmount = String(body.gross_amount || '')
    const signatureKey = String(body.signature_key || '')

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      console.error('payment-webhook: invalid notification', { orderId, statusCode, hasGrossAmount: !!grossAmount, hasSignature: !!signatureKey })
      return json({ error: 'INVALID_MIDTRANS_NOTIFICATION' }, 400)
    }

    const expected = await sha512(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    if (expected.toLowerCase() !== signatureKey.toLowerCase()) {
      console.error('payment-webhook: invalid signature', { orderId })
      return json({ error: 'INVALID_SIGNATURE' }, 401)
    }

    const eventId = `${orderId}:${String(body.transaction_id || '')}:${String(body.transaction_status || '')}`
    const { error: insertError } = await admin.from('webhook_events').insert({
      provider: 'midtrans',
      event_id: eventId,
      payload: body,
    })

    if (insertError) {
      const duplicate = String(insertError.message || '').toLowerCase().includes('duplicate')
      if (duplicate) return json({ ok: true, duplicate: true })
      console.error('payment-webhook: event persistence failed', insertError)
      // A valid signed notification was received. Acknowledge it so Midtrans
      // does not repeatedly redeliver it while preserving the error in logs.
      return json({ ok: true, accepted: true, persistenceError: true })
    }

    const topupId = body.metadata?.topup_id || body.custom_field1 || null
    const transactionStatus = String(body.transaction_status || '').toLowerCase()
    const fraudStatus = String(body.fraud_status || '').toLowerCase()
    const successful =
      statusCode === '200' &&
      ['settlement', 'capture'].includes(transactionStatus) &&
      (!fraudStatus || fraudStatus === 'accept')

    if (successful && topupId) {
      const { error } = await admin.rpc('post_topup', {
        p_topup_id: String(topupId),
        p_provider_reference: String(body.transaction_id || orderId),
      })

      if (error) {
        console.error('payment-webhook: post_topup failed', {
          orderId,
          topupId: String(topupId),
          error,
        })
        // Do not turn a verified Midtrans notification into a 4xx response.
        // The event has already been persisted and can be reconciled server-side.
        return json({ ok: true, accepted: true, topupProcessed: false })
      }
    }

    return json({ ok: true, processed: successful && Boolean(topupId) })
  } catch (e) {
    console.error('payment-webhook: unexpected error', e)
    return json({ error: 'INTERNAL_WEBHOOK_ERROR' }, 500)
  }
})
