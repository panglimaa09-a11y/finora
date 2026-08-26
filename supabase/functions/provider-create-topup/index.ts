import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const auth=req.headers.get('Authorization')||'';
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await userClient.auth.getUser(); if(!user) return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{...cors,'Content-Type':'application/json'}});
  const {amount,method}=await req.json();
  if(!Number.isFinite(amount)||amount<10000) return new Response(JSON.stringify({error:'Minimum top up Rp10.000'}),{status:400,headers:{...cors,'Content-Type':'application/json'}});
  if(!['qris','va','bank_transfer'].includes(method)) throw new Error('Unsupported payment method');
  const {data:w,error:we}=await admin.from('wallets').select('id,status').eq('user_id',user.id).single(); if(we||!w||w.status!=='active') throw new Error('WALLET_NOT_AVAILABLE');
  const reference=`FINORA-${crypto.randomUUID()}`;
  const {data:t,error}=await admin.from('topups').insert({wallet_id:w.id,user_id:user.id,amount,method,provider:Deno.env.get('PAYMENT_PROVIDER')||'unconfigured',status:'pending',metadata:{client_reference:reference}}).select().single();
  if(error) throw error;
  // Provider call intentionally fails closed until real provider credentials and adapter are configured.
  if(!Deno.env.get('PAYMENT_PROVIDER')||!Deno.env.get('PAYMENT_PROVIDER_API_KEY')) throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
  return new Response(JSON.stringify({topup_id:t.id,reference,status:'pending',message:'Order created. Connect the selected provider adapter to return QRIS/VA payment instructions.'}),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({error:String(e)}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}
});
