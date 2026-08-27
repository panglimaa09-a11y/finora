import { supabase } from './main.js'

let currentRole = 'member'
let currentMember = null
let started = false

export function getDapinRole() { return currentRole }
export function getDapinMember() { return currentMember }

async function syncRole(user) {
  if (!supabase || !user?.id) return null
  try {
    const { data: profile } = await supabase.from('profiles').select('id,role,full_name,email').eq('id', user.id).maybeSingle()
    currentRole = String(profile?.role || 'member').toLowerCase()
    const { data: member } = await supabase.from('dapin_members').select('*').eq('user_id', user.id).maybeSingle()
    currentMember = member || null
    return { profile, member }
  } catch (e) {
    console.warn('DAPIN role sync failed:', e?.message || e)
    currentRole = 'member'
    currentMember = null
    return null
  }
}

async function boot() {
  if (!supabase || started) return
  started = true
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) await syncRole(session.user)
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      currentRole = 'member'
      currentMember = null
      return
    }
    if (session?.user && ['SIGNED_IN','USER_UPDATED','INITIAL_SESSION','TOKEN_REFRESHED'].includes(event)) {
      await syncRole(session.user)
      window.dispatchEvent(new CustomEvent('dapin:role-updated', { detail: { role: currentRole, member: currentMember } }))
    }
  })
}

void boot()
