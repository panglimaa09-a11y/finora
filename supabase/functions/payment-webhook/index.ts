import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

async function sha512(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-512', data)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

    const body = await req.json()
    const provider = String(Deno.env.get('PAYMENT_PROVIDER') || '').toLowerCase()
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY') || Deno.env.get('PAYMENT_PROVIDER_API_KEY') || ''

    if (provider !== 'midtrans' || !serverKey) {
      return json({ error: 'MIDTRANS_NOT_CONFIGURED' }, 503)
    }

    const orderId = String(body.order_id || '')
    const statusCode = String(body.status_code || '')
    const grossAmount = String(body.gross_amount || '')
    const signatureKey = String(body.signature_key || '')

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      return json({ error: 'INVALID_MIDTRANS_NOTIFICATION' }, 400)
    }

    const expected = await sha512(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    if (expected.toLowerCase() !== signatureKey.toLowerCase()) {
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
      if (!duplicate) throw insertError
      return json({ ok: true, duplicate: true })
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
      if (error) throw error
    }

    return json({ ok: true, processed: successful && Boolean(topupId) })
  } catch (e) {
    console.error('payment-webhook', e)
    return json({ error: String(e) }, 400)
  }
})
