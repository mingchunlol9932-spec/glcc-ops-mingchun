// Create (or promote) your ADMIN account.
//
//   node --env-file=.env scripts/create-admin.mjs you@example.com
//
// It uses your SERVICE_ROLE key (already in .env) to create the auth user and
// an admin profile row (role 'admin', every tab). It sets only a throwaway
// password — YOU set your real password in the Supabase dashboard:
//   Authentication → Users → <your account> → ⋯ → Reset password / Set password.

import { createClient } from '@supabase/supabase-js'

const url = (process.env.SUPABASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v\d+$/i, '')
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? '').trim()

if (!url || !key) {
  console.error('✖ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
if (!email) {
  console.error('✖ Usage: node --env-file=.env scripts/create-admin.mjs you@example.com')
  process.exit(1)
}

const ALL_TABS = ['dashboard', 'pipeline', 'money', 'tasks', 'projects', 'contacts', 'content', 'hr', 'timetable', 'agents']
const supabase = createClient(url, key, { auth: { persistSession: false } })

// Random throwaway password — never used; you overwrite it in the dashboard.
const tempPassword = 'Tmp-' + crypto.randomUUID()

let userId
const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email,
  password: tempPassword,
  email_confirm: true,
})

if (createErr) {
  if (/already|registered|exists/i.test(createErr.message)) {
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers()
    if (listErr) {
      console.error('✖ Could not look up existing user:', listErr.message)
      process.exit(1)
    }
    const found = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!found) {
      console.error('✖ User reportedly exists but was not found:', createErr.message)
      process.exit(1)
    }
    userId = found.id
    console.log('• User already existed — promoting them to admin.')
  } else {
    console.error('✖ Could not create user:', createErr.message)
    process.exit(1)
  }
} else {
  userId = created.user.id
  console.log('• Created auth user:', email)
}

const { error: upsertErr } = await supabase
  .from('profiles')
  .upsert({ id: userId, email, role: 'admin', allowed_tabs: ALL_TABS }, { onConflict: 'id' })

if (upsertErr) {
  console.error('✖ Could not write profile (did you run supabase/auth.sql?):', upsertErr.message)
  process.exit(1)
}

console.log('\n✅ Admin profile ready for', email)
console.log('   Now set YOUR password in the Supabase dashboard:')
console.log('   Authentication → Users → ' + email + ' → ⋯ → Reset/Set password')
console.log('   Then sign in at /login.')
