import './style.css'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const app = document.getElementById('app')

const money = (n=0) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
const escapeHtml = (s='') => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))

let state = { user:null, wallet:null, transactions:[], view:'dashboard', modal:null, loading:true, error:'' }
const configured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = configured ? createClient(supabaseUrl, supabaseAnonKey) : null

function renderSetup(){app.innerHTML=`<main class="auth"><section class="auth-card"><div class="brand">FINORA</div><div class="eyebrow">SETUP REQUIRED</div><h1>FINORA sudah terhubung ke GitHub.</h1><p class="muted">Frontend berhasil dimuat. Supabase belum dikonfigurasi di environment aplikasi.</p><div class="notice"><strong>Tambahkan Environment Variables:</strong><br><code>VITE_SUPABASE_URL</code><br><code>VITE_SUPABASE_ANON_KEY</code></div><p class="tiny">Setelah variable ditambahkan di Vercel, lakukan redeploy. Jangan masukkan service_role key ke frontend atau GitHub.</p></section><section class="auth-art"><div class="orb orb-a"></div><div class="orb orb-b"></div><div class="art-copy"><span>FINORA • WALLET</span><h2>Frontend aktif. Backend siap disambungkan.</h2></div></section></main>`}

async function loadWallet(){
  if(!state.user||!supabase)return
  const {data,error}=await supabase.from('wallets').select('*').eq('user_id',state.user.id).maybeSingle()
  if(error) state.error=error.message
  state.wallet=data||null
  const {data:ledger,error:ledgerError}=await supabase.from('wallet_transactions').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(20)
  if(ledgerError) state.error=state.error||ledgerError.message
  state.transactions=ledger||[]
}

function render(){if(!configured){renderSetup();return}if(state.loading){app.innerHTML='<div class="loading">Memuat FINORA…</div>';return}if(!state.user){renderAuth();return}renderApp()}

function renderAuth(){app.innerHTML=`<main class="auth"><section class="auth-card"><div class="brand">FINORA</div><div class="eyebrow">DIGITAL WALLET</div><h1>Keuanganmu, lebih terarah.</h1><p class="muted">Masuk untuk mengakses wallet, tabungan, transfer, dan riwayat transaksi.</p><div class="oauths"><button data-provider="google">Continue with Google</button><button data-provider="facebook">Continue with Facebook</button><button data-provider="apple">Continue with Apple</button></div><p class="tiny">Provider OAuth diaktifkan melalui Supabase Auth.</p>${state.error?`<div class="notice">${escapeHtml(state.error)}</div>`:''}</section><section class="auth-art"><div class="orb orb-a"></div><div class="orb orb-b"></div><div class="art-copy"><span>SAFE • SMART • SIMPLE</span><h2>Wallet core siap dikembangkan ke payment provider produksi.</h2></div></section></main>`}

function renderApp(){
  const w=state.wallet||{available_balance:0,pending_balance:0}
  const nav=[['dashboard','Dashboard'],['topup','Top Up'],['withdraw','Tarik Dana'],['savings','Tabungan'],['security','Security']]
  app.innerHTML=`<div class="shell"><header class="topbar"><div class="brand">FINORA</div><div class="head-actions"><span class="verified">● Wallet Active</span><button id="logout" class="ghost">Keluar</button></div></header><main class="content"><div class="welcome"><div><div class="eyebrow">FINORA WALLET</div><h1>Halo, ${escapeHtml(state.user.user_metadata?.full_name||state.user.email?.split('@')[0]||'Pengguna')}</h1><p class="muted">${escapeHtml(state.user.email||'')}</p></div><div class="quick"><button data-action="topup">＋ Top Up</button><button data-action="withdraw">↗ Tarik Dana</button></div></div><nav class="nav">${nav.map(([id,label])=>`<button class="navitem ${state.view===id?'active':''}" data-view="${id}">${label}</button>`).join('')}</nav>${state.error?`<div class="notice">${escapeHtml(state.error)}</div>`:''}${renderView()}</main></div>${state.modal?renderModal():''}`
}

function renderView(){
  if(state.view==='topup')return `<section class="panel"><div class="panel-head"><div><div class="eyebrow">WALLET</div><h2>Isi saldo</h2></div><span class="pill">Payment protected</span></div><div class="form-grid"><label>Nominal<input id="topupAmount" inputmode="numeric" placeholder="100000" /></label><label>Metode<select id="topupMethod"><option value="qris">QRIS</option><option value="va">Virtual Account</option><option value="bank_transfer">Bank Transfer</option></select></label></div><button id="submitTopup" class="primary">Buat pembayaran</button><p class="tiny">Saldo hanya bertambah setelah provider mengonfirmasi pembayaran melalui webhook server yang terverifikasi.</p></section>`
  if(state.view==='withdraw')return `<section class="panel"><div class="panel-head"><div><div class="eyebrow">PAYOUT</div><h2>Tarik dana</h2></div><span class="pill">${money(state.wallet?.available_balance||0)} tersedia</span></div><div class="form-grid"><label>Nominal<input id="withdrawAmount" inputmode="numeric" placeholder="100000" /></label><label>Kode Bank<input id="bankCode" placeholder="BCA" /></label><label>Nomor Rekening<input id="accountNumber" inputmode="numeric" /></label><label>Nama Pemilik<input id="accountName" /></label></div><button id="submitWithdraw" class="primary">Ajukan penarikan</button><p class="tiny">Saldo akan di-reserve terlebih dahulu. Payout ke bank dilakukan oleh provider yang terhubung.</p></section>`
  if(state.view==='savings')return `<section class="panel saving-empty"><div class="save-icon">◈</div><h2>Tabungan</h2><p>Mesin target tabungan siap ditambahkan di atas wallet ledger FINORA.</p><button class="primary" data-action="topup">Mulai dari Top Up</button></section>`
  if(state.view==='security')return `<section class="panel"><div class="eyebrow">SECURITY CENTER</div><h2>Lapisan keamanan</h2><div class="security-grid"><div><strong>OAuth</strong><span>Aktif</span></div><div><strong>RLS</strong><span>Aktif</span></div><div><strong>Ledger</strong><span>Server-side</span></div><div><strong>Webhook</strong><span>Verified</span></div></div></section>`
  return `<section class="cards"><article class="wallet-card"><div class="card-top"><span>Available Balance</span><span class="chip">IDR</span></div><strong>${money(state.wallet?.available_balance||0)}</strong><div class="card-bottom"><span>Pending ${money(state.wallet?.pending_balance||0)}</span><span>FINORA WALLET</span></div></article><article class="stat"><span>Total transaksi</span><strong>${state.transactions.length}</strong><small>20 transaksi terbaru</small></article><article class="stat"><span>Status wallet</span><strong>Active</strong><small>RLS protected</small></article></section><section class="panel"><div class="panel-head"><div><div class="eyebrow">LEDGER</div><h2>Aktivitas terbaru</h2></div><button class="link" id="refreshWallet">Refresh</button></div>${renderTransactions()}</section>`
}

function renderTransactions(){
  if(!state.transactions.length)return `<div class="empty">Belum ada transaksi.</div>`
  return `<div class="tx-list">${state.transactions.map(t=>{
    const credit=['topup','transfer_in','refund','adjustment'].includes(t.type)
    const label=t.description||t.type||'Transaksi'
    return `<div class="tx"><div><strong>${escapeHtml(label)}</strong><small>${new Date(t.created_at).toLocaleString('id-ID')}</small></div><strong class="${credit?'credit':'debit'}">${credit?'+':'-'}${money(t.amount)}</strong></div>`
  }).join('')}</div>`
}

function renderModal(){return `<div class="modal-wrap"><div class="modal"><button class="close" id="closeModal">×</button>${state.modal}</div></div>`}

async function signIn(provider){
  state.error='';render()
  const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:window.location.origin}})
  if(error){state.error=error.message;render()}
}

async function invokeFunction(name,body){
  const {data:{session}}=await supabase.auth.getSession()
  if(!session) throw new Error('Sesi login sudah berakhir. Silakan login kembali.')

  const {data,error}=await supabase.functions.invoke(name,{body,headers:{Authorization:`Bearer ${session.access_token}`}})

  if(error){
    let detail=error.message||'Permintaan ke Edge Function gagal.'
    try{
      const response=error.context
      if(response&&typeof response.text==='function'){
        const text=await response.text()
        if(text){
          try{
            const parsed=JSON.parse(text)
            detail=parsed.message||parsed.error||parsed.msg||text
          }catch{detail=text}
        }
      }
    }catch{}
    throw new Error(`Edge Function "${name}" gagal: ${detail}`)
  }

  if(data?.error) throw new Error(data.error)
  return data
}

async function doTopup(){
  const amount=Number(document.getElementById('topupAmount').value),method=document.getElementById('topupMethod').value
  if(!Number.isFinite(amount)||amount<10000){alert('Minimum top up Rp10.000');return}
  try{
    const data=await invokeFunction('provider-create-topup',{amount,method})
    state.modal=`<h2>Pembayaran dibuat</h2><p>Order ${escapeHtml(data.topup_id||'—')} sudah dibuat dengan status pending.</p><span class="hint">Pembayaran akan menambah saldo hanya setelah webhook provider terverifikasi.</span>`
    await loadWallet();render()
  }catch(err){alert(err.message)}
}

async function doWithdraw(){
  const amount=Number(document.getElementById('withdrawAmount').value),bank_code=document.getElementById('bankCode').value.trim(),account_number=document.getElementById('accountNumber').value.trim(),account_name=document.getElementById('accountName').value.trim()
  if(!Number.isFinite(amount)||amount<=0||!bank_code||!account_number||!account_name){alert('Lengkapi data penarikan.');return}
  try{
    const data=await invokeFunction('create-withdrawal',{amount,bank_code,account_number,account_name})
    await loadWallet()
    state.modal=`<h2>Penarikan dibuat</h2><p>ID withdrawal: ${escapeHtml(data.withdrawal_id||'—')}</p><span class="hint">Penarikan menunggu payout provider.</span>`
    render()
  }catch(err){alert(err.message)}
}

document.addEventListener('click',async e=>{
  const btn=e.target.closest('button');if(!btn)return
  if(btn.dataset.provider)return signIn(btn.dataset.provider)
  if(btn.id==='logout'){await supabase.auth.signOut();return}
  if(btn.id==='closeModal'){state.modal=null;render();return}
  if(btn.id==='refreshWallet'){state.error='';await loadWallet();render();return}
  if(btn.dataset.view){state.view=btn.dataset.view;state.error='';render();return}
  if(btn.dataset.action){state.view=btn.dataset.action;state.error='';render();return}
  if(btn.id==='submitTopup')return doTopup()
  if(btn.id==='submitWithdraw')return doWithdraw()
})

if(configured){
  supabase.auth.onAuthStateChange(async(_event,session)=>{
    state.user=session?.user||null
    if(state.user)await loadWallet();else{state.wallet=null;state.transactions=[]}
    state.loading=false;render()
  })
  ;(async()=>{const {data:{session}}=await supabase.auth.getSession();state.user=session?.user||null;if(state.user)await loadWallet();state.loading=false;render()})()
}else{state.loading=false;render()}
