const DAPIN_ADMIN = [
  ['dashboard','⌂','Dashboard'],
  ['anggota','♙','Anggota'],
  ['simpanan','◈','Simpanan'],
  ['pinjaman','▣','Pinjaman'],
  ['angsuran','◷','Angsuran'],
  ['transaksi','↔','Transaksi'],
  ['laporan','▥','Laporan'],
  ['grafik','▤','Grafik'],
]
const DAPIN_MEMBER = [
  ['dashboard','⌂','Dashboard'],
  ['simpanan','◈','Simpanan Saya'],
  ['pinjaman','▣','Pinjaman Saya'],
  ['angsuran','◷','Angsuran'],
  ['transaksi','↔','Riwayat Transaksi'],
  ['profil','♙','Profil'],
]

const isDapin = () => document.querySelector('.dapin-app')
const isAdmin = () => document.querySelector('.session-user small')?.textContent?.trim() === 'Administrator'

function injectStyle() {
  if (document.getElementById('dapin-unified-nav-style')) return
  const style = document.createElement('style')
  style.id = 'dapin-unified-nav-style'
  style.textContent = `
    .dapin-app{display:block!important;min-width:0!important}
    .dapin-app>.dapin-sidebar{display:none!important}
    .dapin-app>.dapin-main{width:100%!important;min-width:0!important;margin:0!important;padding:0!important}
    .dapin-mobile-head{display:none!important}
    .dapin-unified-group{margin-top:4px;padding-left:8px;display:grid;gap:2px}
    .dapin-unified-group .side-item{min-height:36px;margin:1px 0;padding:8px 10px 8px 16px;border-radius:9px;opacity:.92}
    .dapin-unified-group .side-item span{width:22px;font-size:14px}
    .dapin-unified-group .side-item b{font-size:11px;font-weight:600}
    .dapin-unified-group .side-item.active{background:linear-gradient(90deg,rgba(139,108,255,.14),rgba(139,108,255,.035));box-shadow:inset 2px 0 0 #8b6cff}
    .dapin-unified-group .side-item.active span{color:#a696ff}
    .dapin-section-label{display:flex;align-items:center;justify-content:space-between;padding:0 9px 6px;color:#58677d;font-size:9px;letter-spacing:.17em;font-weight:800}
    .dapin-section-label em{font-style:normal;font-size:8px;letter-spacing:.05em;color:#55ddb0;border:1px solid #55ddb022;border-radius:999px;padding:3px 6px}
    .dapin-parent{position:relative}
    .dapin-parent:after{content:'⌄';margin-left:auto;font-size:11px;color:#627087;transition:transform .18s}
    .dapin-parent.open:after{transform:rotate(180deg)}
    @media(max-width:900px){.dapin-unified-group{padding-left:6px}.dapin-unified-group .side-item{min-height:38px}}
  `
  document.head.appendChild(style)
}

function closeLegacyDapinNav() {
  document.querySelectorAll('.dapin-sidebar').forEach((sidebar) => {
    sidebar.setAttribute('aria-hidden', 'true')
  })
}

function findGlobalDapinSection() {
  const sections = [...document.querySelectorAll('.sidebar .side-section')]
  return sections.find((section) => section.textContent?.includes('DAPIN Balongbendo')) || null
}

function getCurrentView() {
  const active = document.querySelector('.dapin-sidebar .dapin-nav.active')
  if (document.querySelector('.dapin-graph-page')) return 'grafik'
  return active?.dataset?.dapinView || 'dashboard'
}

function ensureUnifiedNav() {
  const section = findGlobalDapinSection()
  if (!section || section.dataset.unified === '1') return

  const parent = section.querySelector('[data-view="dapin"]')
  if (!parent) return

  section.dataset.unified = '1'
  parent.classList.add('dapin-parent')

  const label = document.createElement('div')
  label.className = 'dapin-section-label'
  label.innerHTML = '<span>DAPIN MODULE</span><em>Integrated</em>'

  const group = document.createElement('div')
  group.className = 'dapin-unified-group'
  group.dataset.dapinUnified = '1'

  const admin = isAdmin()
  const items = admin ? DAPIN_ADMIN : DAPIN_MEMBER
  const current = getCurrentView()
  group.innerHTML = items.map(([id, icon, text]) => `
    <button class="side-item ${current === id ? 'active' : ''}" type="button" data-dapin-unified-view="${id}">
      <span>${icon}</span><b>${text}</b>
    </button>
  `).join('')

  parent.insertAdjacentElement('afterend', label)
  label.insertAdjacentElement('afterend', group)
  parent.classList.add('open')
}

function syncUnifiedNav() {
  const section = findGlobalDapinSection()
  const group = section?.querySelector('[data-dapin-unified]')
  if (!group) return
  const current = getCurrentView()
  group.querySelectorAll('[data-dapin-unified-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.dapinUnifiedView === current)
  })
}

function activateDapinView(view) {
  if (view === 'grafik') {
    const graphButton = document.querySelector('.dapin-sidebar [data-dapin-graph-nav]')
    if (graphButton) {
      graphButton.click()
      return
    }
    const dashboard = document.querySelector('.sidebar [data-view="dapin"]')
    if (dashboard) dashboard.click()
    return
  }

  const legacy = document.querySelector(`.dapin-sidebar [data-dapin-view="${CSS.escape(view)}"]`)
  if (legacy) {
    legacy.click()
    return
  }

  const dashboard = document.querySelector('.sidebar [data-view="dapin"]')
  if (dashboard) dashboard.click()
}

document.addEventListener('click', (event) => {
  const unified = event.target.closest?.('[data-dapin-unified-view]')
  if (unified) {
    event.preventDefault()
    event.stopImmediatePropagation()
    activateDapinView(unified.dataset.dapinUnifiedView)
    return
  }

  const dapinRoot = event.target.closest?.('.sidebar [data-view="dapin"]')
  if (dapinRoot) {
    event.preventDefault()
    event.stopImmediatePropagation()
    const dashboard = document.querySelector('.dapin-sidebar [data-dapin-view="dashboard"]')
    if (dashboard) {
      dashboard.click()
      return
    }
    dapinRoot.click()
  }
}, true)

function sync() {
  injectStyle()
  if (isDapin()) closeLegacyDapinNav()
  ensureUnifiedNav()
  syncUnifiedNav()
}

new MutationObserver(sync).observe(document.body, { childList: true, subtree: true })
window.setInterval(sync, 800)
injectStyle()
sync()
