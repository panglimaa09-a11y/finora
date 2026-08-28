import { supabase } from './main.js'

// DAPIN account linking: a logged-in user is linked only to an existing
// DAPIN member record with the exact same verified email. The link is done
// server-side through a SECURITY DEFINER RPC. No member data is stored in
// browser storage.
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

  // Keep the UI role synchronized with the authoritative profiles table.
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
  // INITIAL_SESSION is intentionally not reloaded: after a refresh the link
  // already exists and reloading again would create a loop.
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session?.user) return
    if (event === 'SIGNED_IN') {
      const member = await linkCurrentUser()
      // Reload AT MOST ONCE per sign-in so member RLS sees the new user_id.
      // The previous unguarded reload raced with the reload in
      // dapin-admin-access-fix.js on the Google OAuth callback page, firing
      // full page reloads before Supabase finished persisting the session —
      // which bounced users straight back to the login screen (and looped
      // forever for admin accounts). sessionStorage survives the reload
      // within the same tab but resets on a fresh tab, keeping the
      // one-time RLS refresh intact. No member data is stored locally.
      if (member && !sessionStorage.getItem('finora_member_link_done')) {
        sessionStorage.setItem('finora_member_link_done', '1')
        window.location.reload()
      }
      return
    }
    if (event === 'USER_UPDATED') void linkCurrentUser()
  })

  // Covers an already-authenticated browser session after deployment.
  void linkCurrentUser()
}
