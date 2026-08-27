import { supabase } from './main.js'

const esc = s => String(s ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]))
let renderedFor = ''

async function loadRoleTarget() {
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'super_admin') return

  const rows = [...document.querySelectorAll('.ac-table-row')]
  const profilePanel = [...document.querySelectorAll('.ac-panel')].find(p => /Administrator & Role/i.test(p.textContent || ''))
  if (!profilePanel) return
  const table = profilePanel.querySelector('.ac-table')
  if (!table) return

  const signature = table.textContent || ''
  if (renderedFor === signature) return
  renderedFor = signature

  const old = profilePanel.querySelector('[data-dapin-role-manager]')
  old?.remove()

  const box = document.createElement('div')
  box.dataset.dapinRoleManager = '1'
  box.className = 'dapin-role-manager'
  box.innerHTML = `
    <div class="drm-head">
      <div><strong>Kelola Hak Akses</strong><small>Hanya Super Admin yang dapat mengubah role.</small></div>
      <span class="drm-badge">SUPER ADMIN</span>
    </div>
    <div class="drm-grid">
      <div class="drm-note">Admin mendapatkan akses operasional DAPIN. Super Admin tetap satu-satunya role yang dapat mengatur role.</div>
      <div class="drm-controls">
        <select class="drm-select" data-drm-user>
          <option value="">Pilih pengguna</option>
        </select>
        <select class="drm-select" data-drm-role>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button class="drm-save" type="button" data-drm-save>Simpan Role</button>
      </div>
    </div>`
  profilePanel.appendChild(box)

  const select = box.querySelector('[data-drm-user]')
  const { data: profiles, error } = await supabase.from('profiles').select('id,full_name,email,role').order('created_at', { ascending: true })
  if (error) {
    box.querySelector('.drm-note').textContent = error.message
    return
  }

  for (const p of profiles || []) {
    if (p.id === user.id) continue
    const option = document.createElement('option')
    option.value = p.id
    option.textContent = `${p.full_name || p.email || p.id} — ${p.role || 'member'}`
    select.appendChild(option)
  }

  box.addEventListener('change', e => {
    if (e.target.matches('[data-drm-user]')) {
      const selected = profiles?.find(p => p.id === e.target.value)
      if (selected) box.querySelector('[data-drm-role]').value = selected.role === 'admin' ? 'admin' : 'member'
    }
  })

  box.addEventListener('click', async e => {
    const btn = e.target.closest('[data-drm-save]')
    if (!btn) return
    const id = box.querySelector('[data-drm-user]').value
    const role = box.querySelector('[data-drm-role]').value
    if (!id) return window.alert('Pilih pengguna terlebih dahulu.')
    if (!window.confirm(`Tetapkan pengguna ini sebagai ${role.toUpperCase()}?`)) return
    btn.disabled = true
    btn.textContent = 'Menyimpan...'
    try {
      const { error: rpcError } = await supabase.rpc('dapin_set_user_role', { p_user_id: id, p_role: role })
      if (rpcError) throw rpcError
      window.alert(`Role berhasil diubah menjadi ${role}.`)
      renderedFor = ''
      const refresh = document.querySelector('[data-ac-refresh]')
      refresh?.click()
    } catch (err) {
      window.alert(err?.message || 'Gagal mengubah role.')
    } finally {
      btn.disabled = false
      btn.textContent = 'Simpan Role'
    }
  })
}

function injectStyle() {
  if (document.getElementById('dapin-role-manager-style')) return
  const style = document.createElement('style')
  style.id = 'dapin-role-manager-style'
  style.textContent = `
    .dapin-role-manager{margin-top:18px;padding:16px;border:1px solid rgba(116,100,201,.28);border-radius:16px;background:rgba(20,27,44,.7)}
    .drm-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.drm-head strong{display:block;color:#edf2f8;font-size:14px}.drm-head small{display:block;color:#8997ab;font-size:11px;margin-top:4px}.drm-badge{font-size:9px;font-weight:800;letter-spacing:.08em;padding:6px 8px;border-radius:999px;background:rgba(116,100,201,.16);color:#b9adff}.drm-grid{display:grid;gap:12px;margin-top:14px}.drm-note{color:#aab7c9;font-size:11px;line-height:1.5}.drm-controls{display:grid;grid-template-columns:1fr 160px 140px;gap:10px}.drm-select{min-height:40px;border:1px solid #2d3c56;background:#101925;color:#edf2f8;border-radius:10px;padding:9px 10px}.drm-save{border:0;border-radius:10px;background:#6956bd;color:#fff;font-weight:800;cursor:pointer}.drm-save:disabled{opacity:.6}@media(max-width:720px){.drm-controls{grid-template-columns:1fr}.drm-save{min-height:40px}}
  `
  document.head.appendChild(style)
}

const observer = new MutationObserver(() => {
  if (document.querySelector('.finora-admin-page')) {
    injectStyle()
    void loadRoleTarget()
  }
})
observer.observe(document.body, { childList: true, subtree: true })
