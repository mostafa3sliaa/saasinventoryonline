const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUser() {
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) console.error("Auth Users Error:", authErr.message);
  
  console.log("Auth Users Count:", authUsers?.users?.length);
  const latestAuthUser = authUsers?.users?.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
  console.log("Latest Auth User:", latestAuthUser?.email, latestAuthUser?.app_metadata?.provider);

  const { data: publicUsers, error: pubErr } = await supabase.from('users').select('*');
  console.log("Public Users Count:", publicUsers?.length);
  
  const { data: tenants, error: tenErr } = await supabase.from('tenants').select('*');
  console.log("Tenants Count:", tenants?.length);
}

checkUser();
