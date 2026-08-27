import { supabase } from './main.js'

// Link the logged-in account to DAPIN by exact email and synchronize the
// DAPIN role into the current user's metadata so role-based UI can react
// without trusting editable browser state.
async function linkCurrentUser() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id || !session.user.email) return null

  const { data, error } = await supabase.rpc('dapin_link_current_user_member')
  if (error) {
    if (!/function .*dapin_link_current_user_member.*does not exist/i.test(error.message || '')) {
      console.warn('DAPIN member auto-link failed:', error.message)
    }
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle()

  const role = String(profile?.role || 'member').toLowerCase()
  const currentRole = String(session.user.user_metadata?.role || '').toLowerCase()
  if (role !== currentRole) {
    const { error: updateError } = await supabase.auth.updateUser({
      data: { ...(session.user.user_metadata || {}), role },
    })
    if (updateError) console.warn('DAPIN role metadata sync failed:', updateError.message)
  }

  return data || null
}

if (supabase) {
  void linkCurrentUser()
  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') && session?.user) {
      void linkCurrentUser()
    }
  })
}
