import './dapin-member-detail.css'
import { supabase } from './main.js'

const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))
const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
let opening = false

function memberIdFromRow(row){
  return row?.querySelector('[data-id]')?.dataset?.id || row?.querySelector('[data-member-status]')?.dataset?.memberStatus || null
}

async function openMember(id){
  if(opening || !id || !supabase) return
  opening = true
  try {
    const {data,error}=await supabase.from('dapin_members').select('*').eq('id',id).maybeSingle()
    if(error) throw error
    if(!data) throw new Error('Anggota tidak ditemukan.')

    const {data:docs,error:docError}=await supabase
      .from('dapin_member_documents')
      .select('id,document_type,file_name,storage_path,mime_type,file_size,created_at')
      .eq('member_id',id)
      .order('created_at',{ascending:false})

    const root=document.createElement('div')
    root.className='md-overlay'
    root.innerHTML=`<div class="md-modal">
      <header>
        <div class="md-avatar">${esc((data.name||'A')[0].toUpperCase())}</div>
        <div><span>DAPIN MEMBER</span><h2>${esc(data.name||'—')}</h2><small>${esc(data.display_id||data.code||'')}</small></div>
        <button class="md-close" type="button" data-md-open-close>×</button>
      </header>
      <div class="md-body">
        <div class="md-summary">
          <div><span>Status Anggota</span><strong>${esc(data.status||'active')}</strong></div>
          <div><span>Bagian</span><strong>${esc(data.department||'—')}</strong></div>
          <div><span>Jabatan</span><strong>${esc(data.position||'—')}</strong></div>
          <div><span>Verifikasi</span><strong>${esc(data.approval_status||'pending')}</strong></div>
        </div>
        <div class="md-grid">
          <section class="md-card"><div class="md-card-head"><span>IDENTITAS</span><h3>Data Anggota</h3></div>
            <div class="md-field"><span>ID Anggota</span><strong>${esc(data.display_id||data.code||'—')}</strong></div>
            <div class="md-field"><span>Nama</span><strong>${esc(data.name||'—')}</strong></div>
            <div class="md-field"><span>NIK</span><strong>${esc(data.nik||'—')}</strong></div>
            <div class="md-field"><span>No. KK</span><strong>${esc(data.kk_number||'—')}</strong></div>
            <div class="md-field"><span>Tempat/Tanggal Lahir</span><strong>${esc([data.birth_place,data.birth_date].filter(Boolean).join(', ')||'—')}</strong></div>
            <div class="md-field"><span>Jenis Kelamin</span><strong>${esc(data.gender||'—')}</strong></div>
          </section>
          <section class="md-card"><div class="md-card-head"><span>KEPEGAWAIAN</span><h3>Data Karyawan</h3></div>
            <div class="md-field"><span>Bagian / Divisi</span><strong>${esc(data.department||'—')}</strong></div>
            <div class="md-field"><span>Jabatan</span><strong>${esc(data.position||'—')}</strong></div>
            <div class="md-field"><span>Status Karyawan</span><strong>${esc(data.employee_status||'pending')}</strong></div>
            <div class="md-field"><span>Tanggal Bergabung</span><strong>${esc(data.join_date||'—')}</strong></div>
            <div class="md-field"><span>Approval</span><strong>${esc(data.approval_status||'pending')}</strong></div>
          </section>
        </div>
        <section class="md-card"><div class="md-card-head"><span>DOKUMEN</span><h3>Dokumen Anggota <small class="md-count">${docError?'—':((docs||[]).length)} file</small></h3></div>
          <div class="md-empty">${docError?'Dokumen belum dapat dimuat.':((docs||[]).length?'Dokumen tersedia di penyimpanan private.':'Belum ada dokumen anggota.')}</div>
        </section>
      </div>
    </div>`
    root.addEventListener('click',e=>{
      if(e.target.closest('[data-md-open-close]') || e.target===root) root.remove()
    })
    document.body.appendChild(root)
  }catch(e){
    console.error('DAPIN member detail:',e)
    window.alert(e?.message||'Gagal membuka detail anggota.')
  }finally{ opening=false }
}

document.addEventListener('click',e=>{
  if(opening || document.querySelector('.md-overlay')) return
  if(e.target.closest('button,a,input,select,textarea,label')) return
  const row=e.target.closest('.member-row,.ac-table .ac-table-row')
  if(!row) return
  const id=memberIdFromRow(row)
  if(!id) return
  e.preventDefault()
  e.stopImmediatePropagation()
  void openMember(id)
},true)
