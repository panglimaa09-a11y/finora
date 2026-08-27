import { supabase } from './main.js'

// Automatically links a logged-in Supabase user to an existing DAPIN member
// record with the same email. No client-side database credentials are used.
async function linkCurrentUser() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id || !session.user.email) return null

  const { data, error } = await supabase.rpc('dapin_link_current_user_member')
  if (error) {
    // A missing migration should not break login; surface only real link errors.
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
