import './style.css'

const role = 'admin'
let active = role === 'admin' ? 'admin-dashboard' : 'member-dashboard'

const adminMenu = [
  {section:'ADMIN',items:[['admin-dashboard','Dashboard','⌂'],['members','Anggota','♙'],['deposits','Simpanan','＋'],['loans','Pinjaman','▣'],['installments','Angsuran','◷'],['cash','Kas','◈'],['transactions','Transaksi','↔'],['reports','Laporan','▤']]},
  {section:'SISTEM',items:[['users','User Management','♙'],['security','Security','◉'],['settings','Pengaturan','⚙']]}
]

const memberMenu = [
  {section:'ANGGOTA',items:[['member-dashboard','Dashboard','⌂'],['my-savings','Simpanan Saya','◇'],['my-loans','Pinjaman Saya','▣'],['my-installments','Angsuran Saya','◷'],['my-transactions','Transaksi Saya','↔'],['apply-loan','Ajukan Pinjaman','＋'],['notifications','Notifikasi','●'],['profile','Profil','♙']]}
]

const menu = role === 'admin' ? adminMenu : memberMenu
const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n)
const allItems = () => menu.flatMap(g=>g.items)
const label = id => allItems().find(x=>x[0]===id)?.[1] || 'Dashboard'

function adminDashboard(){return `<div class="page"><div class="hero"><div><div class="eyebrow">FINORA • ADMIN</div><h1>Dashboard Administrator</h1><p>Pusat pengelolaan FINORA dan DAPIN. Data yang tampil di sini adalah data seluruh anggota.</p></div><button class="primary" data-id="members">Kelola Anggota →</button></div><div class="stats"><article class="balance"><span>Saldo Kas</span><strong>${money(28500000)}</strong><small>Saldo operasional saat ini</small></article><article><span>Total Anggota</span><strong>248</strong><small>+12 bulan ini</small></article><article><span>Pinjaman Aktif</span><strong>${money(12000000)}</strong><small>34 pinjaman</small></article><article><span>Angsuran Hari Ini</span><strong>${money(1850000)}</strong><small class="warning">7 menunggu</small></article></div><div class="grid2"><section class="panel"><div class="panel-head"><div><div class="eyebrow">DAPIN</div><h2>Operasional</h2></div></div>${[['Simpanan','Rp28.500.000'],['Pinjaman','Rp12.000.000'],['Kas tersedia','Rp9.850.000']].map(x=>`<div class="admin-row"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</section><section class="panel"><div class="panel-head"><div><div class="eyebrow">AKTIVITAS</div><h2>Perlu perhatian</h2></div></div>${['7 angsuran menunggu pembayaran','3 pengajuan pinjaman baru','2 anggota belum melengkapi data'].map(x=>`<div class="notice">${x}<span>→</span></div>`).join('')}</section></div></div>`}

function memberDashboard(){return `<div class="page"><div class="hero"><div><div class="eyebrow">FINORA • ANGGOTA</div><h1>Dashboard Saya</h1><p>Selamat datang kembali. Di sini kamu hanya dapat melihat dan mengelola data milikmu sendiri.</p></div><button class="primary" data-id="apply-loan">＋ Ajukan Pinjaman</button></div><div class="stats"><article class="balance"><span>Simpanan Saya</span><strong>${money(1250000)}</strong><small>Pokok + wajib + sukarela</small></article><article><span>Pinjaman Berjalan</span><strong>${money(5000000)}</strong><small>Tenor 12 bulan</small></article><article><span>Angsuran Berikutnya</span><strong>${money(450000)}</strong><small>Jatuh tempo 5 Sep</small></article><article><span>Status Anggota</span><strong class="online">Aktif</strong><small>Keanggotaan aktif</small></article></div><div class="grid2"><section class="panel"><div class="panel-head"><div><div class="eyebrow">RINGKASAN SAYA</div><h2>Pinjaman</h2></div></div><div class="loan-card"><span>Sisa pinjaman</span><strong>${money(3500000)}</strong><div class="progress"><i style="width:30%"></i></div><small>30% sudah dibayar</small></div></section><section class="panel"><div class="panel-head"><div><div class="eyebrow">TERBARU</div><h2>Transaksi Saya</h2></div></div>${[['Simpanan Wajib','+Rp100.000'],['Angsuran','-Rp450.000'],['Simpanan Sukarela','+Rp250.000']].map(x=>`<div class="tx"><div class="tx-icon">${x[0][0]}</div><div class="tx-info"><b>${x[0]}</b><small>Transaksi berhasil</small></div><strong>${x[1]}</strong></div>`).join('')}</section></div></div>`}

const modules={
 members:['Anggota','Kelola seluruh data anggota, status keanggotaan, dan profil.','＋ Tambah Anggota'],
 deposits:['Simpanan','Kelola simpanan pokok, wajib, sukarela, dan riwayat seluruh anggota.','＋ Catat Simpanan'],
 loans:['Pinjaman','Kelola pengajuan, persetujuan, pinjaman aktif, dan pelunasan.','＋ Pengajuan Baru'],
 installments:['Angsuran','Pantau jadwal dan pembayaran angsuran seluruh anggota.','＋ Catat Pembayaran'],
 cash:['Kas','Kelola pemasukan, pengeluaran, dan saldo kas DAPIN.','＋ Transaksi Kas'],
 transactions:['Transaksi','Riwayat transaksi keuangan FINORA dan DAPIN.','↗ Transaksi Baru'],
 reports:['Laporan','Laporan simpanan, pinjaman, angsuran, kas, dan aktivitas.','▤ Buat Laporan'],
 users:['User Management','Kelola akun dan role Administrator maupun Anggota.','＋ Tambah User'],
 security:['Security','Pengaturan keamanan dan akses aplikasi.','Kelola Security'],
 settings:['Pengaturan','Pengaturan sistem FINORA dan DAPIN.','Simpan Pengaturan']
}

const memberModules={
 'my-savings':['Simpanan Saya','Lihat saldo dan riwayat simpanan pribadi.',''],
 'my-loans':['Pinjaman Saya','Lihat pinjaman aktif dan riwayat pinjaman pribadi.',''],
 'my-installments':['Angsuran Saya','Lihat jadwal, status, dan riwayat angsuran pribadi.',''],
 'my-transactions':['Transaksi Saya','Lihat seluruh transaksi rekening pribadi.',''],
 'apply-loan':['Ajukan Pinjaman','Ajukan pinjaman baru dan pantau status pengajuan.','＋ Ajukan Pinjaman'],
 notifications:['Notifikasi','Notifikasi pembayaran, angsuran, dan informasi akun.',''],
 profile:['Profil','Kelola informasi profil akun pribadi.','Simpan Profil']
}

function modulePage(){const data=(role==='admin'?modules:memberModules)[active];if(!data)return `<div class="page"><section class="panel placeholder"><div class="big-icon">◇</div><h2>Halaman tidak ditemukan</h2><button class="secondary" data-id="${role==='admin'?'admin-dashboard':'member-dashboard'}">Kembali</button></section></div>`;return `<div class="page"><div class="hero"><div><div class="eyebrow">${role==='admin'?'ADMIN':'ANGGOTA'}</div><h1>${data[0]}</h1><p>${data[1]}</p></div>${data[2]?`<button class="primary" data-action="toast">${data[2]}</button>`:''}</div><section class="panel"><div class="panel-head"><div><div class="eyebrow">MODUL</div><h2>${data[0]}</h2></div><span class="badge">Aktif</span></div><div class="module-grid"><div><span>Total</span><strong>${role==='admin'?'248':'Data Saya'}</strong></div><div><span>Status</span><strong class="online">Online</strong></div><div><span>Akses</span><strong>${role==='admin'?'Administrator':'Anggota'}</strong></div></div><div class="placeholder compact"><div class="big-icon">◇</div><h2>Modul siap digunakan</h2><p>UI sudah aktif dan terpisah berdasarkan role. Integrasi CRUD/database berikutnya dapat dipasang pada modul ini.</p></div></section></div>`}

function content(){if(active==='admin-dashboard')return adminDashboard();if(active==='member-dashboard')return memberDashboard();return modulePage()}
function render(){document.querySelector('#app').innerHTML=`<div class="layout"><aside class="sidebar"><div class="logo"><span class="logo-mark">F</span><div><b>FINORA</b><small>${role==='admin'?'Administrator':'Member Portal'}</small></div></div><div class="profile"><div class="avatar">${role==='admin'?'A':'M'}</div><div><b>${role==='admin'?'Angga':'Anggota'}</b><small>${role==='admin'?'Administrator':'Anggota DAPIN'}</small></div><span class="dot"></span></div><nav>${menu.map(g=>`<div class="nav-group"><div class="section-title">${g.section}</div>${g.items.map(([id,text,icon])=>`<button class="nav-item ${active===id?'active':''}" data-id="${id}"><span class="nav-icon">${icon}</span><span>${text}</span></button>`).join('')}</div>`).join('')}</nav><div class="sidebar-bottom"><div class="status"><span></span> Sistem Online</div></div></aside><main class="main"><header class="topbar"><div><span class="crumb">FINORA</span><span class="slash">/</span><b>${label(active)}</b></div><div class="top-actions"><button class="icon-btn">⌕</button><button class="icon-btn">♧</button><div class="user-mini">${role==='admin'?'A':'M'}</div></div></header>${content()}</main></div>`;document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{active=b.dataset.id;render()});document.querySelectorAll('[data-action="toast"]').forEach(b=>b.onclick=()=>alert('Aksi '+b.textContent.trim()+' siap dihubungkan ke database.'))}
render()
