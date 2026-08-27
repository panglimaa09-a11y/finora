import { supabase } from './main.js'
import { initDapin, renderDapin, getDapinState } from './dapin.js'

let applied = false
let role = 'member'
let busy = false

async function getRole(user) {
  if (!supabase || !user?.id) return 'member'
  const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (error) {
    console.warn('DAPIN role lookup failed:', error.message)
    return 'member'
  }
  return String(data?.role || 'member').toLowerCase()
}

function renderDapinAdminNav(root) {
  const section = root.querySelector('.dapin-sidebar-section')
  if (!section || section.querySelector('[data-role-runtime-nav]')) return
  const items = [
    ['anggota', '♙', 'Anggota'],
    ['simpanan', '◈', 'Simpanan'],
    ['pinjaman', '▣', 'Pinjaman'],
    ['angsuran', '◷', 'Angsuran'],
    ['transaksi', '↔', 'Transaksi'],
    ['laporan', '▥', 'Laporan'],
  ]
  const wrap = document.createElement('div')
  wrap.dataset.roleRuntimeNav = '1'
  wrap.innerHTML = items.map(([view, icon, label]) => `<button class="side-item dapin-nav-item" type="button" data-dapin-nav="${view}"><span>${icon}</span><b>${label}</b></button>`).join('')
  section.appendChild(wrap)
}

function markAdminShell() {
  document.querySelectorAll('.dapin-sidebar-section .side-item b').forEach(el => {
    if (el.textContent === 'Dashboard') el.textContent = 'Dashboard Admin'
  })
  document.querySelectorAll('.session-user small').forEach(el => {
    if (/Member|Anggota/i.test(el.textContent || '')) el.textContent = 'Administrator'
  })
}

function applyAdminView() {
  if (role !== 'admin' && role !== 'super_admin') return
  const page = document.querySelector('.page')
  if (!page?.querySelector('.dapin-app')) return
  if (busy) return
  const desired = renderDapin()
  const current = page.querySelector('.dapin-app')
  if (!current || current.outerHTML === desired) return
  busy = true
  try {
    page.innerHTML = desired
    renderDapinAdminNav(document)
    markAdminShell()
    applied = true
  } finally {
    busy = false
  }
}

async function sync(user) {
  if (!user?.id) return
  role = await getRole(user)
  if (role !== 'admin' && role !== 'super_admin') return
  const merged = {
    ...user,
    user_metadata: { ...(user.user_metadata || {}), role },
  }
  await initDapin(merged)
  setTimeout(applyAdminView, 0)
}

if (supabase) {
  const boot = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await sync(session.user)
  }
  void boot()
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) void sync(session.user)
    else { role = 'member'; applied = false }
  })

  const observer = new MutationObserver(() => {
    if (role === 'admin' || role === 'super_admin') {
      applyAdminView()
      if (applied) {
        renderDapinAdminNav(document)
        markAdminShell()
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
