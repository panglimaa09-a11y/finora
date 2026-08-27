import { supabase } from './main.js'

const esc = s => String(s ?? '').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;' }[c]))
let loading = false

async function loadMemberFromModal(modal) {
  const displayId = modal.querySelector('header small')?.textContent?.trim()
  if (!displayId || !supabase) return null
  const { data, error } = await supabase.from('dapin_members').select('*').eq('display_id', displayId).maybeSingle()
  if (error) throw error
  return data || null
}

function employmentCard(member) {
  const statusMap = { pending:'Menunggu', active:'Aktif', inactive:'Tidak Aktif', terminated:'Berakhir' }
  const approvalMap = { pending:'Menunggu Verifikasi', approved:'Disetujui', rejected:'Ditolak' }
  return `<section class="md-card md-employment-card" data-employment-card>
    <div class="md-card-head"><div><span>KEPEGAWAIAN</span><h3>Data Karyawan</h3></div><button class="md-button" type="button" data-employment-edit>✎ Edit</button></div>
    <div class="md-summary" style="grid-template-columns:repeat(3,1fr)">
      <div><span>Bagian / Divisi</span><strong>${esc(member.department || '—')}</strong></div>
      <div><span>Jabatan</span><strong>${esc(member.position || member.occupation || '—')}</strong></div>
      <div><span>Status Karyawan</span><strong>${esc(statusMap[member.employee_status] || member.employee_status || 'Menunggu')}</strong></div>
    </div>
    <div class="md-field"><span>Tanggal Bergabung</span><strong>${esc(member.join_date || member.joined_at?.slice(0,10) || '—')}</strong></div>
    <div class="md-field"><span>Status Verifikasi</span><strong>${esc(approvalMap[member.approval_status] || member.approval_status || 'Menunggu Verifikasi')}</strong></div>
  </section>`
}

function employmentForm(member) {
  const options = [['pending','Menunggu'],['active','Aktif'],['inactive','Tidak Aktif'],['terminated','Berakhir']]
  const approvals = [['pending','Menunggu Verifikasi'],['approved','Disetujui'],['rejected','Ditolak']]
  return `<section class="md-edit-card md-employment-card" data-employment-card>
    <div class="md-card-head"><div><span>KEPEGAWAIAN</span><h3>Edit Data Karyawan</h3></div></div>
    <form data-employment-form>
      <div class="md-edit-grid">
        <label class="md-edit-field"><span>Bagian / Divisi</span><input name="department" value="${esc(member.department || '')}" placeholder="Contoh: Produksi"></label>
        <label class="md-edit-field"><span>Jabatan</span><input name="position" value="${esc(member.position || member.occupation || '')}" placeholder="Contoh: Operator Produksi"></label>
        <label class="md-edit-field"><span>Status Karyawan</span><select name="employee_status"><option value="">Pilih...</option>${options.map(([v,t])=>`<option value="${v}" ${member.employee_status===v?'selected':''}>${t}</option>`).join('')}</select></label>
        <label class="md-edit-field"><span>Tanggal Bergabung</span><input name="join_date" type="date" value="${esc(member.join_date || member.joined_at?.slice(0,10) || '')}"></label>
        <label class="md-edit-field md-edit-wide"><span>Status Verifikasi</span><select name="approval_status">${approvals.map(([v,t])=>`<option value="${v}" ${member.approval_status===v?'selected':''}>${t}</option>`).join('')}</select></label>
      </div>
      <div class="md-edit-actions"><button type="button" class="md-button" data-employment-cancel>Batal</button><button type="submit" class="md-button md-button-primary" data-employment-save>Simpan</button></div>
    </form>
  </section>`
}

async function renderEmployment(modal, formMode = false, member = null) {
  if (loading) return
  loading = true
  try {
    const data = member || await loadMemberFromModal(modal)
    if (!data) return
    const host = modal.querySelector('.md-body')
    if (!host) return
    const existing = host.querySelector('[data-employment-card]')
    if (existing) existing.remove()
    const node = document.createElement('div')
    node.innerHTML = formMode ? employmentForm(data) : employmentCard(data)
    host.insertBefore(node.firstElementChild, host.children[1] || null)
  } finally { loading = false }
}

async function saveEmployment(form, modal) {
  const member = await loadMemberFromModal(modal)
  if (!member) throw new Error('Data anggota tidak ditemukan.')
  const fd = new FormData(form)
  const button = form.querySelector('[data-employment-save]')
  if (button) { button.disabled = true; button.textContent = 'Menyimpan…' }
  try {
    const { data, error } = await supabase.rpc('dapin_update_member_employment', {
      p_member_id: member.id,
      p_department: fd.get('department') || null,
      p_position: fd.get('position') || null,
      p_employee_status: fd.get('employee_status') || null,
      p_join_date: fd.get('join_date') || null,
      p_approval_status: fd.get('approval_status') || null,
    })
    if (error) throw error
    await renderEmployment(modal, false, data)
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Simpan' }
  }
}

function observe() {
  const observer = new MutationObserver(() => {
    document.querySelectorAll('.md-overlay .md-body').forEach(body => {
      const modal = body.closest('.md-overlay')
      if (modal && !body.querySelector('[data-employment-card]')) void renderEmployment(modal)
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

document.addEventListener('click', e => {
  const modal = e.target.closest('.md-overlay')
  if (!modal) return
  if (e.target.closest('[data-employment-edit]')) { e.preventDefault(); void renderEmployment(modal, true); return }
  if (e.target.closest('[data-employment-cancel]')) { e.preventDefault(); void renderEmployment(modal) }
})

document.addEventListener('submit', e => {
  const form = e.target.closest('[data-employment-form]')
  if (!form) return
  const modal = form.closest('.md-overlay')
  if (!modal) return
  e.preventDefault()
  void saveEmployment(form, modal).catch(err => alert(err?.message || 'Gagal menyimpan data karyawan.'))
})

if (supabase) observe()
