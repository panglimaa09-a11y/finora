const KEY='finora_dapin_v2'
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
const total=a=>(a||[]).reduce((s,x)=>s+Number(x.amount||0),0)
const esc=s=>String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]))

const style=document.createElement('style')
style.textContent=`
.dapin-report-charts{margin-top:18px;background:#0b111b;border:1px solid #202c3d;border-radius:20px;padding:20px}.report-chart-head{margin-bottom:16px}.report-chart-head span{font-size:9px;letter-spacing:.16em;color:#f472b6;font-weight:800}.report-chart-head h2{margin:5px 0;font-size:20px}.report-chart-head p{margin:0;color:#7d899c;font-size:11px}.report-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.report-chart-card{background:#0f1722;border:1px solid #253247;border-radius:16px;padding:16px}.report-chart-card.wide{grid-column:1/-1}.report-chart-card header{display:flex;justify-content:space-between;gap:12px;align-items:start;margin-bottom:14px}.report-chart-card header span{display:block;color:#6f7c90;font-size:8px;letter-spacing:.14em;font-weight:800}.report-chart-card h3{margin:4px 0 0;font-size:15px}.report-chart-card header>strong{font-size:14px;color:#f5f7fb}.dapin-chart-bars{display:grid;gap:11px}.chart-bar-row{display:grid;grid-template-columns:130px 1fr 120px;align-items:center;gap:10px;font-size:10px}.chart-bar-row>span{color:#9da8b8}.chart-bar-row>b{text-align:right;color:#e7ebf2;font-size:10px}.chart-track{height:9px;background:#172235;border-radius:99px;overflow:hidden}.chart-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#8b6cff,#4ea1ff)}@media(max-width:900px){.report-chart-grid{grid-template-columns:1fr}.report-chart-card.wide{grid-column:auto}.chart-bar-row{grid-template-columns:100px 1fr 100px}}
`
document.head.appendChild(style)

function bars(items){const max=Math.max(...items.map(x=>Number(x.value)||0),1);return `<div class="dapin-chart-bars">${items.map(x=>`<div class="chart-bar-row"><span>${esc(x.label)}</span><div class="chart-track"><i style="width:${Math.max(2,((Number(x.value)||0)/max)*100)}%"></i></div><b>${x.money?money(x.value):Number(x.value||0).toLocaleString('id-ID')}</b></div>`).join('')}</div>`}

function inject(){
 const root=document.querySelector('.dapin-admin-panel .dapin-main')
 if(!root||!root.querySelector('.reports-workspace')||root.querySelector('[data-report-charts]'))return
 const d=read(); const savings=total(d.savings), loans=total(d.loans), payments=total(d.payments)
 const cashIn=savings+payments, cashOut=loans
 const typeData=['Simpanan Pokok','Simpanan Wajib','Simpanan Sukarela'].map(label=>({label:label.replace('Simpanan ','').toUpperCase(),value:total((d.savings||[]).filter(x=>x.type===label)),money:true}))
 const loanActive=(d.loans||[]).filter(x=>Number(x.amount||0)>Number(x.paid||0)).length
 const loanPaid=(d.loans||[]).filter(x=>Number(x.amount||0)<=Number(x.paid||0)).length
 const txIn=(d.transactions||[]).filter(x=>x.direction!=='out').length
 const txOut=(d.transactions||[]).filter(x=>x.direction==='out').length
 const section=document.createElement('section'); section.className='dapin-report-charts'; section.dataset.reportCharts='1'
 section.innerHTML=`<div class="report-chart-head"><div><span>ANALYTICS</span><h2>Grafik Operasional DAPIN</h2><p>Semua fitur dirangkum dalam satu pusat laporan.</p></div></div><div class="report-chart-grid"><article class="report-chart-card wide"><header><div><span>ARUS KEUANGAN</span><h3>Masuk vs Keluar</h3></div><strong>${money(cashIn-cashOut)}</strong></header>${bars([{label:'Total Masuk',value:cashIn,money:true},{label:'Total Pinjaman',value:cashOut,money:true},{label:'Net Operasional',value:Math.max(0,cashIn-cashOut),money:true}])}</article><article class="report-chart-card"><header><div><span>SIMPANAN</span><h3>Komposisi Simpanan</h3></div></header>${bars(typeData)}</article><article class="report-chart-card"><header><div><span>PINJAMAN</span><h3>Status Kredit</h3></div></header>${bars([{label:'Berjalan',value:loanActive},{label:'Lunas',value:loanPaid}])}</article><article class="report-chart-card"><header><div><span>ANGSURAN</span><h3>Total Pembayaran</h3></div></header>${bars([{label:'Angsuran Masuk',value:payments,money:true}])}</article><article class="report-chart-card"><header><div><span>TRANSAKSI</span><h3>Debit & Kredit</h3></div></header>${bars([{label:'Masuk',value:txIn},{label:'Keluar',value:txOut}])}</article><article class="report-chart-card"><header><div><span>ANGGOTA</span><h3>Aktivitas Keanggotaan</h3></div></header>${bars([{label:'Total Anggota',value:(d.members||[]).length},{label:'Dengan Pinjaman',value:new Set((d.loans||[]).filter(x=>Number(x.amount||0)>Number(x.paid||0)).map(x=>x.member_id)).size}])}</article></div>`
 root.querySelector('.reports-workspace')?.appendChild(section)
}
const observer=new MutationObserver(inject); observer.observe(document.documentElement,{childList:true,subtree:true}); inject()
