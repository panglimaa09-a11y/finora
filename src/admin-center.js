import './admin-center.css'

const KEY = 'finora_dapin_v2'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))

function root(){ return document.querySelector('.admin-badge')?.closest('.page') }
function isAdminPage(){ return !!root() && root().querySelector('h1')?.textContent?.trim()==='Administration' }
function stat(label,value,meta){ return `<article class="ac-card"><span>${label}</span><strong>${value}</strong><small>${meta}</small></article>` }
function row(icon,title,desc,status='AKTIF',warn=false){ return `<div class="ac-row"><div><div class="ac-icon">${icon}</div><span><strong>${title}</strong><small>${desc}</small></span></div><span class="ac-pill ${warn?'ac-warn':''}">${status}</span></div>` }

function render(){
  const r=root(); if(!r || !isAdminPage() || r.querySelector('.finora-admin-page')) return
  const d=read(), members=d.members||[], savings=d.savings||[], loans=d.loans||[], payments=d.payments||[], tx=d.transactions||[]
  const outstanding=loans.reduce((s,x)=>s+Math.max(0,Number(x.amount||0)-Number(x.paid||0)),0)
  const incoming=[...savings,...payments].reduce((s,x)=>s+Number(x.amount||0),0)
  const outgoing=loans.reduce((s,x)=>s+Number(x.amount||0),0)
  const users=[['panglimaa09@gmail.com','SUPER ADMIN'],['deavani1705@gmail.com','ADMIN']]
  r.innerHTML=`
  <div class="finora-admin-page">
    <div class="ac-head"><div><span class="ac-kicker">PLATFORM CONTROL</span><h1>Feature Center</h1><p>Pusat pengelolaan, monitoring, keamanan, dan status seluruh fitur FINORA.</p></div><div class="ac-badge">● ADMIN SESSION • ${new Date().toLocaleTimeString('id-ID')}</div></div>
    <div class="ac-grid">${stat('ADMIN',users.length,'Akun administrator')}${stat('ANGGOTA DAPIN',members.length,'Data anggota')}${stat('TRANSAKSI',tx.length,'Aktivitas DAPIN')}${stat('OUTSTANDING',money(outstanding),'Sisa pinjaman')}</div>
    <nav class="ac-nav">
      <button class="ac-tab active" data-ac-tab="overview">Overview</button><button class="ac-tab" data-ac-tab="modules">Modul</button><button class="ac-tab" data-ac-tab="access">Akses</button><button class="ac-tab" data-ac-tab="security">Security</button><button class="ac-tab" data-ac-tab="activity">Aktivitas</button><button class="ac-tab" data-ac-tab="system">System</button>
    </nav>
    <div class="ac-view" data-ac-view="overview">
      <div class="ac-section-grid"><section class="ac-panel"><span class="ac-kicker">PLATFORM STATUS</span><h2>Ringkasan Operasional</h2><div class="ac-list">${row('W','Wallet','Top Up, saldo, dan ledger wallet')} ${row('D','DAPIN','Anggota, simpanan, pinjaman, angsuran')} ${row('G','Grafik','Analitik data DAPIN')} ${row('P','Payment','Payment provider dan settlement','SANDBOX',true)}</div></section><section class="ac-panel"><span class="ac-kicker">FINANCIAL SNAPSHOT</span><h2>Ringkasan Keuangan</h2><div class="ac-statline"><span>Total simpanan</span><b>${money(savings.reduce((s,x)=>s+Number(x.amount||0),0))}</b></div><div class="ac-statline"><span>Total angsuran</span><b>${money(payments.reduce((s,x)=>s+Number(x.amount||0),0))}</b></div><div class="ac-statline"><span>Total pencairan</span><b>${money(outgoing)}</b></div><div class="ac-statline"><span>Arus bersih DAPIN</span><b>${money(incoming-outgoing)}</b></div></section></div>
    </div>
    <div class="ac-view" data-ac-view="modules" hidden><section class="ac-panel"><span class="ac-kicker">FEATURE MANAGEMENT</span><h2>Modul FINORA</h2><div class="ac-health-grid">${[['⌂','Dashboard','Core dashboard'],['W','Wallet','Top Up • Transaksi • Tarik Dana'],['D','DAPIN','Koperasi & simpan pinjam'],['G','Grafik','Visual analytics'],['L','Laporan','Reporting DAPIN'],['A','Admin Center','Platform control']].map(x=>`<div class="ac-health"><div class="ac-icon">${x[0]}</div><strong>${x[1]}</strong><small>${x[2]}</small><span class="ac-status">● READY</span></div>`).join('')}</div></section></div>
    <div class="ac-view" data-ac-view="access" hidden><section class="ac-panel"><span class="ac-kicker">ACCESS CONTROL</span><h2>Administrator & Hak Akses</h2><div class="ac-list">${users.map(u=>row('A',u[0],`${u[1]} • FINORA + DAPIN`)).join('')}</div><div class="ac-note">Hak akses backend tetap ditentukan oleh Supabase Auth dan RLS. Feature Center hanya menjadi pusat monitoring.</div></section></div>
    <div class="ac-view" data-ac-view="security" hidden><div class="ac-section-grid"><section class="ac-panel"><span class="ac-kicker">SECURITY</span><h2>Proteksi Platform</h2><div class="ac-list">${row('R','RLS','Row Level Security pada data sensitif')} ${row('S','Session','Supabase Auth session')} ${row('K','Keys','Credential provider tidak disimpan di UI')} ${row('A','Audit','Siap diperluas ke audit log')}</div></section><section class="ac-panel"><span class="ac-kicker">HEALTH</span><h2>System Check</h2><div class="ac-statline"><span>Local DAPIN data</span><b>Available</b></div><div class="ac-statline"><span>Wallet ledger</span><b>Connected</b></div><div class="ac-statline"><span>Payment</span><b>Sandbox</b></div><div class="ac-statline"><span>Frontend</span><b>Operational</b></div></section></div></div>
    <div class="ac-view" data-ac-view="activity" hidden><section class="ac-panel"><span class="ac-kicker">AUDIT VIEW</span><h2>Aktivitas Terakhir</h2><div class="ac-activity">${tx.length?tx.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,12).map(x=>`<div><span><strong>${String(x.label||'Transaksi')}</strong><small>${new Date(x.created_at).toLocaleString('id-ID')}</small></span><b class="${x.direction==='out'?'money-out':'money-in'}">${x.direction==='out'?'-':'+'}${money(x.amount)}</b></div>`).join(''):'<div class="ac-note">Belum ada aktivitas.</div>'}</div></section></div>
    <div class="ac-view" data-ac-view="system" hidden><div class="ac-section-grid"><section class="ac-panel"><span class="ac-kicker">SYSTEM TOOLS</span><h2>Kontrol Cepat</h2><div class="ac-actions"><button class="ac-action" data-admin-view="dashboard">Buka Dashboard Wallet →</button><button class="ac-action" data-admin-view="dapin">Buka DAPIN →</button><button class="ac-action" data-admin-refresh>Refresh Feature Center</button></div></section><section class="ac-panel"><span class="ac-kicker">NOTES</span><h2>Operasional</h2><div class="ac-note">Gunakan area ini untuk monitoring. Perubahan credential payment, RLS, atau aturan payout dilakukan di backend/provider, bukan dari frontend.</div></section></div></div>
  </div>`
}

document.addEventListener('click',e=>{
  const tab=e.target.closest?.('[data-ac-tab]'); if(tab){e.preventDefault();const name=tab.dataset.acTab;document.querySelectorAll('.ac-tab').forEach(x=>x.classList.toggle('active',x===tab));document.querySelectorAll('[data-ac-view]').forEach(x=>x.hidden=x.dataset.acView!==name);return}
  const b=e.target.closest?.('[data-ac-view]'); if(b){document.querySelector(`.side-item[data-view="${b.dataset.adminView}"]`)?.click();return}
  if(e.target.closest?.('[data-admin-refresh]')){const page=root();if(page){const old=page.querySelector('.finora-admin-page');old?.remove();render()}return}
  const action=e.target.closest?.('[data-admin-view]'); if(action){const v=action.dataset.adminView;document.querySelector(`.side-item[data-view="${v}"]`)?.click()}
})
new MutationObserver(render).observe(document.documentElement,{childList:true,subtree:true})
render()
