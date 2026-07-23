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
        
      // A user is considered "new" if they don't exist, if they have no tenant, 
      // OR if their account was created in the last 15 seconds (to catch the case where a DB trigger creates them automatically)
      const userCreatedAt = new Date(authData.user.created_at).getTime();
      const isNewUserByTime = Date.now() - userCreatedAt < 15000;
      
      if (!existingUser || !existingUser.tenant_id || isNewUserByTime) {
        // If they are a new user, they MUST have explicitly chosen a plan
        const validPlans = ['basic', 'pro'];
        if (!planParam || !validPlans.includes(planParam)) {
          // If the DB trigger already created a tenant, we MUST delete it to avoid garbage
          if (existingUser && existingUser.tenant_id) {
            await adminClient.from('tenants').delete().eq('id', existingUser.tenant_id);
          }
          
          // Delete from public.users first to avoid Foreign Key constraint errors
          await adminClient.from('users').delete().eq('id', authData.user.id);
          
          // Then clean up the auth user
          await adminClient.auth.admin.deleteUser(authData.user.id);
          
          // Redirect them back to choose a plan
          return NextResponse.redirect(`${origin}/login?error=must_choose_plan`);
        }

        // They chose a valid plan
        const requestedPlan = planParam;
        const finalStatus = 'active'; // Always active during 15-day trial

        if (existingUser && existingUser.tenant_id) {
          // The trigger already created the tenant and user, but probably with default 'trial' plan
          // We need to update the tenant to reflect their actual chosen plan and 15 days
          await adminClient.from('tenants').update({
            subscription_plan: requestedPlan,
            account_status: finalStatus,
            trial_ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          }).eq('id', existingUser.tenant_id);
          
        } else {
          // The trigger did NOT run (or was disabled), so create tenant and user manually
          const { data: newTenant, error: tenantErr } = await adminClient
            .from('tenants')
            .insert({
              name: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || 'شركة جديدة',
              subscription_plan: requestedPlan,
              account_status: finalStatus,
              trial_ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .select()
            .single();
            
          if (newTenant) {
            await adminClient.from('users').upsert({
              id: authData.user.id,
              tenant_id: newTenant.id,
              email: authData.user.email,
              role: 'admin',
            });
          } else {
            await adminClient.auth.admin.deleteUser(authData.user.id);
            return NextResponse.redirect(`${origin}/login?error=server_error`);
          }
        }
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
