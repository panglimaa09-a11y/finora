import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const auth = req.headers.get('Authorization') || ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    })

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const amount = Number(body.amount ?? body.gross_amount)
    const orderId = String(body.order_id || `FINORA-${crypto.randomUUID()}`)

    if (!Number.isInteger(amount) || amount < 10000) {
      return json({ error: 'Minimum top up Rp10.000' }, 400)
    }

    const provider = String(Deno.env.get('PAYMENT_PROVIDER') || '').toLowerCase()
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY') || ''
    const isProduction = String(Deno.env.get('MIDTRANS_IS_PRODUCTION') || 'false').toLowerCase() === 'true'

    if (provider !== 'midtrans' || !serverKey) {
      return json({ error: 'MIDTRANS_NOT_CONFIGURED' }, 503)
    }

    const endpoint = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions'

    const basic = btoa(`${serverKey}:`)

    const payload = {
      transaction_details: {
        order_id: orderId,
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
      custom_field1: user.id,
      metadata: {
        user_id: user.id,
        finora_reference: orderId,
      },
      expiry: {
        unit: 'hours',
        duration: 24,
      },
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    let result: any = {}

    try {
      result = JSON.parse(responseText)
    } catch {
      return json({
        success: false,
        status: response.status,
        statusText: response.statusText,
        rawResponse: responseText,
      }, 502)
    }

    if (!response.ok) {
      console.error('Midtrans Snap create failed:', response.status, result)
      return json({
        success: false,
        status: response.status,
        statusText: response.statusText,
        error: result.error || 'MIDTRANS_SNAP_CREATE_FAILED',
        message: result.status_message || result.error_messages?.[0] || 'Midtrans rejected the transaction',
      }, response.status === 401 ? 502 : 502)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const topupInsert = {
      wallet_id: null,
      user_id: user.id,
      amount,
      method: String(body.method || 'snap'),
      provider: 'midtrans',
      provider_reference: orderId,
      status: 'pending',
      payment_url: result.redirect_url || null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }

    const { data: wallet } = await admin
      .from('wallets')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (wallet?.id) {
      topupInsert.wallet_id = wallet.id
      await admin.from('topups').insert(topupInsert)
    }

    return json({
      success: true,
      provider: 'midtrans',
      environment: isProduction ? 'production' : 'sandbox',
      order_id: orderId,
      token: result.token || null,
      payment_url: result.redirect_url || null,
      redirect_url: result.redirect_url || null,
      status: 'pending',
      message: 'Snap transaction created successfully.',
    })
  } catch (error) {
    console.error('midtrans-token error:', error)
    return json({ error: String(error) }, 500)
  }
})
