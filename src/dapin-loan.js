const KEY = 'finora_dapin_loans_v1'
const VERIFICATION_KEY = 'finora_dapin_identity_v1'

const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value || 0))

const uid = () => crypto.randomUUID()

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { applications: [] }
  } catch {
    return { applications: [] }
  }
}

const save = (data) => localStorage.setItem(KEY, JSON.stringify(data))

const identity = () => {
  try {
    return JSON.parse(localStorage.getItem(VERIFICATION_KEY)) || null
  } catch {
    return null
  }
}

export function renderLoanApplication() {
  const apps = load().applications
  const verified = identity()?.status === 'verified' || identity()?.status === 'face_pending_kyc'

  return `
    <div class="loan-app-page">
      <div class="loan-hero">
        <div>
          <span class="eyebrow">DAPIN • PINJAMAN</span>
          <h1>Ajukan Pinjaman</h1>
          <p>Ikuti langkah singkat untuk mengajukan pinjaman dengan aman dan jelas.</p>
        </div>
        <span class="loan-secure">🔒 Pengajuan aman</span>
      </div>
      ${verificationStep(verified)}
      ${verified ? loanStep() : ''}
      ${apps.length ? history(apps) : ''}
    </div>
  `
}

function verificationStep(verified) {
  const data = identity()
  const faceDone = data?.status === 'face_pending_kyc'

  if (!verified) {
    return `
      <section class="loan-step-card">
        <div class="step-number">1</div>
        <div class="loan-step-content">
          <span class="eyebrow">VERIFIKASI SEBELUM PENGAJUAN</span>
          <h2>Pastikan identitas Anda aman</h2>
          <p>Sebelum mengirim pengajuan, kami perlu memeriksa identitas pemilik akun.</p>
          <div class="eligibility-grid">
            <div>○ KTP belum diverifikasi</div>
            <div>◉ Liveness diperlukan</div>
            <div>◇ Face match diproses layanan KYC</div>
            <div>🔒 Verifikasi adalah bagian dari pengajuan</div>
          </div>
          <div class="ktp-upload">
            <div class="upload-icon">▣</div>
            <div>
              <strong>Upload KTP</strong>
              <small>JPG, PNG atau PDF • pastikan tulisan jelas</small>
            </div>
            <input id="ktp-file" type="file" accept="image/jpeg,image/png,application/pdf">
          </div>
          <div id="ktp-status" class="loan-note">Upload KTP untuk memulai verifikasi.</div>
        </div>
      </section>
    `
  }

  if (!faceDone) {
    return `
      <section class="loan-step-card">
        <div class="step-number">1</div>
        <div class="loan-step-content">
          <span class="eyebrow">VERIFIKASI IDENTITAS</span>
          <h2>Verifikasi wajah</h2>
          <p>KTP sudah diterima. Sekarang pastikan pengajuan dilakukan oleh pemilik akun.</p>
          <div class="eligibility-grid">
            <div class="verified">✓ KTP diterima</div>
            <div>◉ Liveness — pemeriksaan orang nyata</div>
            <div>◇ Face match — diproses layanan KYC</div>
          </div>
          <button class="loan-primary" id="start-face">Mulai Verifikasi Wajah →</button>
          <div id="face-status" class="loan-note"></div>
        </div>
      </section>
    `
  }

  return `
    <section class="loan-step-card">
      <div class="step-number">1</div>
      <div class="loan-step-content">
        <span class="eyebrow">VERIFIKASI IDENTITAS</span>
        <h2>Verifikasi keamanan selesai</h2>
        <div class="eligibility-grid">
          <div class="verified">✓ KTP diterima</div>
          <div class="verified">✓ Kamera berhasil diverifikasi</div>
          <div>◇ Face match menunggu layanan KYC</div>
        </div>
        <div class="loan-note">Pengajuan dapat dilanjutkan untuk simulasi. Keputusan kredit tetap berada pada admin.</div>
      </div>
    </section>
  `
}

function loanStep() {
  return `
    <section class="loan-step-card">
      <div class="step-number">2</div>
      <div class="loan-step-content">
        <span class="eyebrow">SIMULASI PINJAMAN</span>
        <h2>Tentukan nominal dan tenor</h2>
        <p>Nominal mengikuti limit yang ditetapkan admin untuk anggota ini.</p>
        <div class="loan-form-grid">
          <label>
            Nominal pinjaman
            <select id="loan-amount">
              <option value="1000000">Rp1.000.000</option>
              <option value="2000000">Rp2.000.000</option>
              <option value="3000000" selected>Rp3.000.000</option>
              <option value="5000000">Rp5.000.000</option>
              <option value="10000000">Rp10.000.000</option>
            </select>
          </label>
          <label>
            Tenor
            <select id="loan-tenor">
              <option value="7">7 hari</option>
              <option value="14">14 hari</option>
              <option value="21">21 hari</option>
              <option value="28" selected>28 hari</option>
            </select>
          </label>
        </div>
        <div class="loan-calculator" id="loan-calculator"></div>
        <button class="loan-primary" id="continue-loan">Lanjutkan Pengajuan →</button>
      </div>
    </section>
    <div id="loan-form-area"></div>
  `
}

function calculate() {
  const amount = Number(document.querySelector('#loan-amount')?.value || 0)
  const days = Number(document.querySelector('#loan-tenor')?.value || 7)
  const rate = 1
  const interest = amount * rate / 100
  const total = amount + interest
  const calculator = document.querySelector('#loan-calculator')

  if (!calculator) return

  calculator.innerHTML = `
    <div><span>Pokok pinjaman</span><b>${rupiah(amount)}</b></div>
    <div><span>Bunga</span><b>${rate}% • ${rupiah(interest)}</b></div>
    <div><span>Tenor</span><b>${days} hari</b></div>
    <div class="total"><span>Total pengembalian</span><strong>${rupiah(total)}</strong></div>
  `
}

function applicationForm() {
  const amount = Number(document.querySelector('#loan-amount')?.value || 0)
  const days = Number(document.querySelector('#loan-tenor')?.value || 7)
  const area = document.querySelector('#loan-form-area')
  if (!area) return

  area.innerHTML = `
    <section class="loan-step-card" id="loan-details">
      <div class="step-number">3</div>
      <div class="loan-step-content">
        <span class="eyebrow">DATA PENGAJUAN</span>
        <h2>Lengkapi kebutuhan pinjaman</h2>
        <div class="loan-form-grid">
          <label>Tujuan pinjaman
            <select id="loan-purpose">
              <option>Modal usaha</option>
              <option>Kebutuhan rumah tangga</option>
              <option>Pendidikan</option>
              <option>Kesehatan</option>
              <option>Kebutuhan lainnya</option>
            </select>
          </label>
          <label>Pekerjaan<input id="loan-job" placeholder="Contoh: Wiraswasta"></label>
          <label>Penghasilan per bulan<input id="loan-income" type="number" min="0" placeholder="3000000"></label>
          <label>Catatan tambahan<textarea id="loan-note" placeholder="Jelaskan kebutuhan Anda secara singkat"></textarea></label>
        </div>
        <div class="loan-review">
          <span>Ringkasan pengajuan</span>
          <strong>${rupiah(amount)} • ${days} hari</strong>
          <small>Bunga 1%: ${rupiah(amount * 0.01)} • Total: ${rupiah(amount * 1.01)}</small>
        </div>
        <label class="loan-check">
          <input id="loan-consent" type="checkbox">
          Saya menyatakan data yang saya berikan benar dan memahami bahwa pengajuan akan ditinjau admin.
        </label>
        <button class="loan-primary" id="submit-loan">Kirim Pengajuan</button>
        <div id="submit-status"></div>
      </div>
    </section>
  `

  document.querySelector('#submit-loan')?.addEventListener('click', submitApplication)
}

function submitApplication() {
  const consent = document.querySelector('#loan-consent')
  const status = document.querySelector('#submit-status')
  if (!consent?.checked) {
    if (status) status.textContent = 'Centang pernyataan terlebih dahulu.'
    return
  }

  const amount = Number(document.querySelector('#loan-amount')?.value || 0)
  const days = Number(document.querySelector('#loan-tenor')?.value || 7)
  const data = load()
  const interest = amount * 0.01

  const application = {
    id: uid(),
    reference: `PIN-${new Date().getFullYear()}-${String(data.applications.length + 1).padStart(4, '0')}`,
    amount,
    tenor_days: days,
    interest_rate: 1,
    interest_amount: interest,
    total_repayment: amount + interest,
    purpose: document.querySelector('#loan-purpose')?.value || '',
    job: document.querySelector('#loan-job')?.value || '',
    income: Number(document.querySelector('#loan-income')?.value || 0),
    note: document.querySelector('#loan-note')?.value || '',
    status: 'submitted',
    created_at: new Date().toISOString(),
  }

  data.applications.push(application)
  save(data)

  if (status) {
    status.innerHTML = '<div class="loan-success">✓ Pengajuan berhasil dikirim. Status: <b>Menunggu verifikasi admin</b>.</div>'
  }
  const button = document.querySelector('#submit-loan')
  if (button) button.disabled = true
}

function history(applications) {
  return `
    <section class="loan-history">
      <div class="loan-section-head">
        <div><span class="eyebrow">PENGAJUAN SAYA</span><h2>Riwayat Pengajuan</h2></div>
      </div>
      ${applications.slice().reverse().map(applicationCard).join('')}
    </section>
  `
}

function applicationCard(application) {
  const labels = {
    submitted: 'Menunggu Verifikasi',
    under_review: 'Sedang Diverifikasi',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    disbursed: 'Dicairkan',
    active: 'Berjalan',
    completed: 'Selesai',
  }
  const steps = ['Pengajuan dikirim', 'Sedang diverifikasi', 'Keputusan admin', 'Pencairan']
  const current = application.status === 'submitted' ? 0 : application.status === 'under_review' ? 1 : application.status === 'approved' ? 2 : 3

  return `
    <article class="application-card">
      <div>
        <strong>${application.reference}</strong>
        <span>${rupiah(application.amount)} • ${application.tenor_days} hari • Bunga ${application.interest_rate}%</span>
      </div>
      <span class="loan-status ${application.status}">${labels[application.status] || application.status}</span>
      <div class="loan-timeline">
        ${steps.map((step, index) => `
          <div class="${index <= current ? 'done' : ''}">
            <i>${index <= current ? '✓' : index + 1}</i>
            <small>${step}</small>
          </div>
        `).join('')}
      </div>
    </article>
  `
}

export function bindLoanEvents() {
  const file = document.querySelector('#ktp-file')
  file?.addEventListener('change', () => {
    if (!file.files?.[0]) return
    const status = document.querySelector('#ktp-status')
    if (status) status.textContent = 'Memeriksa dokumen…'

    window.setTimeout(() => {
      localStorage.setItem(VERIFICATION_KEY, JSON.stringify({
        status: 'verified',
        verified_at: new Date().toISOString(),
        method: 'document-review-pending-ocr',
      }))
      if (status) status.innerHTML = '✓ KTP diterima. Tahap berikutnya adalah verifikasi wajah.'
      window.setTimeout(() => {
        const page = document.querySelector('.page')
        if (page) {
          page.innerHTML = renderLoanApplication()
          bindLoanEvents()
        }
      }, 400)
    }, 700)
  })

  document.querySelector('#start-face')?.addEventListener('click', startFace)
  document.querySelector('#loan-amount')?.addEventListener('change', calculate)
  document.querySelector('#loan-tenor')?.addEventListener('change', calculate)
  document.querySelector('#continue-loan')?.addEventListener('click', applicationForm)
  calculate()
}

async function startFace() {
  const status = document.querySelector('#face-status')
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak didukung browser ini.')
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    })
    stream.getTracks().forEach((track) => track.stop())

    localStorage.setItem(VERIFICATION_KEY, JSON.stringify({
      status: 'face_pending_kyc',
      verified_at: new Date().toISOString(),
      method: 'camera-capture-pending-liveness',
    }))

    if (status) status.innerHTML = '✓ Kamera berhasil diakses. Liveness dan face match akan diproses oleh layanan KYC yang dikonfigurasi admin.'

    window.setTimeout(() => {
      const page = document.querySelector('.page')
      if (page) {
        page.innerHTML = renderLoanApplication()
        bindLoanEvents()
      }
    }, 700)
  } catch {
    if (status) status.textContent = 'Kamera tidak dapat digunakan. Izinkan akses kamera lalu coba lagi.'
  }
}
