import './dapin-member-detail.css'
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = url && key ? createClient(url, key) : null
const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const waUrl = phone => { const p=String(phone||'').replace(/\D/g,''); if(!p) return ''; const n=p.startsWith('0')?'62'+p.slice(1):p; return /^62\d{8,15}$/.test(n)?`https://wa.me/${n}`:'' }

let openId = null
let current = null
let busy = false

function panel(){ return document.querySelector('.admin-center, .finora-admin-page, .page') }
function memberDisplayId(row){ return row.querySelector('.ac-primary-cell small')?.textContent?.trim() || '' }
function memberRow(row){ const h=row.closest('.ac-panel')?.querySelector('h2')?.textContent?.trim(); return h==='Data Master Anggota' }

async function loadMember(idOrDisplay){
  if(!supabase) throw new Error('Supabase environment belum tersedia.')
  let q=supabase.from('dapin_members').select('*')
  if(idOrDisplay?.includes('DAP-MBR-')) q=q.eq('display_id',idOrDisplay)
  else q=q.eq('id',idOrDisplay)
  const {data,error}=await q.maybeSingle(); if(error) throw error; if(!data) throw new Error('Anggota tidak ditemukan.')
  const [docs,collaterals,savings,loans,payments,transactions]=await Promise.all([
    supabase.from('dapin_member_documents').select('*').eq('member_id',data.id).order('created_at',{ascending:false}),
    supabase.from('dapin_collaterals').select('*').eq('member_id',data.id).order('created_at',{ascending:false}),
    supabase.from('dapin_savings').select('*').eq('member_id',data.id).order('created_at',{ascending:false}),
    supabase.from('dapin_loans').select('*').eq('member_id',data.id).order('created_at',{ascending:false}),
    supabase.from('dapin_loan_payments').select('*').eq('member_id',data.id).order('created_at',{ascending:false}),
    supabase.from('dapin_transactions').select('*').eq('member_id',data.id).order('created_at',{ascending:false}),
  ])
  const fail=[docs,collaterals,savings,loans,payments,transactions].find(x=>x.error); if(fail?.error) throw fail.error
  current={member:data,docs:docs.data||[],collaterals:collaterals.data||[],savings:savings.data||[],loans:loans.data||[],payments:payments.data||[],transactions:transactions.data||[]}
  return current
}

function field(label,value){ return `<div class="md-field"><span>${label}</span><strong>${esc(value||'—')}</strong></div>` }
function summary(){
 const m=current.member, savings=current.savings.reduce((s,x)=>s+Number(x.amount||0),0), paid=current.payments.reduce((s,x)=>s+Number(x.amount||0),0), debt=current.loans.reduce((s,x)=>s+Math.max(0,Number(x.amount||0)-Number(x.paid||0)),0)
 const wa=waUrl(m.phone)
 return `<div class="md-summary"><div><span>Total Simpanan</span><strong>${money(savings)}</strong></div><div><span>Total Angsuran</span><strong>${money(paid)}</strong></div><div><span>Sisa Pinjaman</span><strong>${money(debt)}</strong></div><div><span>Status</span><strong>${esc(m.status||'active')}</strong></div></div><div class="md-grid"><section class="md-card"><div class="md-card-head"><span>IDENTITAS</span><h3>Data Anggota</h3></div>${field('ID Anggota',m.display_id||m.code)}${field('Nama Lengkap',m.name)}${field('NIK / KTP',m.nik)}${field('No. KK',m.kk_number)}${field('Tempat Lahir',m.birth_place)}${field('Tanggal Lahir',m.birth_date)}${field('Jenis Kelamin',m.gender==='L'?'Laki-laki':m.gender==='P'?'Perempuan':'—')}${field('Pekerjaan',m.occupation)}${field('Status Perkawinan',m.marital_status)}</section><section class="md-card"><div class="md-card-head"><span>KONTAK</span><h3>Komunikasi</h3></div>${field('Nomor WhatsApp',m.phone)}${field('Email',m.email)}${field('Alamat',m.address)}<div class="md-actions">${wa?`<a class="md-wa" target="_blank" rel="noopener noreferrer" href="${wa}?text=${encodeURIComponent(`Halo ${m.name}, kami dari DAPIN Balongbendo terkait data anggota ${m.display_id||m.code}.`)}`}>💬 Chat WhatsApp</a>`:''}<button class="md-button" data-md-edit>Edit Data</button></div></section></div>`
}
function documents(){
 return `<section class="md-card"><div class="md-card-head"><div><span>DOKUMEN</span><h3>Dokumen Anggota</h3></div><label class="md-upload">＋ Upload<input type="file" data-md-upload hidden accept="image/*,.pdf"></label></div><div class="md-doc-grid">${current.docs.length?current.docs.map(d=>`<article><div class="md-doc-icon">${d.document_type==='ktp'?'KTP':d.document_type==='kk'?'KK':d.document_type==='photo'?'FOTO':'DOC'}</div><div><strong>${esc(d.file_name)}</strong><small>${esc(d.document_type)} • ${new Date(d.created_at).toLocaleDateString('id-ID')}</small></div><button data-md-doc="${esc(d.storage_path)}">Lihat</button></article>`).join(''):'<div class="md-empty">Belum ada KTP, KK, foto, atau dokumen pendukung.</div>'}</div></section>`
}
function collateral(){
 return `<section class="md-card"><div class="md-card-head"><div><span>JAMINAN</span><h3>Agunan / Jaminan</h3></div><button class="md-button" data-md-collateral>＋ Tambah Jaminan</button></div><div class="md-collateral-grid">${current.collaterals.length?current.collaterals.map(c=>`<article><div><strong>${esc(c.name)}</strong><span>${esc(c.collateral_type)}</span></div><b>${money(c.estimated_value)}</b><small>${esc(c.description||'Tanpa keterangan')} • ${esc(c.status)}</small></article>`).join(''):'<div class="md-empty">Belum ada data jaminan.</div>'}</div></section>`
}
function finances(){
 const loans=current.loans.map(l=>`<div><span><strong>${esc(l.display_id||l.id)}</strong><small>${money(l.amount)} • ${l.tenor} bulan</small></span><b>Sisa ${money(Math.max(0,Number(l.amount)-Number(l.paid||0)))}</b></div>`).join('')||'<div class="md-empty">Belum ada pinjaman.</div>'
 return `<section class="md-card"><div class="md-card-head"><span>KEUANGAN</span><h3>Pinjaman & Riwayat</h3></div><div class="md-finance-list">${loans}</div></section>`
}
function renderModal(){
 if(!current) return
 const m=current.member
 const root=document.createElement('div'); root.className='md-overlay'; root.innerHTML=`<div class="md-modal"><header><div class="md-avatar">${esc((m.name||'A')[0].toUpperCase())}</div><div><span>DAPIN MEMBER</span><h2>${esc(m.name)}</h2><small>${esc(m.display_id||m.code||'')}</small></div><button class="md-close" data-md-close>×</button></header><div class="md-body">${summary()}${documents()}${collateral()}${finances()}</div></div>`
 root.addEventListener('click',onModalClick); document.body.appendChild(root)
}
async function show(id){ busy=true; try{await loadMember(id); document.querySelector('.md-overlay')?.remove(); renderModal()}catch(e){alert(e.message)}finally{busy=false} }

async function onModalClick(e){
 if(e.target.closest('[data-md-close]')||e.target.classList.contains('md-overlay')){ e.currentTarget.remove(); return }
 const doc=e.target.closest('[data-md-doc]'); if(doc){ try{const {data,error}=await supabase.storage.from('dapin-documents').createSignedUrl(doc.dataset.mdDoc,300); if(error) throw error; window.open(data.signedUrl,'_blank','noopener,noreferrer')}catch(err){alert(err.message)} return }
 const edit=e.target.closest('[data-md-edit]'); if(edit){alert('Form edit data akan memakai RPC dapin_update_member_profile. Jalankan migration profile terlebih dahulu.');return}
 const add=e.target.closest('[data-md-collateral]'); if(add){promptCollateral();return}
 const upload=e.target.closest('[data-md-upload]'); if(upload) return
}

async function upload(file){
 if(!file||!current||busy) return; busy=true
 try{
  const ext=(file.name.split('.').pop()||'bin').toLowerCase(); const path=`${current.member.id}/${crypto.randomUUID()}.${ext}`
  const {error}=await supabase.storage.from('dapin-documents').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false}); if(error) throw error
  const type=/pdf/i.test(file.type)?'other':file.name.toLowerCase().includes('ktp')?'ktp':file.name.toLowerCase().includes('kk')?'kk':/image/i.test(file.type)?'photo':'other'
  const ins=await supabase.from('dapin_member_documents').insert({member_id:current.member.id,document_type:type,file_name:file.name,storage_path:path,mime_type:file.type,file_size:file.size})
  if(ins.error) throw ins.error
  await show(current.member.display_id||current.member.id)
 }catch(e){alert(e.message)}finally{busy=false}
}
async function promptCollateral(){
 const type=prompt('Jenis jaminan (BPKB, sertifikat, kendaraan, elektronik, dll):'); if(!type) return
 const name=prompt('Nama/deskripsi jaminan:'); if(!name) return
 const value=Number(prompt('Perkiraan nilai jaminan (angka):')||0)
 try{const {error}=await supabase.from('dapin_collaterals').insert({member_id:current.member.id,collateral_type:type,name,estimated_value:value||null}); if(error) throw error; await show(current.member.display_id||current.member.id)}catch(e){alert(e.message)}
}

document.addEventListener('change',e=>{const input=e.target.closest('[data-md-upload]'); if(input?.files?.[0]) upload(input.files[0])})
document.addEventListener('click',e=>{
 if(busy||document.querySelector('.md-overlay')) return
 const row=e.target.closest('.ac-table-row'); if(!row||!memberRow(row)) return
 const id=memberDisplayId(row); if(id) show(id)
})
