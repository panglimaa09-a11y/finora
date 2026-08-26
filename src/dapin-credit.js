const KEY='finora_dapin_v2'
const CREDIT_KEY='finora_dapin_credit_v1'
const rupiah=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
const write=d=>localStorage.setItem(KEY,JSON.stringify(d))
const credits=()=>{try{return JSON.parse(localStorage.getItem(CREDIT_KEY)||'{}')}catch{return {}}}
const saveCredits=d=>localStorage.setItem(CREDIT_KEY,JSON.stringify(d))
const admin=()=>document.querySelector('.session-user small')?.textContent?.trim()==='Administrator'
const currentView=()=>read().view||'dashboard'
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))

function members(){return read().members||[]}
function profileFor(m){const c=credits()[m?.id]||{};return {limit:Number(c.limit||3000000),maxTenor:Number(c.maxTenor||12),score:Number(c.score||0),risk:c.risk||'Belum dinilai',note:c.note||'',updated_at:c.updated_at||null}}

function injectAdmin(){
  if(!admin() || currentView()!=='pinjaman') return
  if(document.querySelector('[data-credit-admin]')) return
  const target=document.querySelector('.dapin-admin-panel .dapin-main')
  if(!target) return

  const section=document.createElement('section')
  section.className='dapin-panel credit-admin-panel'
  section.dataset.creditAdmin='1'
  section.innerHTML=`
    <div class="dapin-panel-head">
      <div>
        <span>DAPIN • CREDIT CONTROL</span>
        <h2>Limit & Kreditabilitas Anggota</h2>
        <p>Admin menentukan plafon dan tenor maksimum berdasarkan hasil penilaian anggota.</p>
      </div>
      <span class="credit-badge">ADMIN CONTROL</span>
    </div>
    <div class="credit-grid">
      ${members().map(m=>{
        const c=profileFor(m)
        return `<article class="credit-card" data-member-credit="${esc(m.id)}">
          <div class="credit-card-head">
            <div><strong>${esc(m.name||m.email||'Anggota')}</strong><small>${esc(m.code||m.email||'-')}</small></div>
            <span class="risk ${c.risk.toLowerCase().replace(/\s/g,'-')}">${esc(c.risk)}</span>
          </div>
          <div class="credit-stats">
            <div><span>Limit aktif</span><b>${rupiah(c.limit)}</b></div>
            <div><span>Tenor maksimum</span><b>${c.maxTenor} bulan</b></div>
            <div><span>Skor kredit</span><b>${c.score||'—'}</b></div>
          </div>
          <button class="dapin-secondary credit-edit" data-credit-edit="${esc(m.id)}">Atur Limit & Tenor</button>
        </article>`
      }).join('') || '<div class="table-empty">Belum ada anggota. Tambahkan anggota terlebih dahulu.</div>'}
    </div>`

  const head=target.querySelector('.dapin-page-head')
  const loanPanel=Array.from(target.querySelectorAll('.dapin-panel')).find(p=>/Daftar Pinjaman/i.test(p.textContent||''))
  if(loanPanel) loanPanel.before(section)
  else if(head) head.after(section)
  else target.prepend(section)
}

function modal(m){
  const c=profileFor(m)
  const wrap=document.createElement('div')
  wrap.className='dapin-modal-wrap'
  wrap.innerHTML=`<div class="dapin-modal credit-modal">
    <button class="dapin-close" data-credit-close>×</button>
    <div class="eyebrow">CREDIT CONTROL</div>
    <h2>${esc(m.name||m.email||'Anggota')}</h2>
    <p>Atur plafon dan tenor sesuai hasil penilaian kredit internal.</p>
    <form id="credit-form">
      <div class="dapin-form-grid">
        <label>Limit pinjaman<input name="limit" type="number" min="0" step="100000" value="${c.limit}" required><small>Maksimum dana yang dapat diajukan anggota.</small></label>
        <label>Tenor maksimum<select name="maxTenor">${[3,6,9,12,18,24].map(x=>`<option value="${x}" ${c.maxTenor===x?'selected':''}>${x} bulan</option>`).join('')}</select></label>
        <label>Skor kredit<input name="score" type="number" min="0" max="100" value="${c.score||''}" placeholder="0–100"><small>Gunakan hasil penilaian internal; bukan keputusan otomatis.</small></label>
        <label>Kategori risiko<select name="risk"><option ${c.risk==='Belum dinilai'?'selected':''}>Belum dinilai</option><option ${c.risk==='Rendah'?'selected':''}>Rendah</option><option ${c.risk==='Sedang'?'selected':''}>Sedang</option><option ${c.risk==='Tinggi'?'selected':''}>Tinggi</option></select></label>
        <label class="full">Catatan penilaian<textarea name="note" placeholder="Alasan penetapan limit/tenor...">${esc(c.note)}</textarea></label>
      </div>
      <div class="dapin-form-actions"><button type="button" class="dapin-secondary" data-credit-close>Batal</button><button class="dapin-primary">Simpan Pengaturan Kredit</button></div>
    </form>
  </div>`
  document.body.appendChild(wrap)
  wrap.querySelectorAll('[data-credit-close]').forEach(b=>b.onclick=()=>wrap.remove())
  wrap.querySelector('#credit-form').onsubmit=e=>{
    e.preventDefault()
    const f=new FormData(e.target)
    const d=credits()
    d[m.id]={limit:Number(f.get('limit')||0),maxTenor:Number(f.get('maxTenor')||12),score:Number(f.get('score')||0),risk:String(f.get('risk')||'Belum dinilai'),note:String(f.get('note')||''),updated_at:new Date().toISOString()}
    saveCredits(d)
    wrap.remove()
    const old=document.querySelector('[data-credit-admin]')
    old?.remove()
    injectAdmin()
    alert('Pengaturan kredit anggota berhasil disimpan.')
  }
}

function memberSummary(){
  if(admin() || currentView()==='dashboard') return
  const d=read(),m=(d.members||[]).find(x=>x.email===document.querySelector('.session-user strong')?.textContent?.trim())
  if(!m || document.querySelector('[data-credit-member]')) return
  const c=profileFor(m)
  const page=document.querySelector('.dapin-member-panel .dapin-main')
  if(!page) return
  const box=document.createElement('section')
  box.className='dapin-panel member-credit-summary'
  box.dataset.creditMember='1'
  box.innerHTML=`<div class="dapin-panel-head"><div><span>KREDIT ANDA</span><h2>Plafon Pinjaman</h2><p>Limit dan tenor yang diberikan pengurus DAPIN.</p></div><span class="credit-badge">${esc(c.risk)}</span></div><div class="credit-member-grid"><div><span>Limit tersedia</span><strong>${rupiah(c.limit)}</strong></div><div><span>Tenor maksimum</span><strong>${c.maxTenor} bulan</strong></div></div>`
  const head=page.querySelector('.dapin-page-head')
  if(head) head.after(box)
}

const observer=new MutationObserver(()=>{
  const oldAdmin=document.querySelector('[data-credit-admin]')
  if(currentView()!=='pinjaman' && oldAdmin) oldAdmin.remove()
  injectAdmin()
  memberSummary()
})
observer.observe(document.documentElement,{childList:true,subtree:true})
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-credit-edit]')
  if(!b) return
  if(currentView()!=='pinjaman') return
  const m=members().find(x=>String(x.id)===String(b.dataset.creditEdit))
  if(m) modal(m)
})
