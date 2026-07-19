"use server"

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export async function getMyTenantData() {
  const cookieStore = await cookies();
  
  // Create a regular client just to verify the session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {}
      }
    }
  );
  
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { user: null, tenant: null };

  // Create an admin client to fetch user and tenant safely bypassing any RLS issues
  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await adminClient.from("users").select("*").eq("id", authUser.id).single();
  let tenant = null;
  
  if (user?.tenant_id) {
    const { data: t } = await adminClient.from("tenants").select("*").eq("id", user.tenant_id).single();
    tenant = t;
  }
  
  return { user, tenant };
}
