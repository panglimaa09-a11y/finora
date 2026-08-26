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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'UNAUTHORIZED' }, 401)

    const body = await req.json().catch(() => ({}))
    const amount = Number(body.amount)
    const bankCode = String(body.bank_code || '').trim()
    const accountNumber = String(body.account_number || '').trim()
    const accountName = String(body.account_name || '').trim()
    const destinationType = String(body.destination_type || 'bank').trim()

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: 'INVALID_AMOUNT' }, 400)
    }
    if (!bankCode) return json({ error: 'BANK_CODE_REQUIRED' }, 400)
    if (!accountNumber) return json({ error: 'ACCOUNT_NUMBER_REQUIRED' }, 400)
    if (!accountName) return json({ error: 'ACCOUNT_NAME_REQUIRED' }, 400)

    const { data, error } = await userClient.rpc('create_withdrawal', {
      p_amount: amount,
      p_bank_code: bankCode,
      p_account_number: accountNumber,
      p_account_name: accountName,
    })

    if (error) {
      console.error('create-withdrawal RPC error', {
        user_id: user.id,
        destination_type: destinationType,
        amount,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })

      return json({
        error: error.message || 'WITHDRAWAL_FAILED',
        code: error.code || null,
        details: error.details || null,
      }, 400)
    }

    return json({
      success: true,
      withdrawal_id: data,
      destination_type: destinationType,
      message: 'Penarikan dibuat dan masuk antrean payout provider.',
    })
  } catch (e) {
    console.error('create-withdrawal error', e)
    return json({ error: String(e) }, 400)
  }
})
