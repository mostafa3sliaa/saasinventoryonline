"use server";

import { createClient } from "@supabase/supabase-js";

// We need a service role client to bypass RLS in server actions if needed,
// but we should pass tenant ID to ensure safety.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function updateSupplierInfo(supplierId: string, tenantId: string, name: string, phone: string) {
  try {
    const { error } = await supabase
      .from('suppliers')
      .update({ name, phone })
      .eq('id', supplierId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
