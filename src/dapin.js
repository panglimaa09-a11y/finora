import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

const rupiah=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const uid=()=>crypto.randomUUID()
const blank={members:[],savings:[],loans:[],payments:[],transactions:[],view:'dashboard'}
let db={...blank}
let currentUser=null
let ready=false
let loadingPromise=null

const isAdmin=()=>['admin','super_admin'].includes(String(currentUser?.app_metadata?.role||currentUser?.user_metadata?.role||'').toLowerCase()) || ['panglimaa09@gmail.com','deavani1705@gmail.com'].includes(String(currentUser?.email||'').toLowerCase())
const ownMembers=()=>db.members.filter(m=>m.user_id===currentUser?.id)
const total=a=>a.reduce((s,x)=>s+Number(x.amount||0),0)
const memberName=id=>db.members.find(m=>m.id===id)?.name||'Anggota'
const activeLoans=a=>a.filter(x=>Number(x.amount||0)>Number(x.paid||0))
const outstanding=a=>total(activeLoans(a).map(x=>({amount:Number(x.amount)-Number(x.paid||0)})))

export async function initDapin(user=currentUser){
  currentUser=user||null
  if(!supabase||!currentUser){db={...blank};ready=false;return}
  if(ready) return db
  if(loadingPromise) return loadingPromise
  loadingPromise=(async()=>{
    const results=await Promise.all([
      supabase.from('dapin_members').select('*').order('created_at',{ascending:false}),
      supabase.from('dapin_savings').select('*').order('created_at',{ascending:false}),
      supabase.from('dapin_loans').select('*').order('created_at',{ascending:false}),
      supabase.from('dapin_loan_payments').select('*').order('created_at',{ascending:false}),
      supabase.from('dapin_transactions').select('*').order('created_at',{ascending:false}),
    ])
    const failed=results.find(r=>r.error)
    if(failed?.error) throw failed.error
    db={...blank,members:results[0].data||[],savings:results[1].data||[],loans:results[2].data||[],payments:results[3].data||[],transactions:results[4].data||[]}
    ready=true
    return db
  })().finally(()=>{loadingPromise=null})
  return loadingPromise
}

async function ensureLoaded(){ if(!ready && currentUser) await initDapin(currentUser) }
async function rpc(fn,args){
  if(!supabase) throw new Error('Supabase environment belum tersedia.')
  const {data,error}=await supabase.rpc(fn,args)
  if(error) throw new Error(error.message)
  return data
}
function setLocal(row,collection){ const i=db[collection].findIndex(x=>x.id===row.id); if(i>=0) db[collection][i]=row; else db[collection].unshift(row) }
function modalForm(title,fields,action){ return `<div class="dapin-modal-wrap"><div class="dapin-modal"><button class="dapin-modal-close" data-dapin-close>×</button><div class="eyebrow">DAPIN</div><h2>${title}</h2><form data-dapin-form="${action}">${fields.map(f=>`<label>${f.label}${f.html||`<input name="${f.name}" ${f.required!==false?'required':''} ${f.type?`type="${f.type}"`:''} placeholder="${f.placeholder||''}">`}</label>`).join('')}<button class="dapin-primary" type="submit">Simpan</button></form></div></div>` }

export function setDapinView(view){ db.view=view||'dashboard'; return db.view }
export function getDapinState(){ return db }

export function renderDapin(){
  const admin=isAdmin()
  let v=db.view||'dashboard'
  const allowed=admin?['dashboard','anggota','simpanan','pinjaman','angsuran','transaksi','laporan']:['dashboard','simpanan','pinjaman','angsuran','transaksi','profil']
  if(!allowed.includes(v)) v='dashboard'
  const pages=admin?{dashboard:adminDashboard,anggota:members,simpanan:adminSavings,pinjaman:adminLoans,angsuran:adminPayments,transaksi:adminTransactions,laporan:reports}:{dashboard:memberDashboard,simpanan:memberSavings,pinjaman:memberLoans,angsuran:memberPayments,transaksi:memberTransactions,profil:profile}
  return `<section class="dapin-app ${admin?'dapin-admin-panel':'dapin-member-panel'}"><div class="dapin-main"><div class="dapin-mobile-head"><strong>DAPIN ${admin?'ADMIN':'ANGGOTA'}</strong></div>${pages[v]?pages[v]():pages.dashboard()}</div></section>`
}
function header(k,t,d,a=''){return `<div class="dapin-page-head"><div><div class="eyebrow">${k}</div><h1>${t}</h1><p>${d}</p></div>${a}</div>`}
function statCard(label,value,meta='',cls=''){return `<article class="dapin-stat ${cls}"><span>${label}</span><strong>${value}</strong><small>${meta}</small></article>`}
function action(title,desc,icon,view,cls=''){return `<button class="dapin-action-card ${cls}" data-dapin-view="${view}"><b>${icon}</b><span><strong>${title}</strong><small>${desc}</small></span><em>›</em></button>`}
function panel(title,body,extra=''){return `<section class="dapin-panel ${extra}"><div class="dapin-panel-head"><div><span>DAPIN</span><h2>${title}</h2></div></div>${body}</section>`}
function toolbar(left,right=''){return `<div class="dapin-toolbar">${left}${right}</div>`}

function adminDashboard(){
 const saving=total(db.savings),loans=total(db.loans),paid=total(db.payments)
 return header('ADMIN COMMAND CENTER','Dashboard Admin','Pusat kendali operasional DAPIN.','<button class="dapin-primary" data-dapin-action="add-member">＋ Anggota Baru</button>')+
 `<div class="dapin-stat-grid dashboard-stats">${statCard('ANGGOTA',db.members.length,'Data terdaftar','purple')}${statCard('TOTAL SIMPANAN',rupiah(saving),'Akumulasi simpanan','green')}${statCard('PIUTANG BERJALAN',rupiah(outstanding(db.loans)),'Sisa pinjaman aktif','orange')}${statCard('ANGSURAN MASUK',rupiah(paid),'Total pembayaran','cyan')}</div>`+
 `<div class="dapin-dashboard-grid"><div>${panel('Pusat Modul',`<div class="dapin-action-grid">${action('Anggota','Data master anggota','♙','anggota','blue')}${action('Simpanan','Pokok, wajib, sukarela','◈','simpanan','green')}${action('Pinjaman','Pengajuan dan kredit','▣','pinjaman','orange')}${action('Angsuran','Jadwal dan pembayaran','◷','angsuran','purple')}${action('Transaksi','Buku kas / ledger','↔','transaksi','cyan')}${action('Laporan','Analitik dan cetak','▥','laporan','pink')}</div>`)}</div><div>${panel('Ringkasan Kas',`<div class="cash-board"><div><span>Total masuk</span><strong>${rupiah(saving+paid)}</strong></div><div><span>Total pinjaman</span><strong>${rupiah(loans)}</strong></div><div><span>Saldo operasional*</span><strong>${rupiah(saving+paid-loans)}</strong></div><small>*Ringkasan internal berdasarkan data DAPIN.</small></div>`)}</div></div>`+
 panel('Aktivitas Terakhir',db.transactions.length?`<div class="dapin-activity">${db.transactions.slice(0,6).map(t=>`<div><span class="activity-dot ${t.direction==='out'?'out':'in'}">${t.direction==='out'?'↑':'↓'}</span><span><strong>${esc(t.label||'Transaksi')}</strong><small>${new Date(t.created_at).toLocaleString('id-ID')}</small></span><b class="${t.direction==='out'?'money-out':'money-in'}">${t.direction==='out'?'-':'+'}${rupiah(t.amount)}</b></div>`).join('')}</div>`:'<div class="dapin-empty">Belum ada aktivitas.</div>')
}
function memberDashboard(){const ms=ownMembers(),ids=new Set(ms.map(m=>m.id)),sv=db.savings.filter(x=>ids.has(x.member_id)),ln=db.loans.filter(x=>ids.has(x.member_id)),pay=db.payments.filter(x=>ids.has(x.member_id));return header('PORTAL ANGGOTA','Dashboard Saya','Ringkasan simpanan, pinjaman, dan angsuran Anda.')+`<div class="dapin-stat-grid">${statCard('SIMPANAN',rupiah(total(sv)),'Saldo tercatat','green')}${statCard('SISA PINJAMAN',rupiah(outstanding(ln)),'Kewajiban berjalan','orange')}${statCard('ANGSURAN',rupiah(total(pay)),'Pembayaran tercatat','purple')}${statCard('STATUS','Aktif','Keanggotaan','cyan')}</div>`+panel('Akses Cepat',`<div class="dapin-action-grid">${action('Simpanan Saya','Riwayat simpanan','◈','simpanan','green')}${action('Pinjaman Saya','Saldo dan tenor','▣','pinjaman','orange')}${action('Angsuran','Pembayaran','◷','angsuran','purple')}${action('Riwayat Transaksi','Aktivitas akun','↔','transaksi','cyan')}</div>`) }

function members(){return header('DATA MASTER','Anggota','Data anggota tersimpan terpusat di Supabase.','<button class="dapin-primary" data-dapin-action="add-member">＋ Tambah Anggota</button>')+`<div class="dapin-stat-grid compact">${statCard('TOTAL',db.members.length,'Semua anggota','blue')}${statCard('AKTIF',db.members.filter(m=>m.status==='active').length,'Status aktif','green')}${statCard('DENGAN PINJAMAN',new Set(db.loans.filter(x=>Number(x.amount)>Number(x.paid||0)).map(x=>x.member_id)).size,'Pinjaman berjalan','orange')}</div>`+panel('Data Master Anggota',toolbar(`<input class="dapin-search" data-member-search placeholder="Cari nama, email, nomor anggota…">`,`<span>${db.members.length} anggota</span>`)+`<div class="dapin-member-list">${db.members.length?db.members.map(m=>`<article class="member-row" data-member-search-row><div class="member-avatar">${esc((m.name||'A').charAt(0).toUpperCase())}</div><div class="member-main"><strong>${esc(m.name)}</strong><small>${esc(m.display_id||m.code||'-')} • ${esc(m.email||'-')}</small></div><div class="member-meta"><span>${esc(m.phone||'-')}</span><span class="status ${m.status==='active'?'active':'warning'}">${esc(m.status||'active')}</span></div><button class="table-action" data-dapin-action="set-member-status" data-id="${m.id}" data-status="${m.status==='active'?'inactive':'active'}">${m.status==='active'?'Nonaktifkan':'Aktifkan'}</button></article>`).join(''):'<div class="table-empty">Belum ada anggota.</div>'}</div>`,'members-workspace')}

function adminSavings(){const pokok=total(db.savings.filter(x=>x.type==='Simpanan Pokok')),wajib=total(db.savings.filter(x=>x.type==='Simpanan Wajib')),sukarela=total(db.savings.filter(x=>x.type==='Simpanan Sukarela'));return header('FINANCIAL DEPOSITS','Simpanan','Kelola pokok, wajib, sukarela, dan histori setoran.','<button class="dapin-primary" data-dapin-action="add-saving">＋ Catat Simpanan</button>')+`<div class="dapin-deposit-grid"><div><span>POKOK</span><strong>${rupiah(pokok)}</strong></div><div><span>WAJIB</span><strong>${rupiah(wajib)}</strong></div><div><span>SUKARELA</span><strong>${rupiah(sukarela)}</strong></div></div>`+panel('Histori Setoran',tableSavings(db.savings),'savings-workspace')}
function memberSavings(){const ids=new Set(ownMembers().map(m=>m.id));return header('KEUANGAN','Simpanan Saya','Riwayat simpanan akun Anda.')+tableSavings(db.savings.filter(x=>ids.has(x.member_id)))}
function tableSavings(rows){return `<div class="dapin-table-wrap"><table><thead><tr><th>ID</th><th>Tanggal</th><th>Anggota</th><th>Jenis</th><th>Nominal</th><th>Keterangan</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td>${esc(x.display_id||'-')}</td><td>${new Date(x.created_at).toLocaleDateString('id-ID')}</td><td><b>${esc(x.member_name||memberName(x.member_id))}</b></td><td><span class="type-chip">${esc(x.type)}</span></td><td class="money-in"><strong>+${rupiah(x.amount)}</strong></td><td>${esc(x.note||'-')}</td></tr>`).join(''):'<tr><td colspan="6" class="table-empty">Belum ada data simpanan.</td></tr>'}</tbody></table></div>`}

function adminLoans(){const active=db.loans.filter(x=>Number(x.amount)>Number(x.paid||0)),paid=db.loans.filter(x=>Number(x.amount)<=Number(x.paid||0));return header('CREDIT WORKSPACE','Pinjaman','Kelola pengajuan, plafon, tenor, dan status kredit.','<button class="dapin-primary" data-dapin-action="add-loan">＋ Pinjaman Baru</button>')+`<div class="loan-pipeline"><div><span>DIAJUKAN</span><strong>${db.loans.filter(x=>x.status==='submitted').length}</strong></div><div><span>BERJALAN</span><strong>${active.length}</strong></div><div><span>LUNAS</span><strong>${paid.length}</strong></div><div><span>OUTSTANDING</span><strong>${rupiah(outstanding(db.loans))}</strong></div></div>`+panel('Portofolio Pinjaman',tableLoans(db.loans),'loan-workspace')}
function memberLoans(){const ids=new Set(ownMembers().map(m=>m.id));return header('KREDIT','Pinjaman Saya','Lihat pinjaman dan sisa kewajiban Anda.')+tableLoans(db.loans.filter(x=>ids.has(x.member_id)))}
function tableLoans(rows){return `<div class="dapin-table-wrap"><table class="loan-table"><thead><tr><th>ID</th><th>Anggota</th><th>Pokok</th><th>Tenor</th><th>Terbayar</th><th>Sisa</th><th>Status</th></tr></thead><tbody>${rows.length?rows.map(x=>{const s=Math.max(0,Number(x.amount)-Number(x.paid||0));return `<tr><td>${esc(x.display_id||'-')}</td><td><b>${esc(x.member_name||memberName(x.member_id))}</b></td><td>${rupiah(x.amount)}</td><td><span class="tenor-chip">${x.tenor} bln</span></td><td>${rupiah(x.paid)}</td><td><strong>${rupiah(s)}</strong></td><td><span class="status ${s?'warning':'active'}">${esc(x.status||'active')}</span></td></tr>`}).join(''):'<tr><td colspan="7" class="table-empty">Belum ada pinjaman.</td></tr>'}</tbody></table></div>`}
function adminPayments(){const due=db.loans.filter(x=>Number(x.amount)>Number(x.paid||0)).length;return header('COLLECTION','Angsuran','Pembayaran angsuran dan monitoring penagihan.','<button class="dapin-primary" data-dapin-action="add-payment">＋ Catat Pembayaran</button>')+`<div class="collection-board"><div><span>PINJAMAN BERJALAN</span><strong>${due}</strong></div><div><span>PEMBAYARAN TERKUMPUL</span><strong>${rupiah(total(db.payments))}</strong></div><div><span>STATUS</span><strong>${due?'Perlu monitoring':'Stabil'}</strong></div></div>`+panel('Daftar Pembayaran',tablePayments(db.payments),'payments-workspace')}
function memberPayments(){const ids=new Set(ownMembers().map(m=>m.id));return header('PENAGIHAN','Angsuran Saya','Riwayat pembayaran angsuran Anda.')+tablePayments(db.payments.filter(x=>ids.has(x.member_id)))}
function tablePayments(rows){return `<div class="dapin-payment-list">${rows.length?rows.map(x=>`<article><div class="payment-icon">✓</div><div><strong>${esc(x.display_id||'-')} • ${esc(x.member_name||memberName(x.member_id))}</strong><small>${new Date(x.created_at).toLocaleDateString('id-ID')} • ${esc(x.method||'Tunai')}</small></div><b class="money-in">+${rupiah(x.amount)}</b></article>`).join(''):'<div class="table-empty">Belum ada pembayaran.</div>'}</div>`}

function adminTransactions(){return header('LEDGER','Transaksi','Buku transaksi DAPIN dari database terpusat.','<button class="dapin-primary" data-dapin-action="add-transaction">＋ Transaksi</button>')+panel('Buku Transaksi',`<div class="dapin-table-wrap"><table><thead><tr><th>ID</th><th>Waktu</th><th>Label</th><th>Anggota</th><th>Arah</th><th>Nominal</th></tr></thead><tbody>${db.transactions.length?db.transactions.map(x=>`<tr><td>${esc(x.display_id||'-')}</td><td>${new Date(x.created_at).toLocaleString('id-ID')}</td><td>${esc(x.label)}</td><td>${esc(memberCode(x.member_id))}</td><td>${esc(x.direction)}</td><td class="${x.direction==='out'?'money-out':'money-in'}"><strong>${x.direction==='out'?'-':'+'}${rupiah(x.amount)}</strong></td></tr>`).join(''):'<tr><td colspan="6" class="table-empty">Belum ada transaksi.</td></tr>'}</tbody></table></div>`)}
function memberTransactions(){const ids=new Set(ownMembers().map(m=>m.id));return header('AKTIVITAS','Riwayat Transaksi','Riwayat transaksi anggota.')+panel('Transaksi Saya',`<div class="dapin-table-wrap"><table><thead><tr><th>ID</th><th>Waktu</th><th>Label</th><th>Arah</th><th>Nominal</th></tr></thead><tbody>${db.transactions.filter(x=>ids.has(x.member_id)).map(x=>`<tr><td>${esc(x.display_id||'-')}</td><td>${new Date(x.created_at).toLocaleString('id-ID')}</td><td>${esc(x.label)}</td><td>${esc(x.direction)}</td><td>${x.direction==='out'?'-':'+'}${rupiah(x.amount)}</td></tr>`).join('')||'<tr><td colspan="5" class="table-empty">Belum ada transaksi.</td></tr>'}</tbody></table></div>`)}
function memberCode(id){const m=db.members.find(x=>x.id===id);return m?.display_id||m?.code||'-'}

function reports(){const incoming=total(db.savings)+total(db.payments),out=total(db.loans);return header('REPORTING','Laporan DAPIN','Ringkasan data terpusat untuk pengawasan administrator.','<button class="dapin-secondary" data-dapin-action="refresh">↻ Refresh Data</button>')+`<div class="dapin-stat-grid">${statCard('ANGGOTA',db.members.length,'Master anggota','blue')}${statCard('MASUK',rupiah(incoming),'Simpanan + angsuran','green')}${statCard('KELUAR',rupiah(out),'Total pencairan','orange')}${statCard('BERSIH',rupiah(incoming-out),'Ringkasan DAPIN','purple')}</div>`+panel('Status Data',`<div class="dapin-report-grid"><div><span>Simpanan</span><strong>${db.savings.length} record</strong></div><div><span>Pinjaman</span><strong>${db.loans.length} record</strong></div><div><span>Angsuran</span><strong>${db.payments.length} record</strong></div><div><span>Transaksi</span><strong>${db.transactions.length} record</strong></div></div>`)}
function profile(){const m=ownMembers()[0];return header('PROFIL ANGGOTA','Profil Saya','Data profil anggota DAPIN Anda.')+panel('Informasi Anggota',m?`<div class="dapin-report-grid"><div><span>ID</span><strong>${esc(m.display_id||m.code)}</strong></div><div><span>Nama</span><strong>${esc(m.name)}</strong></div><div><span>WhatsApp</span><strong>${esc(m.phone||'-')}</strong></div><div><span>Status</span><strong>${esc(m.status||'active')}</strong></div></div>`:'<div class="dapin-empty">Akun belum terhubung ke anggota DAPIN.</div>')}

export function openDapinModal(type){
  const memberOpts=db.members.map(m=>`<option value="${m.id}">${esc(m.display_id||m.code)} — ${esc(m.name)}</option>`).join('')
  if(type==='add-member') return modalForm('Tambah Anggota',[
    {label:'Nama lengkap',name:'name',placeholder:'Nama lengkap'},
    {label:'Email',name:'email',type:'email',required:false,placeholder:'email@contoh.com'},
    {label:'Nomor WhatsApp',name:'phone',required:false,placeholder:'08xxxxxxxxxx'},
    {label:'Alamat',name:'address',required:false,placeholder:'Alamat lengkap'},
    {label:'NIK / KTP',name:'nik',required:false,placeholder:'16 digit'},
    {label:'No. KK',name:'kk_number',required:false,placeholder:'16 digit'},
    {label:'Tempat lahir',name:'birth_place',required:false,placeholder:'Kota'},
    {label:'Tanggal lahir',name:'birth_date',type:'date',required:false},
    {label:'Pekerjaan',name:'occupation',required:false,placeholder:'Pekerjaan'},
  ],'add-member')
  if(type==='add-saving') return modalForm('Catat Simpanan',[{label:'Anggota',html:`<select name="member_id" required>${memberOpts}</select>`},{label:'Jenis',html:`<select name="type"><option>Simpanan Pokok</option><option>Simpanan Wajib</option><option>Simpanan Sukarela</option></select>`},{label:'Nominal',name:'amount',type:'number',placeholder:'100000'},{label:'Keterangan',name:'note',required:false}], 'add-saving')
  if(type==='add-loan') return modalForm('Pinjaman Baru',[{label:'Anggota',html:`<select name="member_id" required>${memberOpts}</select>`},{label:'Nominal',name:'amount',type:'number',placeholder:'5000000'},{label:'Tenor (bulan)',name:'tenor',type:'number',placeholder:'12'},{label:'Status',html:`<select name="status"><option value="submitted">Diajukan</option><option value="approved">Disetujui</option><option value="active">Berjalan</option></select>`},{label:'Keterangan',name:'note',required:false}], 'add-loan')
  if(type==='add-payment') return modalForm('Catat Angsuran',[{label:'Pinjaman',html:`<select name="loan_id" required>${db.loans.filter(l=>outstanding([l])>0).map(l=>`<option value="${l.id}">${esc(l.display_id||'')} — ${esc(memberCode(l.member_id))} — sisa ${rupiah(outstanding([l]))}</option>`).join('')}</select>`},{label:'Nominal',name:'amount',type:'number',placeholder:'500000'},{label:'Metode',html:`<select name="method"><option>Tunai</option><option>Transfer</option><option>QRIS</option></select>`},{label:'Keterangan',name:'note',required:false}], 'add-payment')
  if(type==='add-transaction') return modalForm('Catat Transaksi',[{label:'Label',name:'label',placeholder:'Setoran / biaya / koreksi'},{label:'Nominal',name:'amount',type:'number',placeholder:'100000'},{label:'Arah',html:`<select name="direction"><option value="in">Masuk</option><option value="out">Keluar</option></select>`},{label:'Anggota',html:`<select name="member_id"><option value="">Tanpa anggota</option>${memberOpts}</select>`},{label:'Keterangan',name:'note',required:false}], 'add-transaction')
  return ''
}

export async function handleDapinAction(type,values){
  await ensureLoaded()
  if(type==='refresh'){ ready=false; await initDapin(currentUser); return }
  if(type==='add-member'){
    const row=await rpc('dapin_create_member',{p_name:values.name,p_email:values.email||null,p_phone:values.phone||null,p_address:values.address||null,p_joined_at:new Date().toISOString(),p_nik:values.nik||null,p_kk_number:values.kk_number||null,p_birth_place:values.birth_place||null,p_birth_date:values.birth_date||null,p_gender:values.gender||null,p_occupation:values.occupation||null,p_marital_status:values.marital_status||null})
    setLocal(row,'members'); return
  }
  if(type==='add-saving'){const row=await rpc('dapin_record_saving',{p_member_id:values.member_id,p_type:values.type,p_amount:Number(values.amount),p_note:values.note||null});setLocal(row,'savings');return}
  if(type==='add-loan'){const row=await rpc('dapin_create_loan',{p_member_id:values.member_id,p_amount:Number(values.amount),p_tenor:Number(values.tenor),p_status:values.status,p_note:values.note||null});setLocal(row,'loans');return}
  if(type==='add-payment'){const row=await rpc('dapin_record_payment',{p_loan_id:values.loan_id,p_amount:Number(values.amount),p_method:values.method,p_note:values.note||null});setLocal(row,'payments');const loan=db.loans.find(x=>x.id===values.loan_id);if(loan){loan.paid=Number(loan.paid||0)+Number(values.amount);if(loan.paid>=Number(loan.amount))loan.status='lunas'}return}
  if(type==='add-transaction'){const row=await rpc('dapin_record_transaction',{p_label:values.label,p_amount:Number(values.amount),p_direction:values.direction,p_member_id:values.member_id||null,p_reference_type:null,p_reference_id:null,p_note:values.note||null});setLocal(row,'transactions');return}
  if(type==='set-member-status'){const row=await rpc('dapin_set_member_status',{p_member_id:values.id,p_status:values.status});setLocal(row,'members');return}
  throw new Error(`Aksi DAPIN tidak dikenal: ${type}`)
}

export async function deleteMember(id){return handleDapinAction('set-member-status',{id,status:'inactive'})}

export function bindDapinSearch(root=document){ root.querySelector('[data-member-search]')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();root.querySelectorAll('[data-member-search-row]').forEach(r=>{r.hidden=!r.textContent.toLowerCase().includes(q)})}) }
