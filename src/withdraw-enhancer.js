import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

const BANKS = [
  ['014', 'BCA'], ['002', 'BRI'], ['008', 'Mandiri'], ['009', 'BNI'],
  ['022', 'CIMB Niaga'], ['011', 'Danamon'], ['013', 'Permata'], ['200', 'BTN'],
  ['422', 'BSI'], ['535', 'SeaBank'], ['542', 'Bank Jago'], ['153', 'Sinarmas'],
  ['028', 'OCBC NISP'], ['023', 'UOB Indonesia'], ['110', 'BTPN / SMBC Indonesia'],
]

const EWALLETS = [
  ['DANA', 'DANA'], ['GOPAY', 'GoPay'], ['OVO', 'OVO'],
  ['SHOPEEPAY', 'ShopeePay'], ['LINKAJA', 'LinkAja'],
]

const money = (n) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(n || 0))

const esc = (s = '') => String(s).replace(/[&<>'"]/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[c]))

let lastEnhanced = null
let walletSnapshot = null

function getPageRoot() {
  return document.querySelector('#app .page')
}

function isWithdrawPage(root) {
  const h1 = root?.querySelector('h1')
  return h1?.textContent?.trim() === 'Tarik Dana'
}

async function loadWallet() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesi login tidak tersedia.')

  const { data, error } = await supabase
    .from('wallets')
    .select('id,available_balance,pending_balance,status')
    .eq('user_id', session.user.id)
    .single()

  if (error) throw error
  walletSnapshot = data
  return data
}

async function renderWithdraw() {
  const root = getPageRoot()
  if (!root || !isWithdrawPage(root) || lastEnhanced === root) return
  lastEnhanced = root

  let wallet
  try {
    wallet = await loadWallet()
  } catch (error) {
    console.error('withdraw-enhancer wallet load failed', error)
    wallet = { available_balance: 0, pending_balance: 0, status: 'unknown' }
  }

  const balanceText = money(wallet.available_balance)

  root.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow">PAYOUT</span>
        <h1>Tarik Dana</h1>
        <p>Tarik saldo FINORA ke rekening bank atau dompet digital Anda.</p>
      </div>
      <div class="withdraw-balance-badge">
        <span>Saldo tersedia</span>
        <strong id="wd-available">${esc(balanceText)}</strong>
      </div>
    </div>

    <section class="panel form-panel withdraw-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">PENCAIRAN DANA</div>
          <h2>Ke mana dana akan dikirim?</h2>
          <p>Pastikan nama pemilik sesuai dengan rekening atau akun tujuan.</p>
        </div>
        <span class="secure">✓ Protected</span>
      </div>

      <div class="withdraw-type-grid">
        <button type="button" class="withdraw-type active" data-destination="bank">
          <span class="withdraw-type-icon">🏦</span>
          <span><strong>Bank</strong><small>Transfer ke rekening bank</small></span>
        </button>
        <button type="button" class="withdraw-type" data-destination="ewallet">
          <span class="withdraw-type-icon">📱</span>
          <span><strong>Dompet Digital</strong><small>DANA, GoPay, OVO, dan lainnya</small></span>
        </button>
      </div>

      <div class="form-grid">
        <label>Nominal penarikan
          <input id="wd-amount" type="number" min="10000" step="1000" placeholder="10000">
          <small class="field-help">Minimum Rp10.000</small>
        </label>
        <label id="wd-bank-wrap">Pilih Bank
          <select id="wd-bank">
            <option value="">Pilih bank tujuan</option>
            ${BANKS.map(([code, name]) => `<option value="${code}">${esc(name)}</option>`).join('')}
          </select>
        </label>
        <label id="wd-ewallet-wrap" style="display:none">Pilih Dompet Digital
          <select id="wd-ewallet">
            <option value="">Pilih dompet digital</option>
            ${EWALLETS.map(([code, name]) => `<option value="${code}">${esc(name)}</option>`).join('')}
          </select>
        </label>
        <label>Nomor Rekening / Nomor HP
          <input id="wd-account" inputmode="numeric" placeholder="Nomor rekening bank">
        </label>
        <label>Nama Pemilik
          <input id="wd-name" placeholder="Nama sesuai rekening / akun">
        </label>
      </div>

      <div class="withdraw-summary" id="wd-summary">
        <div><span>Saldo tersedia</span><strong id="wd-summary-before">${esc(balanceText)}</strong></div>
        <div><span>Nominal ditarik</span><strong id="wd-summary-amount">Rp0</strong></div>
        <div class="total"><span>Saldo setelah pengajuan</span><strong id="wd-summary-after">${esc(balanceText)}</strong></div>
      </div>

      <button id="wd-submit" class="primary wide">Ajukan Penarikan</button>
      <div id="wd-status" class="loan-note"></div>
      <p class="tiny">Saldo akan ditahan saat pengajuan dibuat. Pencairan akhir mengikuti proses payout provider.</p>
    </section>
  `

  if (!document.getElementById('withdraw-enhancer-style')) {
    const style = document.createElement('style')
    style.id = 'withdraw-enhancer-style'
    style.textContent = `
      .withdraw-balance-badge{display:flex;flex-direction:column;align-items:flex-end;gap:4px;padding:14px 18px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.04)}
      .withdraw-balance-badge span{font-size:11px;opacity:.65;text-transform:uppercase;letter-spacing:.08em}.withdraw-balance-badge strong{font-size:20px}
      .withdraw-type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:22px 0}
      .withdraw-type{display:flex;align-items:center;gap:12px;padding:15px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.03);color:inherit;text-align:left;cursor:pointer}
      .withdraw-type.active{border-color:rgba(99,102,241,.7);box-shadow:0 0 0 1px rgba(99,102,241,.25) inset;background:rgba(99,102,241,.08)}
      .withdraw-type-icon{font-size:24px}.withdraw-type strong,.withdraw-type small{display:block}.withdraw-type small{opacity:.6;margin-top:3px}
      .field-help{display:block;margin-top:6px;font-size:12px;opacity:.6}.withdraw-summary{margin:22px 0;padding:16px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
      .withdraw-summary div{display:flex;justify-content:space-between;padding:9px 0}.withdraw-summary .total{border-top:1px solid rgba(255,255,255,.08);margin-top:6px;padding-top:14px}.withdraw-summary .total strong{font-size:18px}
      @media(max-width:720px){.withdraw-type-grid{grid-template-columns:1fr}.withdraw-balance-badge{align-items:flex-start}.page-head{gap:14px;flex-direction:column}.withdraw-balance-badge{width:100%}}
    `
    document.head.appendChild(style)
  }

  bindWithdraw(wallet)
}

function bindWithdraw(initialWallet) {
  let destination = 'bank'
  const amount = document.querySelector('#wd-amount')
  const bankWrap = document.querySelector('#wd-bank-wrap')
  const ewalletWrap = document.querySelector('#wd-ewallet-wrap')
  const account = document.querySelector('#wd-account')
  const submit = document.querySelector('#wd-submit')
  const status = document.querySelector('#wd-status')
  const summaryBefore = document.querySelector('#wd-summary-before')
  const summaryAmount = document.querySelector('#wd-summary-amount')
  const summaryAfter = document.querySelector('#wd-summary-after')

  const updateSummary = () => {
    const value = Number(amount?.value || 0)
    const balance = Number(walletSnapshot?.available_balance || initialWallet?.available_balance || 0)
    if (summaryBefore) summaryBefore.textContent = money(balance)
    if (summaryAmount) summaryAmount.textContent = money(value)
    if (summaryAfter) summaryAfter.textContent = money(Math.max(balance - value, 0))
  }

  document.querySelectorAll('[data-destination]').forEach((button) => {
    button.addEventListener('click', () => {
      destination = button.dataset.destination || 'bank'
      document.querySelectorAll('[data-destination]').forEach((b) => b.classList.toggle('active', b === button))
      if (bankWrap) bankWrap.style.display = destination === 'bank' ? '' : 'none'
      if (ewalletWrap) ewalletWrap.style.display = destination === 'ewallet' ? '' : 'none'
      if (account) account.placeholder = destination === 'bank' ? 'Nomor rekening bank' : 'Nomor HP / nomor akun e-wallet'
    })
  })

  amount?.addEventListener('input', updateSummary)
  updateSummary()

  submit?.addEventListener('click', async () => {
    const value = Number(amount?.value || 0)
    const bankCode = destination === 'bank'
      ? document.querySelector('#wd-bank')?.value || ''
      : document.querySelector('#wd-ewallet')?.value || ''
    const accountNumber = String(account?.value || '').trim()
    const accountName = String(document.querySelector('#wd-name')?.value || '').trim()

    if (!Number.isInteger(value) || value < 10000) {
      status.textContent = 'Minimum penarikan Rp10.000.'
      return
    }
    if (value > Number(walletSnapshot?.available_balance || 0)) {
      status.textContent = `Saldo tidak mencukupi. Saldo tersedia ${money(walletSnapshot?.available_balance || 0)}.`
      return
    }
    if (!bankCode || !accountNumber || !accountName) {
      status.textContent = 'Lengkapi bank/dompet, nomor tujuan, dan nama pemilik.'
      return
    }

    submit.disabled = true
    submit.textContent = 'Memproses…'
    status.textContent = ''

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sesi login berakhir. Silakan login kembali.')

      const { data, error } = await supabase.functions.invoke('create-withdrawal', {
        body: {
          amount: value,
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: accountName,
          destination_type: destination,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (error) throw new Error(error.message || 'Edge Function create-withdrawal gagal.')
      if (data?.error) throw new Error(data.error)

      walletSnapshot = await loadWallet()
      document.getElementById('wd-available').textContent = money(walletSnapshot.available_balance)
      status.innerHTML = `✓ Penarikan dibuat. ID transaksi: <strong>${esc(data?.withdrawal_id || '—')}</strong>. Status awal: <strong>Pending</strong>.`
      submit.textContent = 'Pengajuan terkirim'
      updateSummary()
    } catch (error) {
      status.textContent = error?.message || 'Penarikan gagal dibuat.'
      submit.disabled = false
      submit.textContent = 'Ajukan Penarikan'
    }
  })
}

const observer = new MutationObserver(() => renderWithdraw())
observer.observe(document.body, { childList: true, subtree: true })
renderWithdraw()
