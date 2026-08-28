import { supabase } from './main.js'

let syncing = null
const ADMIN_META_ROLE = 'admin'
const ROLE_LABELS = { member: 'Member', hr: 'HR', admin: 'Admin', finance: 'Finance', super_admin: 'Super Admin' }

// Single, serialized source for writing the DAPIN role into the auth session
// metadata. Three modules (dapin-role-system.js, dapin-admin-access-fix.js,
// dapin-member-link.js) previously each called supabase.auth.updateUser()
// directly on auth events and wrote CONFLICTING metadata schemes
// (one stored the real role in metadata.role, the other forced 'admin'),
// so every USER_UPDATED event re-triggered the other modules' updateUser and
// the page fell into an infinite updateUser/token-rotation ping-pong right
// after Google login — pegging the main thread (white screen / hang) and
// hammering the Supabase API.
//
// Now all modules call THIS instead:
//  - one in-flight guard: concurrent calls share a single promise, so no two
//    updateUser() calls can rotate the session tokens at the same time;
//  - one consistent scheme: metadata.role always mirrors the authoritative
//    profiles.role (elevated roles also get dapin_role + dapin_role_label,
//    which the DAPIN renderer reads after they have been copied in).
export function syncRoleMetadata(user) {
  if (!supabase || !user?.id) return Promise.resolve(null)
  if (syncing) return syncing
  syncing = (async () => {
    try {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const role = String(profile?.role || 'member').toLowerCase()
      const metadataRole = String(user.user_metadata?.role || '').toLowerCase()
      if (metadataRole !== role) {
        const data = { ...(user.user_metadata || {}), role }
        if (role !== 'member') {
          data.role = role    // authoritative role, not a forced 'admin'
          data.dapin_role = role
          data.dapin_role_label = ROLE_LABELS[role] || role
        }
        const { error } = await supabase.auth.updateUser({ data })
        if (error) console.warn('DAPIN role metadata sync failed:', error.message)
      }
      return role
    } catch (error) {
      console.warn('DAPIN role metadata sync error:', error?.message || error)
      return null
    } finally {
      syncing = null
    }
  })()
  return syncing
}
