import { supabase } from './main.js'

const BUCKET = 'dapin-documents'
const objectUrls = new Set()

function esc(value) {
  return String(value ?? '').replace(/[&<>\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]))
}

async function preview(el) {
  const path = el?.dataset?.mdPreview
  if (!path || !supabase || el.dataset.previewLoading === '1') return
  el.dataset.previewLoading = '1'

  try {
    // Blob download is used as the primary preview path for private files.
    // It avoids depending on a browser being able to render a temporary signed URL.
    const { data, error } = await supabase.storage.from(BUCKET).download(path)
    if (error) throw error
    const url = URL.createObjectURL(data)
    objectUrls.add(url)
    el.innerHTML = `<img src="${url}" alt="Preview dokumen" loading="lazy" style="width:100%;height:100%;display:block;object-fit:cover">`
    el.dataset.previewReady = '1'
  } catch (downloadError) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300)
      if (error || !data?.signedUrl) throw error || new Error('Signed URL tidak tersedia')
      el.innerHTML = `<img src="${esc(data.signedUrl)}" alt="Preview dokumen" loading="lazy" style="width:100%;height:100%;display:block;object-fit:cover">`
      el.dataset.previewReady = '1'
    } catch (signedError) {
      el.dataset.previewError = '1'
      el.innerHTML = `<div class="md-doc-icon" title="Preview tidak dapat dimuat">${esc(el.closest('article')?.querySelector('small')?.textContent?.split(' • ')?.[0] || 'FILE')}</div>`
      console.warn('DAPIN document preview failed', { path, downloadError, signedError })
    }
  } finally {
    delete el.dataset.previewLoading
  }
}

function scan(root = document) {
  root.querySelectorAll?.('[data-md-preview]').forEach(preview)
}

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === 1) scan(node)
    }
  }
})

observer.observe(document.documentElement, { childList: true, subtree: true })
scan()

window.addEventListener('beforeunload', () => {
  for (const url of objectUrls) URL.revokeObjectURL(url)
})
