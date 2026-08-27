import { supabase } from './main.js'

const FORM_SELECTOR = 'form[data-ac-form="member"]'

const value = (id) => document.getElementById(id)?.value?.trim() || null

async function handleMemberSubmit(event) {
  const form = event.target?.closest?.(FORM_SELECTOR)
  if (!form) return

  // Intercept the old Admin Center handler so the RPC receives the exact
  // parameter names defined by public.dapin_create_member.
  event.preventDefault()
  event.stopImmediatePropagation()

  if (!supabase) {
    alert('Supabase belum siap.')
    return
  }

  const name = value('acMemberName')
  if (!name) {
    alert('Nama anggota wajib diisi.')
    return
  }

  const submit = form.querySelector('button[type="submit"]')
  if (submit) {
    submit.disabled = true
    submit.textContent = 'Menyimpan…'
  }

  try {
    const { data, error } = await supabase.rpc('dapin_create_member', {
      p_name: name,
      p_email: value('acMemberEmail'),
      p_phone: value('acMemberPhone'),
      p_address: value('acMemberAddress'),
      p_joined_at: new Date().toISOString(),
      p_nik: null,
      p_kk_number: null,
      p_birth_place: null,
      p_birth_date: null,
      p_gender: null,
      p_occupation: null,
      p_marital_status: null,
    })

    if (error) throw error

    const member = Array.isArray(data) ? data[0] : data
    const code = member?.display_id || member?.code || 'anggota baru'

    form.reset()
    alert(`Anggota berhasil ditambahkan: ${code}`)

    // Ask the existing Admin Center to refresh its Supabase-backed list.
    document.querySelector('[data-ac-refresh]')?.click()
  } catch (error) {
    console.error('DAPIN member create error:', error)
    alert(error?.message || 'Gagal menambahkan anggota.')
  } finally {
    if (submit) {
      submit.disabled = false
      submit.textContent = '＋ Tambah Anggota'
    }
  }
}

document.addEventListener('submit', handleMemberSubmit, true)
