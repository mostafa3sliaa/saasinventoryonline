"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export async function getAllTenants() {
  const cookieStore = await cookies();
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (user.email !== 'bobos@admin.com' && user.email !== 'momo@inventorysaas.com')) {
    throw new Error("Unauthorized");
  }

  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tenants, error: tenantsErr } = await adminClient.from("tenants").select("*").order("created_at", { ascending: false });
  if (tenantsErr) throw new Error(tenantsErr.message);

  const { data: users, error: usersErr } = await adminClient.from("users").select("*").eq("role", "admin");
  if (usersErr) throw new Error(usersErr.message);

  return tenants.map(t => {
    const adminUser = users.find(u => u.tenant_id === t.id);
    return {
      ...t,
      admin_email: adminUser?.email || "غير معروف"
    };
  });
}

export async function activateTenant(tenantId: string) {
  const cookieStore = await cookies();
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (user.email !== 'bobos@admin.com' && user.email !== 'momo@inventorysaas.com')) {
    throw new Error("Unauthorized");
  }

  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient.from("tenants").update({ account_status: "active" }).eq("id", tenantId);
  if (error) throw new Error(error.message);
  
  return true;
}
