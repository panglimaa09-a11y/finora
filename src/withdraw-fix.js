import { supabase } from './main.js'

const BANKS = [
  ['002','BRI'],['008','Mandiri'],['009','BNI'],['011','Danamon'],['013','Permata'],['014','BCA'],
  ['016','Maybank'],['019','Panin'],['022','CIMB Niaga'],['023','UOB Indonesia'],['028','OCBC NISP'],
  ['046','DBS Indonesia'],['087','Bukopin'],['095','JTrust Bank'],['097','Mayapada'],['110','BTPN / SMBC Indonesia'],
  ['112','Bank Jago'],['113','Artha Graha'],['115','Bank Woori Saudara'],['116','BCA Syariah'],['117','QNB Indonesia'],
  ['118','Bank Sahabat Sampoerna'],['119','KEB Hana Indonesia'],['120','Shinhan Indonesia'],['121','MNC Bank'],
  ['122','Bank Neo Commerce'],['147','Muamalat'],['153','Sinarmas'],['200','BTN'],['422','BSI'],['506','Bank Mega Syariah'],
  ['513','Bank Ina Perdana'],['535','SeaBank'],['542','Bank Jago'],['564','Mandiri Taspen'],['567','Bank Aladin Syariah']
]

const EWALLETS = [
  ['DANA','DANA'],['GOPAY','GoPay'],['OVO','OVO'],['SHOPEEPAY','ShopeePay'],['LINKAJA','LinkAja']
]

const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
const esc = s => String(s ?? '').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))

async function getSession(){
  const {data:{session}} = await supabase.auth.getSession()
  if(!session) throw new Error('Session login berakhir. Silakan login kembali.')
  return session
}

async function loadCurrentWallet(){
  const session = await getSession()
  const {data,error} = await supabase
    .from('wallets')
    .select('id,available_balance,pending_balance,status')
    .eq('user_id',session.user.id)
    .single()
  if(error) throw error
  return data
}

function renderWithdrawForm(){
  const root = document.querySelector('.page')
  if(!root) return

  const panel = root.querySelector('.form-panel')
  if(!panel) return

  const current = Number(panel.dataset.withdrawBalance || 0)

  panel.innerHTML = `
    <div class="panel-head">
      <div>
        <h2>Tarik Dana</h2>
        <p>Saldo tersedia akan dibaca langsung dari wallet akun yang sedang login.</p>
      </div>
      <span class="secure">✓ Wallet Active</span>
    </div>

    <div class="wallet-hero" style="margin-bottom:18px">
      <div>
        <span>SALDO TERSEDIA</span>
        <strong id="withdrawAvailable">${money(current)}</strong>
        <small id="withdrawPending">Pending ${money(0)}</small>
      </div>
    </div>

    <div class="form-grid">
      <label>Nominal Ditarik
        <input id="withdrawAmount" type="number" min="10000" step="1000" placeholder="10000" />
      </label>

      <label>Tujuan
        <select id="destinationType">
          <option value="bank">🏦 Bank</option>
          <option value="ewallet">📱 Dompet Digital</option>
        </select>
      </label>

      <label id="bankField">Pilih Bank
        <select id="bankCode">
          <option value="">Pilih bank</option>
          ${BANKS.map(([code,name])=>`<option value="${code}">${esc(name)}</option>`).join('')}
        </select>
      </label>

      <label id="ewalletField" style="display:none">Pilih Dompet Digital
        <select id="ewalletCode">
          <option value="">Pilih dompet</option>
          ${EWALLETS.map(([code,name])=>`<option value="${code}">${esc(name)}</option>`).join('')}
        </select>
      </label>

      <label>Nomor Rekening / Nomor HP
        <input id="accountNumber" inputmode="numeric" placeholder="Nomor rekening / nomor HP" />
      </label>

      <label>Nama Pemilik
        <input id="accountName" placeholder="Nama sesuai rekening / akun" />
      </label>
    </div>

    <div class="notice" id="withdrawSummary" style="margin-top:16px">
      <strong>Ringkasan</strong><br>
      Saldo tersedia <b id="summaryBefore">${money(current)}</b><br>
      Saldo setelah pengajuan <b id="summaryAfter">${money(current)}</b>
    </div>

    <button class="primary wide" id="withdrawFixSubmit">Ajukan Penarikan</button>
    <p class="tiny">Saldo dikurangi oleh server saat pengajuan berhasil. Transfer ke bank/e-wallet tetap mengikuti status payout provider.</p>
  `

  panel.dataset.withdrawBalance = String(current)
  bindWithdrawEvents()
}

function bindWithdrawEvents(){
  const type = document.getElementById('destinationType')
  const amount = document.getElementById('withdrawAmount')
  const bankField = document.getElementById('bankField')
  const ewalletField = document.getElementById('ewalletField')
  const accountNumber = document.getElementById('accountNumber')
  const summaryBefore = document.getElementById('summaryBefore')
  const summaryAfter = document.getElementById('summaryAfter')

  const sync = () => {
    const isWallet = type.value === 'ewallet'
    bankField.style.display = isWallet ? 'none' : ''
    ewalletField.style.display = isWallet ? '' : 'none'
    accountNumber.placeholder = isWallet ? 'Nomor HP / nomor akun e-wallet' : 'Nomor rekening bank'
  }

  const recalc = () => {
    const balance = Number(document.getElementById('withdrawAvailable')?.dataset?.value || 0)
    const after = Math.max(0, balance - Number(amount.value || 0))
    summaryAfter.textContent = money(after)
  }

  type.addEventListener('change', sync)
  amount.addEventListener('input', () => {
    const balanceText = document.getElementById('withdrawAvailable')?.textContent || ''
    const balance = Number(balanceText.replace(/[^0-9]/g,'')) || 0
    summaryBefore.textContent = money(balance)
    summaryAfter.textContent = money(Math.max(0, balance - Number(amount.value || 0)))
  })

  document.getElementById('withdrawFixSubmit').addEventListener('click', async () => {
    const btn = document.getElementById('withdrawFixSubmit')
    const amountValue = Number(amount.value)
    const destinationType = type.value
    const bankCode = destinationType === 'bank'
      ? document.getElementById('bankCode').value
      : document.getElementById('ewalletCode').value
    const accountNumberValue = accountNumber.value.trim()
    const accountNameValue = document.getElementById('accountName').value.trim()

    if(!Number.isInteger(amountValue) || amountValue < 10000){
      alert('Minimum penarikan Rp10.000.'); return
    }
    if(!bankCode || !accountNumberValue || !accountNameValue){
      alert('Lengkapi tujuan, nomor rekening/HP, dan nama pemilik.'); return
    }

    try {
      btn.disabled = true
      btn.textContent = 'Memproses…'
      const wallet = await loadCurrentWallet()
      if(wallet.status !== 'active') throw new Error('Wallet sedang tidak aktif.')
      if(Number(wallet.available_balance) < amountValue){
        throw new Error(`Saldo tidak mencukupi. Saldo tersedia ${money(wallet.available_balance)}.`)
      }

      const session = await getSession()
      const {data,error} = await supabase.functions.invoke('create-withdrawal',{
        body:{
          amount:amountValue,
          bank_code:bankCode,
          account_number:accountNumberValue,
          account_name:accountNameValue,
          destination_type:destinationType
        },
        headers:{Authorization:`Bearer ${session.access_token}`}
      })

      if(error) throw new Error(error.message || 'Edge Function create-withdrawal gagal.')
      if(data?.error) throw new Error(data.error)

      alert(`Penarikan berhasil dibuat. ID: ${data.withdrawal_id || '—'}`)
      const refreshed = await loadCurrentWallet()
      document.getElementById('withdrawAvailable').textContent = money(refreshed.available_balance)
      document.getElementById('summaryBefore').textContent = money(refreshed.available_balance)
      document.getElementById('summaryAfter').textContent = money(refreshed.available_balance)
      amount.value = ''
    } catch(error){
      alert(error.message || String(error))
    } finally {
      btn.disabled = false
      btn.textContent = 'Ajukan Penarikan'
    }
  })

  sync()
}

let lastView = ''
let running = false
async function apply(){
  if(running) return
  const page = document.querySelector('.page')
  if(!page) return
  const text = page.textContent || ''
  const isWithdraw = /PAYOUT|Tarik Dana/.test(text) && page.querySelector('.form-panel')
  if(!isWithdraw){ lastView=''; return }
  if(lastView !== 'withdraw-fix'){
    running=true
    try{
      const wallet = await loadCurrentWallet()
      const panel = page.querySelector('.form-panel')
      panel.dataset.withdrawBalance = String(wallet.available_balance)
      renderWithdrawForm()
      const available = document.getElementById('withdrawAvailable')
      const pending = document.getElementById('withdrawPending')
      if(available){ available.textContent = money(wallet.available_balance); available.dataset.value = String(wallet.available_balance) }
      if(pending) pending.textContent = `Pending ${money(wallet.pending_balance)}`
      lastView='withdraw-fix'
    }catch(error){
      console.error('withdraw-fix',error)
    }finally{ running=false }
  }
}

const observer = new MutationObserver(()=>apply())
observer.observe(document.body,{subtree:true,childList:true})
setInterval(()=>apply(),1000)
apply()
