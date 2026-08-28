import { supabase } from './main.js'

let busy = false
const ADMIN_ROLES = new Set(['admin', 'super_admin'])
const ADMIN_ITEMS = [
  ['anggota', '♙', 'Anggota'],
  ['simpanan', '◈', 'Simpanan'],
  ['pinjaman', '▣', 'Pinjaman'],
  ['angsuran', '◷', 'Angsuran'],
  ['transaksi', '↔', 'Transaksi'],
  ['laporan', '▥', 'Laporan'],
]

async function getRole(user) {
  if (!supabase || !user?.id) return 'member'
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return String(data?.role || 'member').toLowerCase()
}

function injectAdminNavigation() {
  const section = document.querySelector('.dapin-sidebar-section')
  if (!section) return
  const existing = section.querySelector('[data-dapin-admin-access]')
  if (existing) return

  const wrap = document.createElement('div')
  wrap.dataset.dapinAdminAccess = '1'
  wrap.innerHTML = ADMIN_ITEMS.map(([view, icon, label]) =>
    `<button class="side-item dapin-nav-item" type="button" data-dapin-nav="${view}"><span>${icon}</span><b>${label}</b></button>`
  ).join('')

  section.appendChild(wrap)

  const style = document.createElement('style')
  style.id = 'dapin-admin-access-fix-style'
  style.textContent = `
    [data-dapin-admin-access]{display:contents}
    .dapin-sidebar-section .dapin-nav-item{cursor:pointer}
  `
  document.head.appendChild(style)
}

async function sync() {
  if (busy || !supabase) return
  busy = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const role = await getRole(user)
    const metadataRole = String(user.user_metadata?.role || '').toLowerCase()

    if (ADMIN_ROLES.has(role) && metadataRole !== role) {
      const { error } = await supabase.auth.updateUser({
        data: { ...(user.user_metadata || {}), role },
      })
      if (error) {
        console.warn('DAPIN admin role sync failed:', error.message)
        return
      }
      // No full page reload here. updateUser emits USER_UPDATED, which the
      // role system modules (dapin-role-system.js, dapin-role-runtime-fix.js)
      // already listen to and re-bootstrap from, so the admin UI updates
      // without one. The previous window.location.reload() raced with the
      // reload in dapin-member-link.js on the Google OAuth callback page and
      // caused the post-login redirect loop / bounce back to sign-in.
      window.dispatchEvent(new CustomEvent('dapin:admin-role-synced', { detail: { role } }))
      return
    }

    if (ADMIN_ROLES.has(role)) injectAdminNavigation()
  } finally {
    busy = false
  }
}

if (supabase) {
  void sync()
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user && ['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
      void sync()
    }
  })

  const observer = new MutationObserver(() => {
    const nav = document.querySelector('.dapin-sidebar-section')
    if (nav) void sync()
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
