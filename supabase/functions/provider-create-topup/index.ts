import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const auth = req.headers.get('Authorization') || ''
    const admin = createClient(supabaseUrl, serviceRoleKey)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    })

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json()
    const amount = Number(body.amount)
    const method = String(body.method || '')

    if (!Number.isInteger(amount) || amount < 10000) {
      return json({ error: 'Minimum top up Rp10.000' }, 400)
    }
    if (!['qris', 'va', 'bank_transfer'].includes(method)) {
      return json({ error: 'Unsupported payment method' }, 400)
    }

    const { data: wallet, error: walletError } = await admin
      .from('wallets')
      .select('id,status,currency')
      .eq('user_id', user.id)
      .single()

    if (walletError || !wallet || wallet.status !== 'active') {
      return json({ error: 'WALLET_NOT_AVAILABLE' }, 400)
    }

    const provider = String(Deno.env.get('PAYMENT_PROVIDER') || '').toLowerCase()
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY') || Deno.env.get('PAYMENT_PROVIDER_API_KEY') || ''
    const isProduction = String(Deno.env.get('MIDTRANS_IS_PRODUCTION') || 'false').toLowerCase() === 'true'

    if (provider !== 'midtrans' || !serverKey) {
      return json({ error: 'MIDTRANS_NOT_CONFIGURED' }, 503)
    }

    const reference = `FINORA-${crypto.randomUUID()}`

    // Create the internal top-up first. The wallet is NOT credited here.
    const { data: topup, error: topupError } = await admin
      .from('topups')
      .insert({
        wallet_id: wallet.id,
        user_id: user.id,
        amount,
        method,
        provider: 'midtrans',
        status: 'pending',
      })
      .select('id,amount,method,status')
      .single()

    if (topupError) throw topupError

    const endpoint = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions'

    const basic = btoa(`${serverKey}:`)
    const midtransBody = {
      transaction_details: {
        order_id: reference,
        gross_amount: amount,
      },
      item_details: [
        {
          id: 'FINORA-TOPUP',
          price: amount,
          quantity: 1,
          name: 'FINORA Wallet Top Up',
        },
      ],
      customer_details: {
        first_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'FINORA User',
        email: user.email || undefined,
      },
      custom_field1: String(topup.id),
      metadata: {
        topup_id: String(topup.id),
        user_id: user.id,
        finora_reference: reference,
      },
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify(midtransBody),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('Midtrans create transaction failed', response.status, result)
      return json({
        error: 'MIDTRANS_CREATE_TRANSACTION_FAILED',
        status_code: response.status,
        message: result.status_message || result.error_messages?.[0] || 'Midtrans rejected the transaction',
        topup_id: topup.id,
      }, 502)
    }

    // Snap returns token + redirect_url. The redirect URL can be opened without exposing the Server Key.
    return json({
      ok: true,
      provider: 'midtrans',
      topup_id: topup.id,
      reference,
      status: 'pending',
      token: result.token || null,
      payment_url: result.redirect_url || null,
      expires_at: null,
      message: 'Payment created. Balance will only be credited after a verified Midtrans settlement notification.',
    })
  } catch (e) {
    console.error('provider-create-topup', e)
    return json({ error: String(e) }, 400)
  }
})
