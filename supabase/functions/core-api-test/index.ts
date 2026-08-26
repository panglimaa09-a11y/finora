import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const auth = req.headers.get('Authorization') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

    const body = await req.json().catch(() => ({}))
    const amount = Number(body.amount || 10000)
    const method = String(body.method || 'bank_transfer')
    if (!Number.isInteger(amount) || amount < 10000) return json({ error: 'Minimum test amount is Rp10.000' }, 400)
    if (!['bank_transfer', 'qris'].includes(method)) return json({ error: 'Use bank_transfer or qris' }, 400)

    const provider = String(Deno.env.get('PAYMENT_PROVIDER') || 'midtrans').toLowerCase()
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY') || ''
    const production = String(Deno.env.get('MIDTRANS_IS_PRODUCTION') || 'false').toLowerCase() === 'true'
    if (provider !== 'midtrans' || !serverKey) return json({ error: 'MIDTRANS_NOT_CONFIGURED' }, 503)

    const { data: wallet, error: walletError } = await admin.from('wallets').select('id,status').eq('user_id', user.id).single()
    if (walletError || !wallet || wallet.status !== 'active') return json({ error: 'WALLET_NOT_AVAILABLE' }, 400)

    const orderId = `FINORA-CORE-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const { data: topup, error: topupError } = await admin.from('topups').insert({
      wallet_id: wallet.id,
      user_id: user.id,
      amount,
      method: method === 'qris' ? 'qris_core_api' : 'bank_transfer_core_api',
      provider: 'midtrans',
      status: 'pending',
    }).select('id').single()
    if (topupError) throw topupError

    const transactionDetails = { order_id: orderId, gross_amount: amount }
    const payload: Record<string, unknown> = {
      payment_type: method,
      transaction_details: transactionDetails,
      customer_details: {
        first_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'FINORA User',
        email: user.email || undefined,
      },
    }
    if (method === 'bank_transfer') payload.bank_transfer = { bank: 'bca' }
    if (method === 'qris') payload.qris = { acquirer: 'gopay' }

    const endpoint = production ? 'https://api.midtrans.com/v2/charge' : 'https://api.sandbox.midtrans.com/v2/charge'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${serverKey}:`)}`,
      },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      await admin.from('topups').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', topup.id)
      return json({
        success: false,
        status: response.status,
        order_id: orderId,
        topup_id: topup.id,
        message: result.status_message || result.error_messages?.[0] || 'Midtrans rejected the Core API request',
        raw: result,
      }, 502)
    }

    await admin.from('topups').update({
      provider_reference: result.transaction_id || orderId,
      payment_url: result.redirect_url || null,
      updated_at: new Date().toISOString(),
    }).eq('id', topup.id)

    return json({
      success: true,
      environment: production ? 'production' : 'sandbox',
      integration: 'Midtrans Core API',
      payment_type: method,
      status: result.transaction_status || 'pending',
      status_code: result.status_code || String(response.status),
      status_message: result.status_message || 'Success',
      order_id: orderId,
      transaction_id: result.transaction_id || null,
      topup_id: topup.id,
      va_numbers: result.va_numbers || [],
      qr_string: result.qr_string || null,
      expiry_time: result.expiry_time || null,
      note: 'This test does not credit the FINORA wallet until a verified Midtrans settlement notification is received.',
    })
  } catch (error) {
    console.error('core-api-test', error)
    return json({ success: false, error: String(error) }, 500)
  }
})
