-- Add account_status column to tenants
DO $$
BEGIN
  IF NOT EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='tenants' and column_name='account_status')
  THEN
      ALTER TABLE "public"."tenants" ADD COLUMN "account_status" TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Update existing tenants to active
UPDATE "public"."tenants" SET account_status = 'active' WHERE account_status = 'pending' AND subscription_plan = 'trial';

-- Update the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Create a new tenant for the user
  INSERT INTO public.tenants (name, subscription_plan, account_status)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'full_name', 'مؤسسة جديدة'),
    COALESCE(new.raw_user_meta_data->>'plan_choice', 'trial'),
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'plan_choice', 'trial') = 'trial' THEN 'active'
      ELSE 'pending'
    END
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

-- Super Admin RPC: Get all tenants
CREATE OR REPLACE FUNCTION get_all_tenants()
RETURNS TABLE (
  id UUID,
  name TEXT,
  subscription_plan TEXT,
  account_status TEXT,
  created_at TIMESTAMPTZ,
  admin_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.subscription_plan, t.account_status, t.created_at, u.email
  FROM tenants t
  LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'admin'
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Super Admin RPC: Activate a tenant
CREATE OR REPLACE FUNCTION activate_tenant(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.tenants SET account_status = 'active' WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
