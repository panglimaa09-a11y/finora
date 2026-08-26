import './style.css'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const app = document.getElementById('app')

const ADMIN_EMAILS = [
  'panglimaa09@gmail.com',
  'deavani1705@gmail.com',
]

const money = (n=0) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
const escapeHtml = (s='') => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const safeUrl = (url='') => { try { const u=new URL(url); return ['https:','http:'].includes(u.protocol)?u.toString():'' } catch { return '' } }
const isAdmin = (user) => ADMIN_EMAILS.includes(String(user?.email||'').toLowerCase())

const BANKS = [
  ['002','BRI'],['008','Mandiri'],['009','BNI'],['011','Danamon'],['013','Permata'],['014','BCA'],
  ['016','Maybank'],['019','Panin'],['022','CIMB Niaga'],['023','UOB Indonesia'],['028','OCBC NISP'],
  ['031','Citibank'],['046','DBS Indonesia'],['087','Bukopin'],['095','JTrust Bank'],['097','Mayapada'],
  ['110','BTPN / SMBC Indonesia'],['111','Bank of India Indonesia'],['112','Bank Jago'],['113','Artha Graha'],
  ['114','Bank Multiarta Sentosa'],['115','Bank Woori Saudara'],['116','BCA Syariah'],['117','QNB Indonesia'],
  ['118','Bank Sahabat Sampoerna'],['119','KEB Hana Indonesia'],['120','Shinhan Indonesia'],['121','MNC Bank'],
  ['122','Bank Neo Commerce'],['147','Muamalat'],['153','Sinarmas'],['200','BTN'],['213','BTPN Syariah'],
  ['422','BSI'],['451','BSI'],['506','Bank Mega Syariah'],['513','Bank Ina Perdana'],['535','SeaBank'],
  ['542','Bank Jago'],['564','Mandiri Taspen'],['567','Bank Aladin Syariah']
]

const E_WALLETS = [
  ['DANA','DANA'],['GOPAY','GoPay'],['OVO','OVO'],['SHOPEEPAY','ShopeePay'],['LINKAJA','LinkAja']
]

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

function renderAuth(){app.innerHTML=`<main class="auth"><section class="auth-card"><div class="brand">FINORA</div><div class="eyebrow">DIGITAL WALLET</div><h1>Keuanganmu, lebih terarah.</h1><p class="muted">Masuk sekali untuk mengakses FINORA Wallet dan DAPIN.</p><div class="oauths"><button data-provider="google">Continue with Google</button><button data-provider="facebook">Continue with Facebook</button><button data-provider="apple">Continue with Apple</button></div><p class="tiny">Satu session Supabase dipakai untuk FINORA Wallet dan DAPIN.</p>${state.error?`<div class="notice">${escapeHtml(state.error)}</div>`:''}</section><section class="auth-art"><div class="orb orb-a"></div><div class="orb orb-b"></div><div class="art-copy"><span>FINORA • DAPIN</span><h2>Satu login. Dua ruang kerja.</h2></div></section></main>`}

function renderLauncher(){
  const admin=isAdmin(state.user)
  const name=escapeHtml(state.user.user_metadata?.full_name||state.user.email?.split('@')[0]||'Pengguna')
  return `<section class="launcher"><div class="launcher-head"><div><div class="eyebrow">FINORA PLATFORM</div><h1>Selamat datang, ${name}</h1><p class="muted">Satu akun untuk mengakses seluruh layanan FINORA.</p></div><div class="head-actions"><span class="verified">● Session Active</span><button id="logout" class="ghost">Keluar</button></div></div><div class="app-grid"><button class="app-card" data-view="dashboard"><span class="app-icon">₣</span><span><strong>FINORA Wallet</strong><small>Saldo, top up, transaksi & keamanan</small></span><b>→</b></button><button class="app-card" data-view="dapin"><span class="app-icon">D</span><span><strong>DAPIN Balongbendo</strong><small>Simpan pinjam, anggota, angsuran & laporan</small></span><b>→</b></button>${admin?`<button class="app-card admin-card" data-view="admin"><span class="app-icon">A</span><span><strong>Admin Center</strong><small>Kontrol platform & monitoring</small></span><b>→</b></button>`:''}</div><div class="launcher-foot"><span>Logged in as <strong>${escapeHtml(state.user.email||'')}</strong></span><span>${admin?'ADMIN ACCESS':'USER ACCESS'}</span></div></section>`
}

function renderApp(){
  if(state.view==='launcher') return app.innerHTML=`<div class="shell"><header class="topbar"><div class="brand">FINORA</div><span class="verified">● Session Active</span></header><main class="content">${renderLauncher()}</main></div>`
  if(state.view==='dapin') return app.innerHTML=`<div class="shell"><header class="topbar"><div class="brand">FINORA <span style="opacity:.45">×</span> DAPIN</div><div class="head-actions"><button class="ghost" data-view="launcher">← Apps</button><button id="logout" class="ghost">Keluar</button></div></header><main class="content">${renderDapin()}</main></div>`
  if(state.view==='admin' && isAdmin(state.user)) return app.innerHTML=`<div class="shell"><header class="topbar"><div class="brand">FINORA <span style="opacity:.45">•</span> ADMIN</div><div class="head-actions"><button class="ghost" data-view="launcher">← Apps</button><button id="logout" class="ghost">Keluar</button></div></header><main class="content">${renderAdmin()}</main></div>`
  const w=state.wallet||{available_balance:0,pending_balance:0}
  const nav=[['dashboard','Dashboard'],['topup','Top Up'],['withdraw','Tarik Dana'],['savings','Tabungan'],['security','Security']]
  app.innerHTML=`<div class="shell"><header class="topbar"><div class="brand">FINORA <span style="opacity:.45">×</span> WALLET</div><div class="head-actions"><button class="ghost" data-view="launcher">← Apps</button><span class="verified">● Wallet Active</span><button id="logout" class="ghost">Keluar</button></div></header><main class="content"><div class="welcome"><div><div class="eyebrow">FINORA WALLET</div><h1>Halo, ${escapeHtml(state.user.user_metadata?.full_name||state.user.email?.split('@')[0]||'Pengguna')}</h1><p class="muted">${escapeHtml(state.user.email||'')}</p></div><div class="quick"><button data-action="topup">＋ Top Up</button><button data-action="withdraw">↗ Tarik Dana</button></div></div><nav class="nav">${nav.map(([id,label])=>`<button class="navitem ${state.view===id?'active':''}" data-view="${id}">${label}</button>`).join('')}</nav>${state.error?`<div class="notice">${escapeHtml(state.error)}</div>`:''}${renderView()}</main></div>${state.modal?renderModal():''}`
}

function renderDapin(){return `<section class="dapin"><div class="dapin-hero"><div><div class="eyebrow">DAPIN BALONGBENDO</div><h1>Dashboard Simpan Pinjam</h1><p class="muted">Aplikasi DAPIN berjalan dalam session FINORA. Tidak perlu login ulang.</p></div><span class="dapin-badge">● Connected to FINORA</span></div><div class="dapin-stats"><article><span>Total Anggota</span><strong>128</strong><small>+8 bulan ini</small></article><article><span>Total Simpanan</span><strong>Rp 84,6 Jt</strong><small>Saldo aktif</small></article><article><span>Pinjaman Berjalan</span><strong>Rp 46,2 Jt</strong><small>32 rekening</small></article><article><span>Angsuran Jatuh Tempo</span><strong>7</strong><small>Perlu ditindaklanjuti</small></article></div><div class="dapin-grid"><section class="panel"><div class="panel-head"><div><div class="eyebrow">QUICK ACCESS</div><h2>Modul DAPIN</h2></div></div><div class="module-grid"><button><b>👥</b><strong>Anggota</strong><small>Data & status anggota</small></button><button><b>💰</b><strong>Simpanan</strong><small>Pokok, wajib & sukarela</small></button><button><b>📄</b><strong>Pinjaman</strong><small>Pengajuan & pencairan</small></button><button><b>📅</b><strong>Angsuran</strong><small>Jadwal & pembayaran</small></button><button><b>📊</b><strong>Transaksi</strong><small>Ledger DAPIN</small></button><button><b>📈</b><strong>Laporan</strong><small>Keuangan & aktivitas</small></button></div></section><section class="panel"><div class="panel-head"><div><div class="eyebrow">RECENT</div><h2>Aktivitas terbaru</h2></div></div><div class="tx-list"><div class="tx"><div><strong>Simpanan anggota</strong><small>Hari ini • 09:42</small></div><strong class="credit">+Rp 250.000</strong></div><div class="tx"><div><strong>Angsuran pinjaman</strong><small>Hari ini • 08:16</small></div><strong class="credit">+Rp 750.000</strong></div><div class="tx"><div><strong>Pencairan pinjaman</strong><small>Kemarin • 15:20</small></div><strong class="debit">-Rp 3.000.000</strong></div></div></section></div></section>`}

function renderAdmin(){return `<section class="admin"><div class="welcome"><div><div class="eyebrow">ADMIN CENTER</div><h1>Kontrol FINORA</h1><p class="muted">Akses administrator terverifikasi untuk akun yang telah diizinkan.</p></div><span class="pill">ADMIN VERIFIED</span></div><div class="admin-grid"><article class="stat"><span>Admin aktif</span><strong>2</strong><small>Whitelist email</small></article><article class="stat"><span>Payment</span><strong>Monitoring</strong><small>Midtrans / provider</small></article><article class="stat"><span>Wallet</span><strong>Protected</strong><small>RLS + ledger</small></article><article class="stat"><span>DAPIN</span><strong>Connected</strong><small>Single session</small></article></div><section class="panel"><div class="eyebrow">AUTHORIZED ADMINS</div><h2>Administrator FINORA</h2><div class="admin-list"><div><strong>panglimaa09@gmail.com</strong><span>ADMIN • ACTIVE</span></div><div><strong>deavani1705@gmail.com</strong><span>ADMIN • ACTIVE</span></div></div></section></section>`}

function renderView(){
  if(state.view==='topup')return `<section class="panel"><div class="panel-head"><div><div class="eyebrow">WALLET</div><h2>Isi saldo</h2></div><span class="pill">Payment protected</span></div><div class="form-grid"><label>Nominal<input id="topupAmount" inputmode="numeric" placeholder="100000" /></label><label>Metode<select id="topupMethod"><option value="qris">QRIS</option><option value="va">Virtual Account</option><option value="bank_transfer">Bank Transfer</option></select></label></div><button id="submitTopup" class="primary">Buat pembayaran</button><p class="tiny">Saldo hanya bertambah setelah provider mengonfirmasi pembayaran melalui webhook server yang terverifikasi.</p></section>`
  if(state.view==='withdraw')return `<section class="panel"><div class="panel-head"><div><div class="eyebrow">PAYOUT</div><h2>Tarik dana</h2></div><span class="pill">${money(state.wallet?.available_balance||0)} tersedia</span></div><div class="form-grid"><label>Nominal<input id="withdrawAmount" inputmode="numeric" placeholder="100000" /></label><label>Tujuan<select id="destinationType"><option value="bank">🏦 Bank</option><option value="ewallet">📱 Dompet Digital</option></select></label><label id="bankField">Pilih Bank<select id="bankCode"><option value="">Pilih bank</option>${BANKS.map(([code,name])=>`<option value="${code}">${escapeHtml(name)}</option>`).join('')}</select></label><label id="ewalletField" style="display:none">Pilih Dompet<select id="ewalletCode"><option value="">Pilih dompet digital</option>${E_WALLETS.map(([code,name])=>`<option value="${code}">${escapeHtml(name)}</option>`).join('')}</select></label><label id="accountNumberLabel">Nomor Rekening<input id="accountNumber" inputmode="numeric" placeholder="Nomor rekening / nomor HP" /></label><label>Nama Pemilik<input id="accountName" placeholder="Nama sesuai rekening / akun" /></label></div><button id="submitWithdraw" class="primary">Ajukan penarikan</button><p class="tiny">Pilih Bank atau Dompet Digital. Kode tujuan dikirim otomatis ke backend; kamu tidak perlu mengetik kode bank.</p></section>`
  if(state.view==='savings')return `<section class="panel saving-empty"><div class="save-icon">◈</div><h2>Tabungan</h2><p>Mesin target tabungan siap ditambahkan di atas wallet ledger FINORA.</p><button class="primary" data-action="topup">Mulai dari Top Up</button></section>`
  if(state.view==='security')return `<section class="panel"><div class="eyebrow">SECURITY CENTER</div><h2>Lapisan keamanan</h2><div class="security-grid"><div><strong>OAuth</strong><span>Aktif</span></div><div><strong>RLS</strong><span>Aktif</span></div><div><strong>Ledger</strong><span>Server-side</span></div><div><strong>Webhook</strong><span>Verified</span></div></div></section>`
  return `<section class="cards"><article class="wallet-card"><div class="card-top"><span>Available Balance</span><span class="chip">IDR</span></div><strong>${money(state.wallet?.available_balance||0)}</strong><div class="card-bottom"><span>Pending ${money(state.wallet?.pending_balance||0)}</span><span>FINORA WALLET</span></div></article><article class="stat"><span>Total transaksi</span><strong>${state.transactions.length}</strong><small>20 transaksi terbaru</small></article><article class="stat"><span>Status wallet</span><strong>Active</strong><small>RLS protected</small></article></section><section class="panel"><div class="panel-head"><div><div class="eyebrow">LEDGER</div><h2>Aktivitas terbaru</h2></div><button class="link" id="refreshWallet">Refresh</button></div>${renderTransactions()}</section>`
}

function renderTransactions(){
  if(!state.transactions.length)return `<div class="empty">Belum ada transaksi.</div>`
  return `<div class="tx-list">${state.transactions.map(t=>{const credit=['topup','transfer_in','refund','adjustment'].includes(t.type);const label=t.description||t.type||'Transaksi';return `<div class="tx"><div><strong>${escapeHtml(label)}</strong><small>${new Date(t.created_at).toLocaleString('id-ID')}</small></div><strong class="${credit?'credit':'debit'}">${credit?'+':'-'}${money(t.amount)}</strong></div>`}).join('')}</div>`
}

function renderModal(){return `<div class="modal-wrap"><div class="modal"><button class="close" id="closeModal">×</button>${state.modal}</div></div>`}

async function signIn(provider){state.error='';render();const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:window.location.origin}});if(error){state.error=error.message;render()}}

async function invokeFunction(name,body){
  const {data:{session}}=await supabase.auth.getSession()
  if(!session) throw new Error('Sesi login sudah berakhir. Silakan login kembali.')
  const {data,error}=await supabase.functions.invoke(name,{body,headers:{Authorization:`Bearer ${session.access_token}`}})
  if(error){let detail=error.message||'Permintaan ke Edge Function gagal.';try{const response=error.context;if(response&&typeof response.text==='function'){const text=await response.text();if(text){try{const parsed=JSON.parse(text);detail=parsed.message||parsed.error||parsed.msg||text}catch{detail=text}}}}catch{}throw new Error(`Edge Function "${name}" gagal: ${detail}`)}
  if(data?.error) throw new Error(data.error)
  return data
}

async function doTopup(){
  const amount=Number(document.getElementById('topupAmount').value),method=document.getElementById('topupMethod').value
  if(!Number.isFinite(amount)||amount<10000){alert('Minimum top up Rp10.000');return}
  try{
    const data=await invokeFunction('provider-create-topup',{amount,method})
    const paymentUrl=safeUrl(data.payment_url)
    state.modal=`<h2>Pembayaran dibuat</h2><p>Top Up ${money(amount)} sudah dibuat dengan status <strong>pending</strong>.</p>${paymentUrl?`<a class="primary" href="${escapeHtml(paymentUrl)}" target="_blank" rel="noopener noreferrer">Lanjut ke pembayaran Midtrans</a>`:'<p class="hint">Instruksi pembayaran belum tersedia. Periksa konfigurasi payment provider.</p>'}<span class="hint">Saldo hanya bertambah setelah Midtrans mengirim notifikasi settlement yang lolos verifikasi signature.</span>`
    await loadWallet();render()
  }catch(err){alert(err.message)}
}

function syncDestinationFields(){
  const type=document.getElementById('destinationType')?.value
  const bankField=document.getElementById('bankField'),ewalletField=document.getElementById('ewalletField'),accountNumber=document.getElementById('accountNumber')
  if(!bankField||!ewalletField)return
  const isEwallet=type==='ewallet'
  bankField.style.display=isEwallet?'none':''
  ewalletField.style.display=isEwallet?'':'none'
  if(accountNumber)accountNumber.placeholder=isEwallet?'Nomor HP / nomor akun e-wallet':'Nomor rekening bank'
}

async function doWithdraw(){
  const amount=Number(document.getElementById('withdrawAmount').value),type=document.getElementById('destinationType').value
  const bank_code=type==='bank'?document.getElementById('bankCode').value.trim():document.getElementById('ewalletCode').value.trim()
  const account_number=document.getElementById('accountNumber').value.trim(),account_name=document.getElementById('accountName').value.trim()
  if(!Number.isFinite(amount)||amount<=0||!bank_code||!account_number||!account_name){alert('Lengkapi nominal, tujuan, nomor rekening/HP, dan nama pemilik.');return}
  try{const data=await invokeFunction('create-withdrawal',{amount,bank_code,account_number,account_name,destination_type:type});await loadWallet();state.modal=`<h2>Penarikan dibuat</h2><p>ID withdrawal: ${escapeHtml(data.withdrawal_id||'—')}</p><span class="hint">Tujuan: ${type==='ewallet'?'Dompet Digital':'Bank'}. Penarikan menunggu payout provider.</span>`;render()}catch(err){alert(err.message)}
}

document.addEventListener('change',e=>{if(e.target?.id==='destinationType')syncDestinationFields()})
document.addEventListener('click',async e=>{
  const btn=e.target.closest('button');if(!btn)return
  if(btn.dataset.provider)return signIn(btn.dataset.provider)
  if(btn.id==='logout'){await supabase.auth.signOut();return}
  if(btn.id==='closeModal'){state.modal=null;render();return}
  if(btn.id==='refreshWallet'){state.error='';await loadWallet();render();return}
  if(btn.dataset.view){state.view=btn.dataset.view;state.error='';if(state.view==='dashboard'||state.view==='topup'||state.view==='withdraw'||state.view==='savings'||state.view==='security')await loadWallet();render();return}
  if(btn.dataset.action){state.view=btn.dataset.action;state.error='';render();return}
  if(btn.id==='submitTopup')return doTopup()
  if(btn.id==='submitWithdraw')return doWithdraw()
})

if(configured){
  supabase.auth.onAuthStateChange(async(_event,session)=>{state.user=session?.user||null;if(state.user)await loadWallet();else{state.wallet=null;state.transactions=[]}state.loading=false;state.view=state.user?'launcher':'dashboard';render()})
  ;(async()=>{const {data:{session}}=await supabase.auth.getSession();state.user=session?.user||null;if(state.user)await loadWallet();state.loading=false;state.view=state.user?'launcher':'dashboard';render()})()
}else{state.loading=false;render()}
