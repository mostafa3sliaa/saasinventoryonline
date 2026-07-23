"use server";

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function downgradePlanWithKeptUsers(keptUserIds: string[]) {
  try {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) throw new Error("غير مصرح لك بالدخول");

    // We must use the admin client to delete auth.users
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {}
        }
      }
    );

    // Get tenant ID for current user
    const { data: currentUserData } = await adminClient
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!currentUserData || currentUserData.role !== 'admin') {
      throw new Error("صلاحيات غير كافية. يجب أن تكون مديراً.");
    }

    const tenantId = currentUserData.tenant_id;

    // Get all users for this tenant
    const { data: allUsers } = await adminClient
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId);

    if (!allUsers) throw new Error("حدث خطأ في جلب الموظفين");

    const usersToDelete = allUsers.filter(u => !keptUserIds.includes(u.id));

    // Delete them from Auth (this cascades to public.users)
    for (const u of usersToDelete) {
      if (u.id === user.id) continue; // Safety: Never delete the admin doing the action
      await adminClient.auth.admin.deleteUser(u.id);
    }

    // Downgrade tenant to basic
    await adminClient
      .from('tenants')
      .update({ subscription_plan: 'basic' })
      .eq('id', tenantId);

    return { success: true };
  } catch (error: any) {
    console.error("Downgrade error:", error);
    return { success: false, message: error.message || "حدث خطأ غير متوقع" };
  }
}
