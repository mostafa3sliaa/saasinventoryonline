"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export async function addTeamMember({
  tenantId,
  fullName,
  email,
  password,
  role,
  pages
}: {
  tenantId: string;
  fullName: string;
  email: string;
  password?: string;
  role: string;
  pages: string[];
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مصرح لك");

  // Verify the current user is an admin of the tenant
  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: currentUserRecord } = await adminClient
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

  if (!currentUserRecord || currentUserRecord.tenant_id !== tenantId || currentUserRecord.role !== "admin") {
    throw new Error("يجب أن تكون مديراً لإضافة مستخدمين");
  }

  // 1. Create auth user bypassing email confirmation
  const { data: newAuthUser, error: authErr } = await adminClient.auth.admin.createUser({
    email: email,
    password: password || '123456',
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: role,
      tenant_id: tenantId,
      permissions: { pages }
    }
  });

  if (authErr) {
    if (authErr.message.includes("already registered")) {
      throw new Error("البريد الإلكتروني مستخدم بالفعل في النظام");
    }
    throw new Error(authErr.message);
  }

  if (!newAuthUser.user) throw new Error("فشل إنشاء الحساب");

  // 2. Insert into public.users
  const { error: dbErr } = await adminClient.from("users").insert({
    id: newAuthUser.user.id,
    tenant_id: tenantId,
    email: email,
    full_name: fullName,
    role: role,
    permissions: { pages }
  });

  if (dbErr) {
    // rollback auth user if db fails
    await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
    throw new Error(dbErr.message);
  }

  return true;
}
