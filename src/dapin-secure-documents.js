import './dapin-secure-documents.css'
import { supabase } from './main.js'

const MAX_SIZE=15*1024*1024
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))

function memberDisplayId(){return document.querySelector('.md-modal header small')?.textContent?.trim()||''}
async function getMember(){
 const displayId=memberDisplayId(); if(!displayId) throw new Error('ID anggota tidak ditemukan.')
 const {data,error}=await supabase.from('dapin_members').select('id,display_id,name').eq('display_id',displayId).maybeSingle()
 if(error) throw error; if(!data) throw new Error('Data anggota tidak ditemukan.')
 return data
}
function typeLabel(t){return t==='ktp'?'KTP':t==='kk'?'KK':t==='photo'?'FOTO':'DOKUMEN'}
function controls(){
 const card=document.querySelector('.md-modal .md-card')
 if(!card) return
 const head=[...card.querySelectorAll('.md-card-head')].find(x=>x.textContent.includes('Dokumen Anggota'))
 if(!head||head.querySelector('[data-secure-doc-controls]')) return
 const box=document.createElement('div');box.dataset.secureDocControls='1';box.className='sdoc-controls';box.innerHTML='<select data-secure-doc-type aria-label="Jenis dokumen"><option value="ktp">KTP</option><option value="kk">KK</option><option value="photo">Foto</option><option value="other">Dokumen Lain</option></select><label class="md-upload sdoc-upload">＋ Tambah Dokumen<input type="file" data-secure-doc-upload hidden multiple accept="image/jpeg,image/png,image/webp,application/pdf"></label>'
 const old=head.querySelector('.md-upload'); if(old) old.replaceWith(box); else head.appendChild(box)
}
async function signed(path){const {data,error}=await supabase.storage.from('dapin-documents').createSignedUrl(path,300);if(error)throw error;return data.signedUrl}
async function refresh(member){
 const {data,error}=await supabase.from('dapin_member_documents').select('*').eq('member_id',member.id).order('created_at',{ascending:false});if(error)throw error
 const grid=document.querySelector('.md-modal .md-doc-grid');if(!grid)return
 if(!data?.length){grid.innerHTML='<div class="md-empty">Belum ada KTP, KK, foto, atau dokumen pendukung.</div>';return}
 grid.innerHTML=data.map(d=>{const image=/^image\//i.test(d.mime_type||'');return `<article><button class="sdoc-preview" data-sdoc-view="${esc(d.storage_path)}" title="Lihat dokumen">${image?`<span class="sdoc-thumb"><img alt="${esc(d.file_name)}" data-sdoc-image="${esc(d.storage_path)}"></span>`:`<span class="sdoc-thumb sdoc-file">${(d.mime_type||'').includes('pdf')?'PDF':'FILE'}</span>`}</button><div><strong>${esc(d.file_name)}</strong><small>${typeLabel(d.document_type)} • ${new Date(d.created_at).toLocaleDateString('id-ID')}</small></div><button data-sdoc-view="${esc(d.storage_path)}">Lihat</button></article>`}).join('')
 for(const img of grid.querySelectorAll('[data-sdoc-image]')){try{img.src=await signed(img.dataset.sdocImage)}catch{}}
 controls()
}
async function upload(files,input){
 if(!files?.length)return
 const member=await getMember();const type=document.querySelector('[data-secure-doc-type]')?.value||'other';const paths=[]
 for(const file of [...files]){
  if(file.size>MAX_SIZE)throw new Error(`${file.name}: ukuran melebihi 15 MB.`)
  if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw new Error(`${file.name}: format harus JPG, PNG, WEBP, atau PDF.`)
  const ext=(file.name.split('.').pop()||'bin').toLowerCase();const path=`${member.id}/${crypto.randomUUID()}.${ext}`
  const up=await supabase.storage.from('dapin-documents').upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error
  const ins=await supabase.from('dapin_member_documents').insert({member_id:member.id,document_type:type,file_name:file.name,storage_path:path,mime_type:file.type,file_size:file.size})
  if(ins.error){await supabase.storage.from('dapin-documents').remove([path]);throw ins.error}
  paths.push(path)
 }
 await refresh(member);if(input)input.value='';alert(`${paths.length} dokumen berhasil ditambahkan.`)
}

document.addEventListener('change',async e=>{
 const input=e.target.closest('[data-md-upload]');if(!input)return
 e.stopImmediatePropagation()
 try{await upload(input.files,input)}catch(err){alert(err?.message||'Gagal menambahkan dokumen.');input.value=''}
},true)

document.addEventListener('click',async e=>{
 const view=e.target.closest('[data-sdoc-view]');if(!view)return
 e.preventDefault();e.stopImmediatePropagation()
 try{const url=await signed(view.dataset.sdocView);window.open(url,'_blank','noopener,noreferrer')}catch(err){alert(err?.message||'Gagal membuka dokumen.')}
},true)

const observer=new MutationObserver(()=>{if(document.querySelector('.md-modal'))controls()})
observer.observe(document.body,{childList:true,subtree:true})
