import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'
  const planParam = searchParams.get('plan')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )
    
    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && authData?.user) {
      // Check if user exists in public.users (i.e. has a tenant)
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
      
      const { data: existingUser } = await adminClient
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
        
      if (!existingUser) {
        // Determine plan and status
        const requestedPlan = planParam || authData.user.user_metadata?.plan_choice || 'trial';
        const finalStatus = requestedPlan === 'trial' ? 'active' : 'pending';

        // Create a new tenant for the OAuth user
        const { data: newTenant, error: tenantErr } = await adminClient
          .from('tenants')
          .insert({
            name: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || 'شركة جديدة',
            subscription_plan: requestedPlan,
            account_status: finalStatus,
            trial_ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();
          
        if (newTenant) {
          // Create the public user
          await adminClient.from('users').insert({
            id: authData.user.id,
            tenant_id: newTenant.id,
            email: authData.user.email,
            role: 'admin',
          });
        }
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
