import { supabase } from './main.js'

let busy = false

function documentType(file) {
  const n = String(file?.name || '').toLowerCase()
  if (n.includes('ktp')) return 'ktp'
  if (n.includes('kk')) return 'kk'
  if (/^image\//i.test(file?.type || '')) return 'photo'
  return 'other'
}

function getMemberId() {
  const small = document.querySelector('.md-overlay header small')
  const displayId = small?.textContent?.trim()
  if (!displayId || !supabase) return null
  return supabase.from('dapin_members').select('id').eq('display_id', displayId).maybeSingle()
}

async function uploadDocuments(files) {
  if (busy || !supabase || !files?.length) return
  busy = true
  try {
    const memberResult = await getMemberId()
    if (memberResult.error) throw memberResult.error
    const memberId = memberResult.data?.id
    if (!memberId) throw new Error('Anggota tidak ditemukan.')

    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) {
        throw new Error(`${file.name}: ukuran maksimal 15 MB.`)
      }

      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `${memberId}/${crypto.randomUUID()}.${ext}`

      const { error: storageError } = await supabase.storage
        .from('dapin-documents')
        .upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })

      if (storageError) throw storageError

      try {
        const { error: rpcError } = await supabase.rpc('dapin_add_member_document', {
          p_member_id: memberId,
          p_document_type: documentType(file),
          p_file_name: file.name,
          p_storage_path: path,
          p_mime_type: file.type || null,
          p_file_size: file.size,
          p_note: null,
        })

        if (rpcError) throw rpcError
      } catch (error) {
        await supabase.storage.from('dapin-documents').remove([path])
        throw error
      }
    }

    window.location.reload()
  } catch (error) {
    window.alert(error?.message || 'Gagal mengunggah dokumen.')
  } finally {
    busy = false
  }
}

document.addEventListener('change', event => {
  const input = event.target.closest?.('[data-md-upload]')
  if (!input?.files?.length) return
  event.preventDefault()
  event.stopImmediatePropagation()
  const files = [...input.files]
  input.value = ''
  void uploadDocuments(files)
}, true)
