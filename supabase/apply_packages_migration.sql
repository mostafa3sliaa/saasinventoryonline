-- Rename the column from subscription_status to subscription_plan if it exists
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='tenants' and column_name='subscription_status')
  THEN
      ALTER TABLE "public"."tenants" RENAME COLUMN "subscription_status" TO "subscription_plan";
  ELSE
      ALTER TABLE "public"."tenants" ADD COLUMN IF NOT EXISTS "subscription_plan" TEXT DEFAULT 'trial';
  END IF;
END $$;

-- If you want to reset all 'active' plans back to 'trial' to test the billing page locking:
-- UPDATE tenants SET subscription_plan = 'trial', trial_ends_at = NOW() - INTERVAL '1 day';
