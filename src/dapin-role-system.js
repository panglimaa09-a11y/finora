import { supabase } from './main.js'
import { initDapin, renderDapin, setDapinView, getDapinState } from './dapin.js'

const CONFIG = {
  member: { label:'Member', views:['dashboard','simpanan','pinjaman','angsuran','transaksi','profil'] },
  hr: { label:'HR', views:['dashboard','anggota'] },
  admin: { label:'Admin', views:['dashboard','anggota','simpanan','pinjaman','angsuran','transaksi','laporan'] },
  finance: { label:'Finance', views:['dashboard','simpanan','pinjaman','angsuran','transaksi','laporan'] },
  super_admin: { label:'Super Admin', views:['dashboard','anggota','simpanan','pinjaman','angsuran','transaksi','laporan'] },
}

let role='member'
let syncing=false
let lastSidebarSig=''

async function readRole(user){
  if(!supabase||!user?.id)return 'member'
  const {data,error}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
  if(error){console.warn('DAPIN role:',error.message);return 'member'}
  return CONFIG[data?.role]?data.role:'member'
}

async function bootstrap(user){
  if(syncing||!user?.id||!supabase)return
  syncing=true
  try{
    role=await readRole(user)
    const cfg=CONFIG[role]
    // DAPIN's legacy renderer has an admin/member binary UI.
    // Elevated roles use the admin renderer, while this module filters the visible modules.
    if(role!=='member'){
      const metaRole=String(user.user_metadata?.role||'').toLowerCase()
      if(metaRole!=='admin'){
        await supabase.auth.updateUser({data:{...(user.user_metadata||{}),role:'admin',dapin_role:role,dapin_role_label:cfg.label}})
      }
      await initDapin({...user,user_metadata:{...(user.user_metadata||{}),role:'admin',dapin_role:role}})
    }else{
      await initDapin(user)
    }
    applyShell()
  }finally{syncing=false}
}

function applyShell(){
  const cfg=CONFIG[role]||CONFIG.member
  const items=[['anggota','♙','Anggota'],['simpanan','◈','Simpanan'],['pinjaman','▣','Pinjaman'],['angsuran','◷','Angsuran'],['transaksi','↔','Transaksi'],['laporan','▥','Laporan'],['profil','♙','Profil']]
  const section=document.querySelector('.dapin-sidebar-section')
  if(section){
    const sig=role+'|'+stateText(section)
    if(sig!==lastSidebarSig){
      lastSidebarSig=sig
      section.querySelectorAll('[data-dapin-role-generated]').forEach(x=>x.remove())
      const root=section.querySelector('.dapin-root')
      const wrap=document.createElement('div')
      wrap.dataset.dapinRoleGenerated='1'
      wrap.innerHTML=items.filter(([id])=>cfg.views.includes(id)).map(([id,icon,label])=>`<button class="side-item dapin-nav-item" type="button" data-dapin-nav="${id}"><span>${icon}</span><b>${id==='dashboard'?'Dashboard':label}</b></button>`).join('')
      section.appendChild(wrap)
      section.querySelectorAll('.side-item').forEach(btn=>{
        const id=btn.dataset.dapinNav
        if(id&&!cfg.views.includes(id))btn.remove()
      })
    }
  }
  const badge=document.querySelector('.session-user small')
  if(badge)badge.textContent=cfg.label
  filterDapinModules(cfg)
}

function stateText(el){return el.textContent||''}

function filterDapinModules(cfg){
  const root=document.querySelector('.page .dapin-app')
  if(!root)return
  root.querySelectorAll('[data-dapin-view]').forEach(el=>{
    const view=el.dataset.dapinView
    if(view && !cfg.views.includes(view)) el.style.display='none'
  })
  root.querySelectorAll('.dapin-action-card').forEach(el=>{
    const view=el.dataset.dapinView
    if(view && !cfg.views.includes(view)) el.style.display='none'
  })
  root.querySelectorAll('[data-employment-edit]').forEach(btn=>{
    if(role!=='super_admin'){
      btn.disabled=true
      btn.title='Hanya Super Admin yang dapat mengubah data kepegawaian.'
      btn.textContent='🔒 Super Admin'
    }
  })
}

function allowView(view){return (CONFIG[role]||CONFIG.member).views.includes(view)}

async function openRoleView(view){
  if(!allowView(view)){window.alert('Akses modul ini tidak tersedia untuk role Anda.');return}
  if(role==='member')return
  await initDapin({ ...(await supabase.auth.getUser()).data.user, user_metadata:{role:'admin',dapin_role:role} })
  setDapinView(view)
  const page=document.querySelector('.page')
  if(!page)return
  const raw=renderDapin()
  const wrapper=document.createElement('div')
  wrapper.innerHTML=raw
  page.innerHTML=wrapper.firstElementChild?.outerHTML||raw
  filterDapinModules(CONFIG[role])
  applyShell()
}

document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-dapin-nav]')
  if(!btn||role==='member')return
  const view=btn.dataset.dapinNav
  e.preventDefault();e.stopImmediatePropagation()
  void openRoleView(view)
},true)

if(supabase){
  const boot=async()=>{const {data:{session}}=await supabase.auth.getSession();if(session?.user)await bootstrap(session.user)}
  void boot()
  supabase.auth.onAuthStateChange((event,session)=>{
    if(session?.user && ['SIGNED_IN','INITIAL_SESSION','TOKEN_REFRESHED','USER_UPDATED'].includes(event))void bootstrap(session.user)
    else if(!session)role='member'
  })

  const observer=new MutationObserver(()=>{if(document.querySelector('.dapin-sidebar-section'))applyShell()})
  observer.observe(document.body,{childList:true,subtree:true})
}
