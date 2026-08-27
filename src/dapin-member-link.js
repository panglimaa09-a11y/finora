import { supabase } from './main.js'

// DAPIN account linking: a logged-in user is linked only to an existing
// DAPIN member record with the exact same verified email. This module never
// changes roles and never touches FINORA wallet/core data.
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
