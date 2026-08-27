import './admin-center.css'
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = url && key ? createClient(url, key) : null
const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const wa = phone => { const p=String(phone||'').replace(/\D/g,''); if(!p) return ''; const n=p.startsWith('0')?'62'+p.slice(1):p.startsWith('62')?p:p; return n.length>=10?`https://wa.me/${n}?text=${encodeURIComponent('Halo, kami dari DAPIN Balongbendo. Kami menghubungi terkait data keanggotaan Anda.')}`:'' }

const TABS=[['overview','Overview'],['members','Anggota'],['savings','Simpanan'],['loans','Pinjaman'],['payments','Angsuran'],['transactions','Transaksi'],['profiles','Administrator'],['security','Security & Audit']]
let tab='overview'
let cache={members:[],savings:[],loans:[],payments:[],transactions:[],audit:[],security:[],profiles:[]}
let loading=false
let booted=false
let lastError=''

const pageRoot=()=>document.querySelector('.page')
const isAdminPage=()=>{const r=pageRoot();return !!r?.querySelector('.admin-badge') || !!r?.querySelector('.finora-admin-page')}
const toast=(msg,ok=true)=>{document.querySelector('.ac-toast')?.remove();const e=document.createElement('div');e.className=`ac-toast ${ok?'ok':'bad'}`;e.textContent=msg;document.body.appendChild(e);setTimeout(()=>e.remove(),3000)}
const status=(s,bad=false)=>`<span class="ac-pill ${bad?'ac-warn':''}">${esc(s)}</span>`
const stat=(a,b,c)=>`<article class="ac-card"><span>${a}</span><strong>${b}</strong><small>${c}</small></article>`
const memberCode=id=>{const m=cache.members.find(x=>x.id===id);return m?.display_id||m?.code||'-'}
const due=l=>Math.max(0,Number(l.amount||0)-Number(l.paid||0))
const total=a=>a.reduce((s,x)=>s+Number(x.amount||0),0)

async function loadData(){
  if(!supabase) throw new Error('Supabase environment belum tersedia.')
  const qs=[
    supabase.from('dapin_members').select('*').order('created_at',{ascending:false}),
    supabase.from('dapin_savings').select('*').order('created_at',{ascending:false}),
    supabase.from('dapin_loans').select('*').order('created_at',{ascending:false}),
    supabase.from('dapin_loan_payments').select('*').order('created_at',{ascending:false}),
    supabase.from('dapin_transactions').select('*').order('created_at',{ascending:false}),
    supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(100),
    supabase.from('security_events').select('*').order('created_at',{ascending:false}).limit(100),
    supabase.from('profiles').select('id,full_name,role,created_at,updated_at').order('created_at',{ascending:false}),
  ]
  const rs=await Promise.all(qs)
  const bad=rs.find(x=>x.error)
  if(bad?.error) throw new Error(bad.error.message)
  cache={members:rs[0].data||[],savings:rs[1].data||[],loans:rs[2].data||[],payments:rs[3].data||[],transactions:rs[4].data||[],audit:rs[5].data||[],security:rs[6].data||[],profiles:rs[7].data||[]}
}
async function rpc(name,args){if(!supabase)throw new Error('Supabase belum siap.');const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.message);return data}
async function refresh(){if(loading)return;loading=true;render();try{await loadData();lastError=''}catch(e){lastError=e.message;toast(e.message,false)}finally{loading=false;render()}}

function table(heads,body,cols='repeat(5,1fr)'){return `<div class="ac-table"><div class="ac-table-head" style="grid-template-columns:${cols}">${heads.map(x=>`<span>${x}</span>`).join('')}</div>${body||'<div class="ac-empty">Tidak ada data.</div>'}</div>`}
function panel(title,body,action=''){return `<section class="ac-panel"><div class="ac-panel-head"><div><span class="ac-kicker">ADMIN CONTROL</span><h2>${title}</h2></div>${action}</div>${body}</section>`}
function selectMembers(id){return `<select id="${id}" class="ac-input"><option value="">Pilih anggota</option>${cache.members.map(m=>`<option value="${m.id}">${esc(m.display_id||m.code||'')} — ${esc(m.name)}</option>`).join('')}</select>`}
function selectLoans(){return `<select id="acPaymentLoan" class="ac-input"><option value="">Pilih pinjaman</option>${cache.loans.filter(x=>due(x)>0).map(l=>`<option value="${l.id}">${esc(l.display_id||'')} — ${esc(memberCode(l.member_id))} — sisa ${money(due(l))}</option>`).join('')}</select>`}

function memberRows(){return cache.members.length?cache.members.map(m=>{const link=wa(m.phone);return `<div class="ac-table-row" style="grid-template-columns:1.4fr 1fr 1fr .8fr .9fr"><div class="ac-primary-cell"><div class="ac-avatar">${esc((m.name||'A')[0].toUpperCase())}</div><span><strong>${esc(m.name)}</strong><small>${esc(m.display_id||m.code||'-')}</small></span></div><span>${esc(m.email||'-')}</span><span>${link?`<a class="ac-wa" href="${link}" target="_blank" rel="noreferrer">${esc(m.phone)} ↗</a>`:esc(m.phone||'-')}</span><span>${status(m.status||'active',m.status!=='active')}</span><span><button class="ac-mini" data-member-status="${m.id}" data-status="${m.status==='active'?'suspended':'active'}">${m.status==='active'?'Suspend':'Aktifkan'}</button></span></div>`}).join(''):''}
function savingRows(){return cache.savings.map(s=>`<div class="ac-table-row"><span>${esc(s.display_id||'-')}</span><span>${esc(memberCode(s.member_id))}</span><span>${esc(s.type)}</span><span class="money-in">+${money(s.amount)}</span><span>${new Date(s.created_at).toLocaleString('id-ID')}</span></div>`).join('')}
function loanRows(){return cache.loans.map(l=>`<div class="ac-table-row" style="grid-template-columns:.9fr .9fr 1fr 1fr 1fr 1fr 1fr"><span>${esc(l.display_id||'-')}</span><span>${esc(memberCode(l.member_id))}</span><span>${money(l.amount)}</span><span>${money(l.paid)}</span><span>${money(due(l))}</span><span>${status(l.status||'active',['rejected','cancelled'].includes(l.status))}</span><span><select class="ac-mini-select" data-loan-status="${l.id}"><option value="">Ubah</option>${['draft','submitted','approved','active','rejected','lunas','cancelled'].map(s=>`<option value="${s}">${s}</option>`).join('')}</select></span></div>`).join('')}
function paymentRows(){return cache.payments.map(p=>`<div class="ac-table-row"><span>${esc(p.display_id||'-')}</span><span>${esc(memberCode(p.member_id))}</span><span>${money(p.amount)}</span><span>${esc(p.method||'Tunai')}</span><span>${new Date(p.created_at).toLocaleString('id-ID')}</span></div>`).join('')}
function txRows(){return cache.transactions.map(t=>`<div class="ac-table-row"><span>${esc(t.display_id||'-')}</span><span>${esc(t.label)}</span><span>${esc(memberCode(t.member_id))}</span><span class="${t.direction==='out'?'money-out':'money-in'}">${t.direction==='out'?'-':'+'}${money(t.amount)}</span><span>${new Date(t.created_at).toLocaleString('id-ID')}</span></div>`).join('')}
function auditRows(){return cache.audit.map(a=>`<div class="ac-table-row"><span>${new Date(a.created_at).toLocaleString('id-ID')}</span><span>${esc(a.action)}</span><span>${esc(a.entity_type||'-')}</span><span>${esc(a.user_id||'-')}</span><span>${esc(a.entity_id||'-')}</span></div>`).join('')}
function securityRows(){return cache.security.map(s=>`<div class="ac-table-row"><span>${new Date(s.created_at).toLocaleString('id-ID')}</span><span>${status(s.severity?.toUpperCase()||'INFO',s.severity!=='info')}</span><span>${esc(s.event_type)}</span><span>${esc(s.user_id||'-')}</span><span>Security event</span></div>`).join('')}
function profileRows(){return cache.profiles.map(p=>`<div class="ac-table-row"><div class="ac-primary-cell"><div class="ac-avatar">${esc((p.full_name||'U')[0].toUpperCase())}</div><span><strong>${esc(p.full_name||'-')}</strong><small>${esc(p.id)}</small></span></div><span>${status(p.role||'member',p.role==='member')}</span><span>${new Date(p.created_at).toLocaleDateString('id-ID')}</span></div>`).join('')}

function overview(){return `<div class="ac-grid">${stat('ANGGOTA',cache.members.length,'DAPIN terpusat')}${stat('SIMPANAN',money(total(cache.savings)),'Total tercatat')}${stat('PIUTANG',money(cache.loans.reduce((s,l)=>s+due(l),0)),'Sisa pinjaman')}${stat('ANGSURAN',money(total(cache.payments)),'Total pembayaran')}</div>${panel('Kontrol Operasional',`<div class="ac-control-grid"><button class="ac-control" data-ac-tab-go="members"><strong>Anggota</strong><small>Tambah, suspend, WhatsApp</small></button><button class="ac-control" data-ac-tab-go="savings"><strong>Simpanan</strong><small>Catat setoran anggota</small></button><button class="ac-control" data-ac-tab-go="loans"><strong>Pinjaman</strong><small>Buat dan ubah status kredit</small></button><button class="ac-control" data-ac-tab-go="payments"><strong>Angsuran</strong><small>Catat pembayaran pinjaman</small></button><button class="ac-control" data-ac-tab-go="transactions"><strong>Transaksi</strong><small>Buku transaksi DAPIN</small></button><button class="ac-control" data-ac-tab-go="security"><strong>Security</strong><small>Audit & security events</small></button></div>`)}${panel('Audit Terbaru',table(['Waktu','Aksi','Entitas','User','ID'],auditRows()))}`}
function members(){return panel('Data Master Anggota',`<form class="ac-form" data-ac-form="member"><input id="acMemberName" class="ac-input" placeholder="Nama lengkap" required><input id="acMemberEmail" class="ac-input" type="email" placeholder="Email"><input id="acMemberPhone" class="ac-input" placeholder="Nomor WhatsApp"><input id="acMemberAddress" class="ac-input" placeholder="Alamat"><button class="ac-primary" type="submit">＋ Tambah Anggota</button></form>${table(['Anggota','Email','WhatsApp','Status','Aksi'],memberRows())}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>')}
function savings(){return panel('Simpanan',`<form class="ac-form" data-ac-form="saving">${selectMembers('acSavingMember')}<select id="acSavingType" class="ac-input"><option>Simpanan Pokok</option><option>Simpanan Wajib</option><option>Simpanan Sukarela</option></select><input id="acSavingAmount" class="ac-input" type="number" min="1" placeholder="Nominal"><input id="acSavingNote" class="ac-input" placeholder="Keterangan"><button class="ac-primary" type="submit">Catat Simpanan</button></form>${table(['ID','Anggota','Jenis','Nominal','Waktu'],savingRows())}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>')}
function loans(){return panel('Pinjaman',`<form class="ac-form" data-ac-form="loan">${selectMembers('acLoanMember')}<input id="acLoanAmount" class="ac-input" type="number" min="1" placeholder="Nominal"><input id="acLoanTenor" class="ac-input" type="number" min="1" placeholder="Tenor / bulan"><select id="acLoanStatus" class="ac-input"><option value="submitted">submitted</option><option value="approved">approved</option><option value="active">active</option><option value="draft">draft</option></select><input id="acLoanNote" class="ac-input" placeholder="Catatan"><button class="ac-primary" type="submit">Buat Pinjaman</button></form>${table(['ID','Anggota','Pokok','Terbayar','Sisa','Status','Aksi'],loanRows(),'1fr 1fr 1fr 1fr 1fr 1fr 1fr')}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>')}
function payments(){return panel('Angsuran',`<form class="ac-form" data-ac-form="payment">${selectLoans()}<input id="acPaymentAmount" class="ac-input" type="number" min="1" placeholder="Nominal"><select id="acPaymentMethod" class="ac-input"><option>Tunai</option><option>Transfer</option><option>QRIS</option></select><input id="acPaymentNote" class="ac-input" placeholder="Keterangan"><button class="ac-primary" type="submit">Catat Angsuran</button></form>${table(['ID','Anggota','Nominal','Metode','Waktu'],paymentRows())}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>')}
function transactions(){return panel('Transaksi DAPIN',`<form class="ac-form" data-ac-form="transaction"><input id="acTxLabel" class="ac-input" placeholder="Label transaksi" required><input id="acTxAmount" class="ac-input" type="number" min="1" placeholder="Nominal"><select id="acTxDirection" class="ac-input"><option value="in">Masuk</option><option value="out">Keluar</option></select>${selectMembers('acTxMember')}<input id="acTxNote" class="ac-input" placeholder="Keterangan"><button class="ac-primary" type="submit">Catat Transaksi</button></form>${table(['ID','Label','Anggota','Nominal','Waktu'],txRows())}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>')}
function profiles(){return panel('Administrator & Role',`<div class="ac-note">Role dikontrol oleh Supabase dan tidak dapat diubah dari browser. Perubahan role harus melalui jalur backend terpercaya.</div>${table(['Pengguna','Role','Dibuat'],profileRows(),'2fr 1fr 1fr')}`,'<button class="ac-action" data-ac-refresh>↻ Refresh</button>')}
function security(){return `<div class="ac-section-grid">${panel('Security Events',table(['Waktu','Severity','Event','User','Jenis'],securityRows()))}${panel('Audit Log',table(['Waktu','Aksi','Entitas','User','ID'],auditRows()))}</div>`}

function ensureHost(r){let host=r.querySelector('.finora-admin-page');if(host)return host;host=document.createElement('div');host.className='finora-admin-page';r.replaceChildren(host);return host}
function render(){
 const r=pageRoot(); if(!isAdminPage()||!r)return
 const host=ensureHost(r)
 host.innerHTML=`<div class="ac-head"><div><span class="ac-kicker">PLATFORM CONTROL</span><h1>Feature Center</h1><p>Control panel operasional DAPIN berbasis Supabase.</p></div><div class="ac-head-actions"><span class="ac-lock">${loading?'● LOADING':'● ADMIN SESSION'}</span><button class="ac-action" data-ac-refresh>↻ Refresh</button></div></div><nav class="ac-nav">${TABS.map(([id,label])=>tabButton(id,label)).join('')}</nav>${lastError?`<div class="ac-error">${esc(lastError)}</div>`:''}<div class="ac-content">${loading?'<div class="ac-loading">Memuat data DAPIN…</div>':({overview,members,savings,loans,payments,transactions,profiles,security}[tab]||overview)()}</div>`
}
function tabButton(id,label){return `<button class="ac-tab ${tab===id?'active':''}" data-ac-tab="${id}">${label}</button>`}

async function submitForm(form){
 const k=form.dataset.acForm
 try{
  if(k==='member'){const name=document.getElementById('acMemberName').value.trim();if(!name)throw new Error('Nama anggota wajib diisi.');const m=await rpc('dapin_create_member',{p_name:name,p_email:document.getElementById('acMemberEmail').value.trim()||null,p_phone:document.getElementById('acMemberPhone').value.trim()||null,p_address:document.getElementById('acMemberAddress').value.trim()||null,p_joined_at:new Date().toISOString()});toast(`Anggota ${m.display_id||m.code} berhasil dibuat.`)}
  if(k==='saving'){const member_id=document.getElementById('acSavingMember').value;if(!member_id)throw new Error('Pilih anggota.');const amount=Number(document.getElementById('acSavingAmount').value);if(!Number.isFinite(amount)||amount<=0)throw new Error('Nominal simpanan tidak valid.');await rpc('dapin_record_saving',{p_member_id:member_id,p_type:document.getElementById('acSavingType').value,p_amount:amount,p_note:document.getElementById('acSavingNote').value.trim()||null});toast('Simpanan berhasil dicatat.')}
  if(k==='loan'){const member_id=document.getElementById('acLoanMember').value;const amount=Number(document.getElementById('acLoanAmount').value);const tenor=Number(document.getElementById('acLoanTenor').value);if(!member_id||!Number.isFinite(amount)||amount<=0||!Number.isInteger(tenor)||tenor<=0)throw new Error('Data pinjaman belum lengkap.');await rpc('dapin_create_loan',{p_member_id:member_id,p_amount:amount,p_tenor:tenor,p_status:document.getElementById('acLoanStatus').value,p_note:document.getElementById('acLoanNote').value.trim()||null});toast('Pinjaman berhasil dibuat.')}
  if(k==='payment'){const loan_id=document.getElementById('acPaymentLoan').value;const amount=Number(document.getElementById('acPaymentAmount').value);if(!loan_id||!Number.isFinite(amount)||amount<=0)throw new Error('Pinjaman dan nominal pembayaran wajib diisi.');await rpc('dapin_record_payment',{p_loan_id:loan_id,p_amount:amount,p_method:document.getElementById('acPaymentMethod').value,p_note:document.getElementById('acPaymentNote').value.trim()||null});toast('Angsuran berhasil dicatat.')}
  if(k==='transaction'){const label=document.getElementById('acTxLabel').value.trim();const amount=Number(document.getElementById('acTxAmount').value);if(!label||!Number.isFinite(amount)||amount<=0)throw new Error('Label dan nominal transaksi wajib diisi.');await rpc('dapin_record_transaction',{p_label:label,p_amount:amount,p_direction:document.getElementById('acTxDirection').value,p_member_id:document.getElementById('acTxMember').value||null,p_reference_type:null,p_reference_id:null,p_note:document.getElementById('acTxNote').value.trim()||null});toast('Transaksi berhasil dicatat.')}
  await loadData();render()
 }catch(e){toast(e.message||String(e),false)}
}

async function handleClick(e){
 if(!isAdminPage())return
 const t=e.target.closest('[data-ac-tab]');if(t){tab=t.dataset.acTab;render();return}
 const g=e.target.closest('[data-ac-tab-go]');if(g){tab=g.dataset.acTabGo;render();return}
 if(e.target.closest('[data-ac-refresh]')){await refresh();return}
 const s=e.target.closest('[data-member-status]');if(s){try{await rpc('dapin_set_member_status',{p_member_id:s.dataset.memberStatus,p_status:s.dataset.status});toast('Status anggota diperbarui.');await loadData();render()}catch(err){toast(err.message,false)}return}
}
async function handleChange(e){
 if(!isAdminPage())return
 const s=e.target.closest('[data-loan-status]');if(s?.value){try{await rpc('dapin_set_loan_status',{p_loan_id:s.dataset.loanStatus,p_status:s.value});toast('Status pinjaman diperbarui.');await loadData();render()}catch(err){toast(err.message,false)}}
}

document.addEventListener('click',handleClick)
document.addEventListener('change',handleChange)
document.addEventListener('submit',e=>{if(e.target.matches('[data-ac-form]')){e.preventDefault();submitForm(e.target)}})

const observer=new MutationObserver(async()=>{
 const page=pageRoot()
 if(isAdminPage()&&!booted){booted=true;loading=true;render();try{await loadData();lastError=''}catch(e){lastError=e.message}finally{loading=false;render()}}
 if(!isAdminPage())booted=false
})
observer.observe(document.documentElement,{childList:true,subtree:true})
