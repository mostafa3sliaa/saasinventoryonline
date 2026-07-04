const { Client } = require('pg');

const connectionString = 'postgresql://postgres:qKKPskt5XHOQzSKu@db.xfvmetvwyzvccumftekp.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected successfully');

    // 1. Add primary_color to tenants
    try {
      await client.query(`ALTER TABLE tenants ADD COLUMN primary_color TEXT DEFAULT '#000000';`);
      console.log('Added primary_color column');
    } catch (e) {
      console.log('Column primary_color might already exist or error:', e.message);
    }

    // 2. Add bucket
    try {
      await client.query(`
        INSERT INTO storage.buckets (id, name, public) 
        VALUES ('branding', 'branding', true)
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('Added branding bucket');
    } catch (e) {
      console.log('Error adding bucket:', e.message);
    }

    // 3. Add bucket policies
    try {
      await client.query(`
        CREATE POLICY "Public Access" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'branding');
      `);
      console.log('Added public access policy');
    } catch (e) {
      console.log('Policy might already exist:', e.message);
    }

    try {
      await client.query(`
        CREATE POLICY "Auth Upload" 
        ON storage.objects FOR INSERT 
        WITH CHECK (bucket_id = 'branding' AND auth.role() = 'authenticated');
      `);
      console.log('Added auth upload policy');
    } catch (e) {
      console.log('Policy might already exist:', e.message);
    }

  } catch (err) {
    console.error('Connection error', err.stack);
  } finally {
    await client.end();
  }
}

run();
