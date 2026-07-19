-- Add the new columns to the tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 days';

-- Update all existing tenants to 'active' so they are not blocked immediately,
-- Or keep them as trial if you want to test the trial feature on them.
-- For safety, we will set them to 'active'. If you want them to be on trial, change 'active' to 'trial'.
UPDATE tenants SET subscription_status = 'active';
