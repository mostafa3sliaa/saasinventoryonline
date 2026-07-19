-- ==========================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- ==========================================

-- 1. Create a secure function to get the current user's tenant_id
CREATE OR REPLACE FUNCTION current_tenant_id() 
RETURNS UUID AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can access their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can access co-workers" ON users;
DROP POLICY IF EXISTS "Users can view co-workers" ON users;
DROP POLICY IF EXISTS "Only admins can update users" ON users;
DROP POLICY IF EXISTS "Tenant Isolation" ON suppliers;
DROP POLICY IF EXISTS "Tenant Isolation" ON products;
DROP POLICY IF EXISTS "Tenant Isolation" ON product_variants;
DROP POLICY IF EXISTS "Tenant Isolation" ON purchases;
DROP POLICY IF EXISTS "Tenant Isolation" ON purchase_items;
DROP POLICY IF EXISTS "Tenant Isolation" ON customers;
DROP POLICY IF EXISTS "Tenant Isolation" ON orders;
DROP POLICY IF EXISTS "Tenant Isolation" ON order_items;
DROP POLICY IF EXISTS "Tenant Isolation" ON shipments;
DROP POLICY IF EXISTS "Tenant Isolation" ON transactions;
DROP POLICY IF EXISTS "Tenant Isolation" ON activity_logs;

-- 4. Create Policies for Base Tables (Tables with tenant_id)
-- Tenants
CREATE POLICY "Users can access their own tenant" ON tenants FOR ALL USING (id = current_tenant_id());

-- Users
CREATE POLICY "Users can view co-workers" ON users FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Only admins can update users" ON users FOR UPDATE USING (
  (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1) = 'admin' AND tenant_id = current_tenant_id()
);

-- Other Base Tables
CREATE POLICY "Tenant Isolation" ON suppliers FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "Tenant Isolation" ON products FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "Tenant Isolation" ON purchases FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "Tenant Isolation" ON customers FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "Tenant Isolation" ON orders FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "Tenant Isolation" ON transactions FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "Tenant Isolation" ON activity_logs FOR ALL USING (tenant_id = current_tenant_id());

-- 5. Create Policies for Child Tables (Tables linked to a parent table with tenant_id)
-- Product Variants
CREATE POLICY "Tenant Isolation" ON product_variants FOR ALL USING (
  product_id IN (SELECT id FROM products WHERE tenant_id = current_tenant_id())
);

-- Purchase Items
CREATE POLICY "Tenant Isolation" ON purchase_items FOR ALL USING (
  purchase_id IN (SELECT id FROM purchases WHERE tenant_id = current_tenant_id())
);

-- Order Items
CREATE POLICY "Tenant Isolation" ON order_items FOR ALL USING (
  order_id IN (SELECT id FROM orders WHERE tenant_id = current_tenant_id())
);

-- Shipments
CREATE POLICY "Tenant Isolation" ON shipments FOR ALL USING (
  order_id IN (SELECT id FROM orders WHERE tenant_id = current_tenant_id())
);

-- ==========================================
-- STORAGE POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated viewing" ON storage.objects;

-- Allow authenticated users to upload documents (max 5MB, specific types)
CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'documents' AND 
  (storage.extension(name) = 'pdf' OR storage.extension(name) = 'png' OR storage.extension(name) = 'jpg') AND
  length(coalesce(metadata->>'size', '0')::text)::int < 5242880
);

-- Allow authenticated users to view documents
CREATE POLICY "Allow authenticated viewing" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'documents'
);
