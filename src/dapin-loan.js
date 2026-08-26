import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(value || 0))

const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
}[c]))

let credit = null
let identity = null
let applications = []

async function loadData() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Session login tidak ditemukan.')

  const [creditResult, identityResult, loansResult] = await Promise.all([
    supabase.from('credit_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('identity_verifications').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('loan_applications').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  ])

  if (creditResult.error) throw creditResult.error
  if (identityResult.error) throw identityResult.error
  if (loansResult.error) throw loansResult.error

  credit = creditResult.data
  identity = identityResult.data
  applications = loansResult.data || []
}

export function renderLoanApplication() {
  const verificationReady = identity?.ktp_status === 'verified' &&
    identity?.liveness_status === 'verified' &&
    identity?.face_match_status === 'verified'

  return `
    <div class="loan-app-page">
      <div class="loan-hero">
        <div>
          <span class="eyebrow">DAPIN • PINJAMAN</span>
          <h1>Ajukan Pinjaman</h1>
          <p>Pengajuan, verifikasi, dan perhitungan pinjaman terhubung langsung ke DAPIN.</p>
        </div>
        <span class="loan-secure">🔒 Terlindungi</span>
      </div>
      ${verificationStep()}
      ${verificationReady ? loanStep() : ''}
      ${applications.length ? history(applications) : ''}
    </div>
  `
}

function verificationStep() {
  const i = identity || {}
  const ktp = i.ktp_status === 'verified'
  const live = i.liveness_status === 'verified'
  const face = i.face_match_status === 'verified'

  if (!ktp) return `
    <section class="loan-step-card">
      <div class="step-number">1</div><div class="loan-step-content">
        <span class="eyebrow">VERIFIKASI IDENTITAS</span>
        <h2>Verifikasi KTP sebelum mengajukan</h2>
        <p>Upload KTP untuk memulai proses verifikasi identitas.</p>
        <div class="eligibility-grid"><div>○ KTP belum diverifikasi</div><div>◉ Liveness diperlukan</div><div>◇ Face match diperlukan</div></div>
        <div class="ktp-upload">
          <div class="upload-icon">▣</div><div><strong>Upload KTP</strong><small>JPG, PNG atau PDF</small></div>
          <input id="ktp-file" type="file" accept="image/jpeg,image/png,application/pdf">
        </div>
        <div id="ktp-status" class="loan-note">Dokumen akan dicatat sebagai pengajuan verifikasi. Status verified hanya dapat diberikan oleh proses KYC/admin yang sah.</div>
      </div>
    </section>`

  if (!live || !face) return `
    <section class="loan-step-card">
      <div class="step-number">1</div><div class="loan-step-content">
        <span class="eyebrow">VERIFIKASI IDENTITAS</span><h2>Verifikasi wajah</h2>
        <p>KTP sudah terverifikasi. Selesaikan liveness dan face match sebelum pengajuan.</p>
        <div class="eligibility-grid">
          <div class="verified">✓ KTP terverifikasi</div>
          <div class="${live ? 'verified' : ''}">${live ? '✓' : '◉'} Liveness ${live ? 'terverifikasi' : 'diperlukan'}</div>
          <div class="${face ? 'verified' : ''}">${face ? '✓' : '◇'} Face match ${face ? 'terverifikasi' : 'diperlukan'}</div>
        </div>
        <button class="loan-primary" id="start-face">Mulai Verifikasi Wajah →</button>
        <div id="face-status" class="loan-note"></div>
      </div>
    </section>`

  return ''
}

function loanStep() {
  const limit = Number(credit?.loan_limit || 0)
  const rate = Number(credit?.interest_rate || 0)
  const tenors = [7,14,21,28].filter(d => credit?.[`tenor_${d}_days`])
  const options = tenors.length ? tenors : [7,14,21,28]
  const max = Math.floor(limit)
  return `
    <section class="loan-step-card">
      <div class="step-number">2</div><div class="loan-step-content">
        <span class="eyebrow">SIMULASI PINJAMAN</span><h2>Tentukan nominal dan tenor</h2>
        <p>Limit Anda <strong>${rupiah(limit)}</strong> • Bunga <strong>${rate}%</strong></p>
        <div class="loan-form-grid">
          <label>Nominal pinjaman<input id="loan-amount" type="number" min="10000" max="${max}" step="10000" value="${Math.min(Math.max(100000, 10000), max || 100000)}"></label>
          <label>Tenor<select id="loan-tenor">${options.map(d => `<option value="${d}">${d} hari</option>`).join('')}</select></label>
        </div>
        <div class="loan-calculator" id="loan-calculator"></div>
        <button class="loan-primary" id="continue-loan">Lanjutkan Pengajuan →</button>
        <div id="loan-error" class="loan-note"></div>
      </div>
    </section><div id="loan-form-area"></div>`
}

function calculate() {
  const amount = Number(document.querySelector('#loan-amount')?.value || 0)
  const days = Number(document.querySelector('#loan-tenor')?.value || 7)
  const rate = Number(credit?.interest_rate || 0)
  const interest = Math.round(amount * rate / 100 * 100) / 100
  const total = amount + interest
  const calculator = document.querySelector('#loan-calculator')
  if (!calculator) return
  calculator.innerHTML = `<div><span>Pokok pinjaman</span><b>${rupiah(amount)}</b></div><div><span>Bunga</span><b>${rate}% • ${rupiah(interest)}</b></div><div><span>Tenor</span><b>${days} hari</b></div><div class="total"><span>Total pengembalian</span><strong>${rupiah(total)}</strong></div>`
}

function applicationForm() {
  const amount = Number(document.querySelector('#loan-amount')?.value || 0)
  const days = Number(document.querySelector('#loan-tenor')?.value || 7)
  const area = document.querySelector('#loan-form-area')
  if (!area) return
  area.innerHTML = `
    <section class="loan-step-card" id="loan-details"><div class="step-number">3</div><div class="loan-step-content">
      <span class="eyebrow">DATA PENGAJUAN</span><h2>Lengkapi kebutuhan pinjaman</h2>
      <div class="loan-form-grid">
        <label>Tujuan pinjaman<select id="loan-purpose"><option>Modal usaha</option><option>Kebutuhan rumah tangga</option><option>Pendidikan</option><option>Kesehatan</option><option>Kebutuhan lainnya</option></select></label>
        <label>Pekerjaan<input id="loan-job" placeholder="Contoh: Wiraswasta"></label>
        <label>Penghasilan per bulan<input id="loan-income" type="number" min="0" placeholder="3000000"></label>
        <label>Catatan tambahan<textarea id="loan-note" placeholder="Jelaskan kebutuhan Anda secara singkat"></textarea></label>
      </div>
      <div class="loan-review"><span>Ringkasan</span><strong>${rupiah(amount)} • ${days} hari</strong><small>Bunga dan total dihitung server dari profil kredit Anda.</small></div>
      <label class="loan-check"><input id="loan-consent" type="checkbox"> Saya menyatakan data yang saya berikan benar dan memahami bahwa pengajuan akan ditinjau admin.</label>
      <button class="loan-primary" id="submit-loan">Kirim Pengajuan</button><div id="submit-status"></div>
    </div></section>`
  document.querySelector('#submit-loan')?.addEventListener('click', submitApplication)
}

async function submitApplication() {
  const status = document.querySelector('#submit-status')
  if (!document.querySelector('#loan-consent')?.checked) { if (status) status.textContent = 'Centang pernyataan terlebih dahulu.'; return }
  const amount = Number(document.querySelector('#loan-amount')?.value || 0)
  const days = Number(document.querySelector('#loan-tenor')?.value || 7)
  if (amount <= 0 || amount > Number(credit?.loan_limit || 0)) { if (status) status.textContent = 'Nominal melebihi limit atau tidak valid.'; return }
  const button = document.querySelector('#submit-loan')
  if (button) { button.disabled = true; button.textContent = 'Mengirim…' }
  try {
    const { data, error } = await supabase.rpc('submit_dapin_loan', {
      p_amount: amount,
      p_tenor_days: days,
      p_purpose: document.querySelector('#loan-purpose')?.value || null,
      p_job: document.querySelector('#loan-job')?.value || null,
      p_monthly_income: Number(document.querySelector('#loan-income')?.value || 0) || null,
      p_note: document.querySelector('#loan-note')?.value || null,
    })
    if (error) throw error
    if (status) status.innerHTML = `<div class="loan-success">✓ Pengajuan <b>${esc(data?.reference || '')}</b> berhasil dikirim dan menunggu review admin.</div>`
    await loadData()
  } catch (error) {
    if (status) status.innerHTML = `<div class="loan-note">${esc(error.message || 'Pengajuan gagal dikirim.')}</div>`
    if (button) { button.disabled = false; button.textContent = 'Kirim Pengajuan' }
  }
}

function history(list) {
  return `<section class="loan-history"><div class="loan-section-head"><div><span class="eyebrow">PENGAJUAN SAYA</span><h2>Riwayat Pengajuan</h2></div></div>${list.map(applicationCard).join('')}</section>`
}

function applicationCard(a) {
  const labels={submitted:'Menunggu Verifikasi',under_review:'Sedang Diverifikasi',approved:'Disetujui',rejected:'Ditolak',disbursed:'Dicairkan',active:'Berjalan',overdue:'Jatuh Tempo',completed:'Selesai'}
  return `<article class="application-card"><div><strong>${esc(a.reference || 'Pengajuan')}</strong><span>${rupiah(a.amount)} • ${a.tenor_days} hari • Bunga ${a.interest_rate}%</span><small>Total ${rupiah(a.total_repayment)} • ${new Date(a.created_at).toLocaleString('id-ID')}</small></div><span class="loan-status ${esc(a.status)}">${labels[a.status] || esc(a.status)}</span></article>`
}

export async function bindLoanEvents() {
  try { await loadData() } catch (e) { console.error('DAPIN load error:', e) }
  const page = document.querySelector('.page')
  if (page) page.innerHTML = renderLoanApplication()

  document.querySelector('#ktp-file')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0]
    const status = document.querySelector('#ktp-status')
    if (!file) return
    if (status) status.textContent = 'Menyimpan status dokumen…'
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('identity_verifications').upsert({
        user_id: user.id,
        ktp_status: 'submitted',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (error) throw error
      await loadData()
      if (status) status.innerHTML = '✓ KTP berhasil dikirim untuk verifikasi. Pengajuan akan terbuka setelah KTP, liveness, dan face match berstatus verified.'
    } catch (e) { if (status) status.textContent = e.message || 'Gagal menyimpan verifikasi KTP.' }
  })

  document.querySelector('#start-face')?.addEventListener('click', startFace)
  document.querySelector('#loan-amount')?.addEventListener('input', calculate)
  document.querySelector('#loan-tenor')?.addEventListener('change', calculate)
  document.querySelector('#continue-loan')?.addEventListener('click', applicationForm)
  calculate()
}

async function startFace() {
  const status = document.querySelector('#face-status')
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak didukung browser ini.')
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    stream.getTracks().forEach(t => t.stop())
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('identity_verifications').upsert({
      user_id: user.id,
      liveness_status: 'submitted',
      face_match_status: 'submitted',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw error
    if (status) status.innerHTML = '✓ Kamera berhasil diakses. Liveness dan face match menunggu layanan KYC yang sah.'
  } catch (e) {
    if (status) status.textContent = e.message || 'Kamera tidak dapat digunakan. Izinkan akses kamera lalu coba lagi.'
  }
}
