const KEY='finora_dapin_v2'
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
const total=a=>(a||[]).reduce((s,x)=>s+Number(x.amount||0),0)
const esc=s=>String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]))

function bars(items){
 const max=Math.max(...items.map(x=>Number(x.value)||0),1)
 return `<div class="dapin-chart-bars">${items.map(x=>`<div class="chart-bar-row"><span>${esc(x.label)}</span><div class="chart-track"><i style="width:${Math.max(2,((Number(x.value)||0)/max)*100)}%"></i></div><b>${money(x.value)}</b></div>`).join('')}</div>`
}

function inject(){
 const root=document.querySelector('.dapin-admin-panel .dapin-main')
 if(!root||!root.querySelector('.reports-workspace')||root.querySelector('[data-report-charts]'))return
 const d=read();
 const savings=total(d.savings), loans=total(d.loans), payments=total(d.payments)
 const cashIn=savings+payments
 const cashOut=loans
 const typeData=['Simpanan Pokok','Simpanan Wajib','Simpanan Sukarela'].map(label=>({label:label.replace('Simpanan ',' '),value:total((d.savings||[]).filter(x=>x.type===label))}))
 const loanActive=(d.loans||[]).filter(x=>Number(x.amount||0)>Number(x.paid||0)).length
 const loanPaid=(d.loans||[]).filter(x=>Number(x.amount||0)<=Number(x.paid||0)).length
 const txIn=(d.transactions||[]).filter(x=>x.direction!=='out').length
 const txOut=(d.transactions||[]).filter(x=>x.direction==='out').length
 const section=document.createElement('section')
 section.className='dapin-report-charts'
 section.dataset.reportCharts='1'
 section.innerHTML=`
   <div class="report-chart-head"><div><span>ANALYTICS</span><h2>Grafik Operasional DAPIN</h2><p>Semua modul dirangkum dalam satu pusat laporan.</p></div></div>
   <div class="report-chart-grid">
     <article class="report-chart-card wide"><header><div><span>ARUS KEUANGAN</span><h3>Masuk vs Keluar</h3></div><strong>${money(cashIn-cashOut)}</strong></header>${bars([{label:'Total Masuk',value:cashIn},{label:'Total Pinjaman',value:cashOut},{label:'Net Operasional',value:Math.max(0,cashIn-cashOut)}])}</article>
     <article class="report-chart-card"><header><div><span>SIMPANAN</span><h3>Komposisi Simpanan</h3></div></header>${bars(typeData)}</article>
     <article class="report-chart-card"><header><div><span>PINJAMAN</span><h3>Status Kredit</h3></div></header>${bars([{label:'Berjalan',value:loanActive},{label:'Lunas',value:loanPaid}])}</article>
     <article class="report-chart-card"><header><div><span>ANGSURAN</span><h3>Total Pembayaran</h3></div></header>${bars([{label:'Angsuran Masuk',value:payments}])}</article>
     <article class="report-chart-card"><header><div><span>TRANSAKSI</span><h3>Debit & Kredit</h3></div></header>${bars([{label:'Masuk',value:txIn},{label:'Keluar',value:txOut}])}</article>
     <article class="report-chart-card"><header><div><span>ANGGOTA</span><h3>Aktivitas Keanggotaan</h3></div></header>${bars([{label:'Total Anggota',value:(d.members||[]).length},{label:'Dengan Pinjaman',value:new Set((d.loans||[]).filter(x=>Number(x.amount||0)>Number(x.paid||0)).map(x=>x.member_id)).size}])}</article>
   </div>`
 const report= root.querySelector('.reports-workspace')
 if(report)report.appendChild(section)
}

const observer=new MutationObserver(inject)
observer.observe(document.documentElement,{childList:true,subtree:true})
inject()
