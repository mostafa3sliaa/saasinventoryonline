-- Update the trigger function to handle plan_choice from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Create a new tenant for the user with the selected plan
  INSERT INTO public.tenants (name, subscription_plan)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'full_name', 'مؤسسة جديدة'),
    COALESCE(new.raw_user_meta_data->>'plan_choice', 'trial')
  )
  RETURNING id INTO new_tenant_id;

  -- Create the user profile
  INSERT INTO public.users (id, tenant_id, role, email, full_name)
  VALUES (
    new.id,
    new_tenant_id,
    'admin',
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'المدير')
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
