import './admin-center.css'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const wa = phone => { const p=String(phone||'').replace(/\D/g,''); if(!p) return ''; const n=p.startsWith('0')?'62'+p.slice(1):p.startsWith('62')?p:p; return n.length>=10?`https://wa.me/${n}`:'' }

let activeTab='overview'
let cache={members:[],savings:[],loans:[],payments:[],transactions:[],audit:[],security:[],profiles:[]}
let loading=false
let error=''

function root(){ return document.querySelector('.admin-badge')?.closest('.page') || document.querySelector('.page') }
function isAdminPage(){ const r=root(); return !!r && (r.querySelector('h1')?.textContent?.trim()==='Administration' || r.querySelector('.finora-admin-page')) }
function tabButton(id,label){ return `<button class="ac-tab ${activeTab===id?'active':''}" data-ac-tab="${id}">${label}</button>` }
function stat(label,value,meta){ return `<article class="ac-card"><span>${label}</span><strong>${value}</strong><small>${meta}</small></article>` }
function statusPill(text,warn=false){ return `<span class="ac-pill ${warn?'ac-warn':''}">${text}</span>` }

async function loadData(){
  if(!supabase) throw new Error('Supabase environment belum tersedia.')
  const tasks=[
    supabase.from('dapin_members').select('*').order('created_at',{ascending:false}),
    supabase.from('dapin_savings').select('*').order('created_at',{ascending:false}),
    supabase.from('dapin_loans').select('*').order('created_at',{ascending:false}),
    supabase.from('dapin_loan_payments').select('*').order('created_at',{ascending:false}),
    supabase.from('dapin_transactions').select('*').order('created_at',{ascending:false}),
    supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(50),
    supabase.from('security_events').select('*').order('created_at',{ascending:false}).limit(50),
    supabase.from('profiles').select('id,full_name,role,created_at,updated_at').order('created_at',{ascending:false}),
  ]
  const results=await Promise.all(tasks)
  const failed=results.find(r=>r.error)
  if(failed?.error) throw new Error(failed.error.message)
  cache={members:results[0].data||[],savings:results[1].data||[],loans:results[2].data||[],payments:results[3].data||[],transactions:results[4].data||[],audit:results[5].data||[],security:results[6].data||[],profiles:results[7].data||[]}
}

function memberName(id){ return cache.members.find(m=>m.id===id)?.name||'Anggota' }
function memberCode(id){ const m=cache.members.find(x=>x.id===id); return m?.display_id||m?.code||'-' }
function total(a){ return a.reduce((s,x)=>s+Number(x.amount||0),0) }
function outstanding(x){ return Math.max(0,Number(x.amount||0)-Number(x.paid||0)) }
function toast(msg,ok=true){ const el=document.createElement('div'); el.className=`ac-toast ${ok?'ok':'bad'}`; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),2600) }

async function rpc(fn,args){
  if(!supabase) throw new Error('Supabase belum siap.')
  const {data,error}=await supabase.rpc(fn,args)
  if(error) throw new Error(error.message)
  return data
}

async function saveMember(){
  const name=document.getElementById('acMemberName')?.value.trim(); const email=document.getElementById('acMemberEmail')?.value.trim(); const phone=document.getElementById('acMemberPhone')?.value.trim(); const address=document.getElementById('acMemberAddress')?.value.trim()
  if(!name) return toast('Nama anggota wajib diisi.',false)
  try{ const m=await rpc('dapin_create_member',{p_name:name,p_email:email||null,p_phone:phone||null,p_address:address||null,p_joined_at:new Date().toISOString()}); cache.members.unshift(m); render(); toast(`Anggota ${m.display_id||m.code||''} berhasil dibuat.`) }catch(e){toast(e.message,false)}
}
async function saveSaving(){
  const member_id=document.getElementById('acSavingMember')?.value; const type=document.getElementById('acSavingType')?.value; const amount=Number(document.getElementById('acSavingAmount')?.value); const note=document.getElementById('acSavingNote')?.value.trim()
  if(!member_id||!Number.isFinite(amount)||amount<=0) return toast('Anggota dan nominal simpanan wajib diisi.',false)
  try{ await rpc('dapin_record_saving',{p_member_id:member_id,p_type:type,p_amount:amount,p_note:note||null}); await refresh(); toast('Simpanan berhasil dicatat.') }catch(e){toast(e.message,false)}
}
async function saveLoan(){
  const member_id=document.getElementById('acLoanMember')?.value; const amount=Number(document.getElementById('acLoanAmount')?.value); const tenor=Number(document.getElementById('acLoanTenor')?.value); const status=document.getElementById('acLoanStatus')?.value; const note=document.getElementById('acLoanNote')?.value.trim()
  if(!member_id||!Number.isFinite(amount)||amount<=0||!Number.isInteger(tenor)||tenor<=0) return toast('Data pinjaman belum lengkap.',false)
  try{ await rpc('dapin_create_loan',{p_member_id:member_id,p_amount:amount,p_tenor:tenor,p_status:status,p_note:note||null}); await refresh(); toast('Pinjaman berhasil dibuat.') }catch(e){toast(e.message,false)}
}
async function savePayment(){
  const loan_id=document.getElementById('acPaymentLoan')?.value; const amount=Number(document.getElementById('acPaymentAmount')?.value); const method=document.getElementById('acPaymentMethod')?.value; const note=document.getElementById('acPaymentNote')?.value.trim()
  if(!loan_id||!Number.isFinite(amount)||amount<=0) return toast('Pinjaman dan nominal pembayaran wajib diisi.',false)
  try{ await rpc('dapin_record_payment',{p_loan_id:loan_id,p_amount:amount,p_method:method,p_note:note||null}); await refresh(); toast('Pembayaran angsuran berhasil dicatat.') }catch(e){toast(e.message,false)}
}
async function saveTransaction(){
  const label=document.getElementById('acTxLabel')?.value.trim(); const amount=Number(document.getElementById('acTxAmount')?.value); const direction=document.getElementById('acTxDirection')?.value; const member_id=document.getElementById('acTxMember')?.value||null; const note=document.getElementById('acTxNote')?.value.trim()
  if(!label||!Number.isFinite(amount)||amount<=0) return toast('Label dan nominal transaksi wajib diisi.',false)
  try{ await rpc('dapin_record_transaction',{p_label:label,p_amount:amount,p_direction:direction,p_member_id:member_id,p_reference_type:null,p_reference_id:null,p_note:note||null}); await refresh(); toast('Transaksi berhasil dicatat.') }catch(e){toast(e.message,false)}
}

function memberRows(){
  if(!cache.members.length) return `<div class="ac-empty">Belum ada anggota di database DAPIN.</div>`
  return cache.members.map(m=>{ const link=wa(m.phone); return `<div class="ac-table-row"><div class="ac-primary-cell"><div class="ac-avatar">${esc((m.name||'A')[0].toUpperCase())}</div><span><strong>${esc(m.name)}</strong><small>${esc(m.display_id||m.code||'-')}</small></span></div><span>${esc(m.email||'-')}</span><span>${link?`<a class="ac-wa" target="_blank" rel="noreferrer" href="${link}">${esc(m.phone)} ↗</a>`:esc(m.phone||'-')}</span><span>${statusPill(m.status||'active')}</span><span>${new Date(m.joined_at||m.created_at).toLocaleDateString('id-ID')}</span></div>` }).join('')
}
function savingsRows(){ return cache.savings.length?cache.savings.slice(0,50).map(s=>`<div class="ac-table-row"><span>${esc(s.display_id||'-')}</span><span>${esc(memberCode(s.member_id))}</span><span>${esc(s.type)}</span><span class="money-in">+${money(s.amount)}</span><span>${new Date(s.created_at).toLocaleString('id-ID')}</span></div>`).join(''):`<div class="ac-empty">Belum ada simpanan.</div>` }
function loanRows(){ return cache.loans.length?cache.loans.slice(0,50).map(l=>`<div class="ac-table-row"><span>${esc(l.display_id||'-')}</span><span>${esc(memberCode(l.member_id))}</span><span>${money(l.amount)}</span><span>${money(l.paid)}</span><span>${money(outstanding(l))}</span><span>${statusPill(l.status||'active', ['rejected','cancelled'].includes(l.status))}</span></div>`).join(''):`<div class="ac-empty">Belum ada pinjaman.</div>` }
function paymentRows(){ return cache.payments.length?cache.payments.slice(0,50).map(p=>`<div class="ac-table-row"><span>${esc(p.display_id||'-')}</span><span>${esc(memberCode(p.member_id))}</span><span>${money(p.amount)}</span><span>${esc(p.method||'Tunai')}</span><span>${new Date(p.created_at).toLocaleString('id-ID')}</span></div>`).join(''):`<div class="ac-empty">Belum ada pembayaran.</div>` }
function txRows(){ return cache.transactions.length?cache.transactions.slice(0,50).map(t=>`<div class="ac-table-row"><span>${esc(t.display_id||'-')}</span><span>${esc(t.label)}</span><span>${esc(memberCode(t.member_id))}</span><span class="${t.direction==='out'?'money-out':'money-in'}">${t.direction==='out'?'-':'+'}${money(t.amount)}</span><span>${new Date(t.created_at).toLocaleString('id-ID')}</span></div>`).join(''):`<div class="ac-empty">Belum ada transaksi.</div>` }
function auditRows(){ return cache.audit.length?cache.audit.slice(0,50).map(a=>`<div class="ac-table-row"><span>${new Date(a.created_at).toLocaleString('id-ID')}</span><span>${esc(a.action)}</span><span>${esc(a.entity_type||'-')}</span><span>${esc(a.user_id||'-')}</span></div>`).join(''):`<div class="ac-empty">Belum ada audit log.</div>` }
function securityRows(){ return cache.security.length?cache.security.slice(0,50).map(s=>`<div class="ac-table-row"><span>${new Date(s.created_at).toLocaleString('id-ID')}</span><span>${statusPill(s.severity.toUpperCase(),s.severity!=='info')}</span><span>${esc(s.event_type)}</span><span>${esc(s.user_id||'-')}</span></div>`).join(''):`<div class="ac-empty">Belum ada security event.</div>` }
function profileRows(){ return cache.profiles.length?cache.profiles.map(p=>`<div class="ac-table-row"><div class="ac-primary-cell"><div class="ac-avatar">${esc((p.full_name||'U')[0].toUpperCase())}</div><span><strong>${esc(p.full_name||'-')}</strong><small>${esc(p.id)}</small></span></div><span>${statusPill(p.role==='super_admin'?'SUPER ADMIN':p.role.toUpperCase(),p.role==='member')}</span><span>${new Date(p.created_at).toLocaleDateString('id-ID')}</span></div>`).join(''):`<div class="ac-empty">Belum ada profile.</div>` }

function selectMembers(id){ return `<select id="${id}" class="ac-input"><option value="">Pilih anggota</option>${cache.members.map(m=>`<option value="${m.id}">${esc(m.display_id||m.code||'')} — ${esc(m.name)}</option>`).join('')}</select>` }
function selectLoans(){ const active=cache.loans.filter(l=>outstanding(l)>0); return `<select id="acPaymentLoan" class="ac-input"><option value="">Pilih pinjaman</option>${active.map(l=>`<option value="${l.id}">${esc(l.display_id||'')} — ${esc(memberCode(l.member_id))} — sisa ${money(outstanding(l))}</option>`).join('')}</select>` }
function panel(title,content,actions=''){ return `<section class="ac-panel"><div class="ac-panel-head"><div><span class="ac-kicker">ADMIN CONTROL</span><h2>${title}</h2></div>${actions}</div>${content}</section>` }
function table(headers,rows){ return `<div class="ac-table"><div class="ac-table-head">${headers.map(h=>`<span>${h}</span>`).join('')}</div>${rows}</div>` }

function overview(){
 const savings=total(cache.savings), loans=total(cache.loans), payments=total(cache.payments), outstandingTotal=cache.loans.reduce((s,l)=>s+outstanding(l),0)
 return `<div class="ac-grid">${stat('ANGGOTA',cache.members.length,'Data DAPIN terpusat')}${stat('SIMPANAN',money(savings),'Total tercatat')}${stat('PIUTANG',money(outstandingTotal),'Sisa pinjaman aktif')}${stat('ANGSURAN',money(payments),'Total pembayaran')}</div>${panel('Kontrol Operasional',`<div class="ac-control-grid"><button class="ac-control" data-ac-tab-go="members"><strong>Kelola Anggota</strong><small>${cache.members.length} anggota terdaftar</small></button><button class="ac-control" data-ac-tab-go="savings"><strong>Kelola Simpanan</strong><small>${cache.savings.length} catatan simpanan</small></button><button class="ac-control" data-ac-tab-go="loans"><strong>Kelola Pinjaman</strong><small>${cache.loans.length} data pinjaman</small></button><button class="ac-control" data-ac-tab-go="payments"><strong>Kelola Angsuran</strong><small>${cache.payments.length} pembayaran</small></button><button class="ac-control" data-ac-tab-go="transactions"><strong>Kelola Transaksi</strong><small>${cache.transactions.length} transaksi</small></button><button class="ac-control" data-ac-tab-go="security"><strong>Security & Audit</strong><small>${cache.security.length} event keamanan</small></button></div>`)}${panel('Aktivitas Terakhir',table(['Waktu','Aksi','Entitas','User'],auditRows()))}`
}
function members(){ return panel('Data Master Anggota',`<form class="ac-form" data-ac-form="member"><input id="acMemberName" class="ac-input" placeholder="Nama lengkap" required><input id="acMemberEmail" class="ac-input" type="email" placeholder="Email"><input id="acMemberPhone" class="ac-input" placeholder="Nomor WhatsApp"><input id="acMemberAddress" class="ac-input" placeholder="Alamat"><button class="ac-primary" type="submit">＋ Tambah Anggota</button></form>${table(['Anggota','Email','WhatsApp','Status','Bergabung'],memberRows())}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>') }
function savings(){ return panel('Simpanan',`<form class="ac-form ac-form-4" data-ac-form="saving">${selectMembers('acSavingMember')}<select id="acSavingType" class="ac-input"><option>Simpanan Pokok</option><option>Simpanan Wajib</option><option>Simpanan Sukarela</option></select><input id="acSavingAmount" class="ac-input" type="number" min="1" placeholder="Nominal"><input id="acSavingNote" class="ac-input" placeholder="Keterangan"><button class="ac-primary" type="submit">Catat Simpanan</button></form>${table(['ID','Anggota','Jenis','Nominal','Waktu'],savingsRows())}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>') }
function loans(){ return panel('Pinjaman',`<form class="ac-form ac-form-5" data-ac-form="loan">${selectMembers('acLoanMember')}<input id="acLoanAmount" class="ac-input" type="number" min="1" placeholder="Nominal"><input id="acLoanTenor" class="ac-input" type="number" min="1" placeholder="Tenor bulan"><select id="acLoanStatus" class="ac-input"><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="active">Active</option><option value="draft">Draft</option></select><input id="acLoanNote" class="ac-input" placeholder="Catatan"><button class="ac-primary" type="submit">＋ Buat Pinjaman</button></form>${table(['ID','Anggota','Pokok','Terbayar','Sisa','Status'],loanRows())}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>') }
function payments(){ return panel('Angsuran',`<form class="ac-form ac-form-4" data-ac-form="payment">${selectLoans()}<input id="acPaymentAmount" class="ac-input" type="number" min="1" placeholder="Nominal"><select id="acPaymentMethod" class="ac-input"><option>Tunai</option><option>Transfer</option><option>QRIS</option><option>Potong Simpanan</option></select><input id="acPaymentNote" class="ac-input" placeholder="Keterangan"><button class="ac-primary" type="submit">Catat Angsuran</button></form>${table(['ID','Anggota','Nominal','Metode','Waktu'],paymentRows())}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>') }
function transactions(){ return panel('Buku Transaksi DAPIN',`<form class="ac-form ac-form-5" data-ac-form="transaction"><input id="acTxLabel" class="ac-input" placeholder="Label transaksi" required><input id="acTxAmount" class="ac-input" type="number" min="1" placeholder="Nominal" required><select id="acTxDirection" class="ac-input"><option value="in">Uang Masuk</option><option value="out">Uang Keluar</option></select>${selectMembers('acTxMember')}<input id="acTxNote" class="ac-input" placeholder="Catatan"><button class="ac-primary" type="submit">＋ Catat Transaksi</button></form>${table(['ID','Label','Anggota','Nominal','Waktu'],txRows())}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>') }
function access(){ return panel('Akses Administrator',`<div class="ac-note">Role dibaca dari <code>profiles.role</code>. Perubahan role tidak dilakukan dari browser karena harus melewati trusted backend.</div>${table(['Administrator / User','Role','Terdaftar'],profileRows())}`,'<span class="ac-lock">🔒 Backend protected</span>') }
function security(){ return `${panel('Audit Log',table(['Waktu','Aksi','Entitas','User'],auditRows()))}${panel('Security Events',table(['Waktu','Severity','Event','User'],securityRows()))}` }
function modules(){ return panel('Status Modul DAPIN',`<div class="ac-module-grid">${[['Anggota',cache.members.length],['Simpanan',cache.savings.length],['Pinjaman',cache.loans.length],['Angsuran',cache.payments.length],['Transaksi',cache.transactions.length],['Audit',cache.audit.length]].map(([n,c])=>`<div class="ac-module"><strong>${n}</strong><span>${c}</span><small>Database connected</small>${statusPill('READY')}</div>`).join('')}</div>`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>') }
function activity(){ return panel('Aktivitas DAPIN',table(['Waktu','Aksi','Entitas','User'],auditRows()),'<button class="ac-action" data-ac-refresh>↻ Refresh</button>') }
function render(){
 const r=root(); if(!r||!isAdminPage()||r.querySelector('.finora-admin-page')) return
 const content=error?`<div class="ac-error">${esc(error)}<button class="ac-action" data-ac-refresh>Refresh</button></div>`:loading?`<div class="ac-loading">Memuat data Administrator…</div>`:({overview,modules,members,savings,loans,payments,transactions,access,security,activity}[activeTab]||overview)()
 r.innerHTML=`<div class="finora-admin-page"><div class="ac-head"><div><span class="ac-kicker">PLATFORM CONTROL</span><h1>Feature Center</h1><p>Administrator mengelola data DAPIN yang tersimpan di Supabase, dengan permission, RLS, dan audit trail.</p></div><div class="ac-head-actions"><span class="ac-badge">● ADMIN CONTROL</span><button class="ac-action" data-ac-refresh>↻ Refresh</button></div></div><nav class="ac-nav">${tabButton('overview','Overview')}${tabButton('modules','Modul')}${tabButton('members','Anggota')}${tabButton('savings','Simpanan')}${tabButton('loans','Pinjaman')}${tabButton('payments','Angsuran')}${tabButton('transactions','Transaksi')}${tabButton('access','Akses')}${tabButton('security','Security')}${tabButton('activity','Audit')}</nav>${content}</div>`
}
async function refresh(){ if(loading) return; loading=true; error=''; render(); try{ await loadData() }catch(e){ error=e.message } finally{ loading=false; render() } }

document.addEventListener('click',async e=>{
 const tab=e.target.closest?.('[data-ac-tab]'); if(tab){ activeTab=tab.dataset.acTab; render(); return }
 const go=e.target.closest?.('[data-ac-tab-go]'); if(go){ activeTab=go.dataset.acTabGo; render(); return }
 const ref=e.target.closest?.('[data-admin-view]'); if(ref){ document.querySelector(`.side-item[data-view="${ref.dataset.adminView}"]`)?.click(); return }
 if(e.target.closest?.('[data-ac-refresh]')){ await refresh(); return }
})
document.addEventListener('submit',async e=>{
 const form=e.target.closest?.('[data-ac-form]'); if(!form) return; e.preventDefault();
 const kind=form.dataset.acForm; if(kind==='member') await saveMember(); else if(kind==='saving') await saveSaving(); else if(kind==='loan') await saveLoan(); else if(kind==='payment') await savePayment(); else if(kind==='transaction') await saveTransaction()
})

new MutationObserver(()=>{ const r=root(); if(r && isAdminPage() && !r.querySelector('.finora-admin-page')) refresh() }).observe(document.documentElement,{childList:true,subtree:true})
refresh()
