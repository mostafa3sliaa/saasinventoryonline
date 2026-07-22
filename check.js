const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^['"](.*)['"]$/, '$1').trim();
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);
async function check() {
  const { data: users, error: err1 } = await supabase.from('users').select('*').order('created_at', { ascending: false }).limit(2);
  console.log('Recent users:', users, err1);
  const { data: tenants, error: err2 } = await supabase.from('tenants').select('*').order('created_at', { ascending: false }).limit(2);
  console.log('Recent tenants:', tenants, err2);
  const { data: authUsers, error: err3 } = await supabase.auth.admin.listUsers();
  console.log('Recent auth users:', authUsers.users.slice(0, 2).map(u => ({ id: u.id, email: u.email })));
}
check();
