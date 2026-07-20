import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  let authUser = null;
  let authError = null;
  
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        }
      }
    );
    const result = await supabase.auth.getUser();
    authUser = result.data.user;
    authError = result.error;
  } catch (e: any) {
    authError = e.message;
  }

  let dbUser = null;
  let dbError = null;
  let dbTenant = null;

  if (authUser) {
    try {
      const adminClient = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
      );
      const { data, error } = await adminClient.from("users").select("*").eq("id", authUser.id).single();
      dbUser = data;
      dbError = error;
      
      if (data?.tenant_id) {
         const { data: t } = await adminClient.from("tenants").select("*").eq("id", data.tenant_id).single();
         dbTenant = t;
      }
    } catch (e: any) {
      dbError = e.message;
    }
  }
  
  return Response.json({
    env: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    cookies: allCookies.map(c => c.name),
    auth: {
      user: authUser ? authUser.id : null,
      error: authError,
    },
    db: {
      user: dbUser,
      error: dbError,
      tenant: dbTenant
    }
  });
}
