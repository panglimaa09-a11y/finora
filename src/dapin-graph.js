import { getDapinState } from './dapin.js'

const money = (n) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(n || 0))

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[c]))

const total = (rows = []) => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
const activeLoans = (rows = []) => rows.filter((row) => Number(row.amount || 0) > Number(row.paid || 0))
const outstanding = (rows = []) => total(activeLoans(rows).map((row) => ({ amount: Number(row.amount) - Number(row.paid || 0) })))

const bar = (label, value, max, formatter = money) => {
  const numeric = Number(value || 0)
  const percentage = Math.max(3, Math.min(100, (numeric / Math.max(Number(max) || 1, 1)) * 100))
  return `<div class="finora-chart-row"><span>${esc(label)}</span><div class="finora-chart-track"><i style="width:${percentage}%"></i></div><b>${formatter(numeric)}</b></div>`
}

export function renderDapinGraph() {
  const data = getDapinState()
  const members = data.members || []
  const savings = data.savings || []
  const loans = data.loans || []
  const payments = data.payments || []
  const transactions = data.transactions || []

  const saving = total(savings)
  const loan = total(loans)
  const payment = total(payments)
  const out = outstanding(loans)
  const active = activeLoans(loans).length
  const paid = loans.filter((row) => Number(row.amount || 0) <= Number(row.paid || 0)).length

  const pokok = total(savings.filter((row) => row.type === 'Simpanan Pokok'))
  const wajib = total(savings.filter((row) => row.type === 'Simpanan Wajib'))
  const sukarela = total(savings.filter((row) => row.type === 'Simpanan Sukarela'))
  const txIn = transactions.filter((row) => row.direction !== 'out').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const txOut = transactions.filter((row) => row.direction === 'out').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const maxFlow = Math.max(saving, payment, loan, 1)
  const maxStatus = Math.max(active, paid, 1)
  const maxMembers = Math.max(members.length, 1)
  const donutTotal = Math.max(pokok + wajib + sukarela, 1)
  const p1 = Math.round((pokok / donutTotal) * 100)
  const p2 = p1 + Math.round((wajib / donutTotal) * 100)

  return `<div class="dapin-graph-page">
    <div class="dapin-graph-hero">
      <div><span class="dapin-graph-kicker">VISUAL ANALYTICS</span><h1>Grafik DAPIN</h1><p>Analitik operasional DAPIN yang mengikuti data Supabase saat ini.</p></div>
      <div class="dapin-graph-live"><span>● LIVE DATA</span><strong>Sinkron dengan Supabase</strong><small>Diperbarui ${new Date().toLocaleTimeString('id-ID')}</small></div>
    </div>
    <div class="dapin-graph-kpis">
      <article><span>ANGGOTA</span><strong>${members.length}</strong></article>
      <article><span>SIMPANAN</span><strong>${money(saving)}</strong></article>
      <article><span>OUTSTANDING</span><strong>${money(out)}</strong></article>
      <article><span>ANGSURAN</span><strong>${money(payment)}</strong></article>
    </div>
    <div class="dapin-graph-grid">
      <section class="dapin-graph-card wide"><span>ARUS KEUANGAN</span><h2>Simpanan • Angsuran • Pinjaman</h2><div class="finora-chart-bars">${bar('Simpanan', saving, maxFlow)}${bar('Angsuran', payment, maxFlow)}${bar('Pinjaman', loan, maxFlow)}</div></section>
      <section class="dapin-graph-card"><span>SIMPANAN</span><h2>Komposisi Simpanan</h2><div class="dapin-graph-donut" style="background:conic-gradient(#7f66ff 0 ${p1}%,#4b9cff ${p1}% ${p2}%,#5be1ab ${p2}% 100%)"></div><div class="dapin-graph-legend"><div><span>Pokok</span><b>${money(pokok)}</b></div><div><span>Wajib</span><b>${money(wajib)}</b></div><div><span>Sukarela</span><b>${money(sukarela)}</b></div></div></section>
      <section class="dapin-graph-card"><span>PINJAMAN</span><h2>Status Kredit</h2><div class="finora-chart-bars">${bar('Berjalan', active, maxStatus, (n) => Number(n).toLocaleString('id-ID'))}${bar('Lunas', paid, maxStatus, (n) => Number(n).toLocaleString('id-ID'))}${bar('Outstanding', out, Math.max(out, loan, 1))}</div></section>
      <section class="dapin-graph-card"><span>ANGSURAN</span><h2>Pembayaran</h2><div class="finora-chart-bars">${bar('Total masuk', payment, Math.max(payment, 1))}</div><div class="dapin-graph-mini"><span>Catatan pembayaran</span><b>${payments.length}</b></div></section>
      <section class="dapin-graph-card"><span>TRANSAKSI</span><h2>Kas Masuk vs Keluar</h2><div class="finora-chart-bars">${bar('Masuk', txIn, Math.max(txIn, txOut, 1))}${bar('Keluar', txOut, Math.max(txIn, txOut, 1))}</div><div class="dapin-graph-mini"><span>Net transaksi</span><b>${money(txIn - txOut)}</b></div></section>
      <section class="dapin-graph-card"><span>ANGGOTA</span><h2>Aktivitas Keanggotaan</h2><div class="finora-chart-bars">${bar('Terdaftar', members.length, maxMembers, (n) => Number(n).toLocaleString('id-ID'))}${bar('Dengan pinjaman', new Set(activeLoans(loans).map((row) => row.member_id)).size, maxMembers, (n) => Number(n).toLocaleString('id-ID'))}</div><div class="dapin-graph-mini"><span>Pinjaman berjalan</span><b>${active}</b></div></section>
    </div>
    <div class="dapin-graph-foot">Grafik menggunakan data DAPIN yang tersimpan di Supabase.</div>
  </div>`
}

export function installDapinGraphStyles() {
  if(document.getElementById('dapin-graph-runtime-style')) return
  const style=document.createElement('style');style.id='dapin-graph-runtime-style';style.textContent=`.dapin-graph-page{display:grid;gap:14px}.dapin-graph-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-end}.dapin-graph-kicker{font-size:9px;letter-spacing:.15em;color:#a78bfa;font-weight:800}.dapin-graph-hero h1{margin:6px 0 4px;font-size:28px}.dapin-graph-hero p{margin:0;color:#8290a5;font-size:12px}.dapin-graph-live{border:1px solid #26364e;background:#0e1722;border-radius:12px;padding:10px 12px;min-width:170px}.dapin-graph-live span{display:block;color:#55ddb0;font-size:8px;font-weight:800}.dapin-graph-live strong{display:block;margin-top:4px;font-size:10px}.dapin-graph-live small{display:block;margin-top:3px;color:#68768b;font-size:8px}.dapin-graph-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.dapin-graph-kpis article,.dapin-graph-card{background:#0d151f;border:1px solid #223047;border-radius:16px;padding:16px}.dapin-graph-kpis span,.dapin-graph-card>span{display:block;color:#718096;font-size:8px;letter-spacing:.13em}.dapin-graph-kpis strong{display:block;font-size:19px;margin-top:6px}.dapin-graph-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:12px}.dapin-graph-card.wide{grid-row:span 2}.dapin-graph-card h2{font-size:15px;margin:5px 0 16px}.finora-chart-bars{display:grid;gap:12px}.finora-chart-row{display:grid;grid-template-columns:90px 1fr auto;gap:10px;align-items:center;font-size:9px}.finora-chart-track{height:9px;background:#172438;border-radius:99px;overflow:hidden}.finora-chart-track i{display:block;height:100%;background:#7f66ff;border-radius:99px}.dapin-graph-donut{width:150px;height:150px;border-radius:50%;margin:6px auto 14px;position:relative}.dapin-graph-donut:after{content:'';position:absolute;inset:27px;border-radius:50%;background:#0d151f}.dapin-graph-legend{display:grid;gap:8px}.dapin-graph-legend div,.dapin-graph-mini{display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid #1a2738;font-size:9px}.dapin-graph-legend span,.dapin-graph-mini span{color:#708097}.dapin-graph-foot{color:#65748a;font-size:8px}@media(max-width:800px){.dapin-graph-hero{align-items:flex-start;flex-direction:column}.dapin-graph-kpis{grid-template-columns:1fr 1fr}.dapin-graph-grid{grid-template-columns:1fr}.dapin-graph-card.wide{grid-row:auto}}@media(max-width:520px){.dapin-graph-kpis{grid-template-columns:1fr}}`
document.head.appendChild(style)
}
