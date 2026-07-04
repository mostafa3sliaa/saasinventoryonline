import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://xfvmetvwyzvccumftekp.supabase.co', 'sb_publishable_diyaPjDmMXu64kmY5YgH7g_Gm6taVpg');

async function checkDb() {
  console.log("Checking orders...");
  const { data: orders, error: ordersErr } = await supabase.from('orders').select('id, status, source, created_at, order_items(id, product_variant_id, quantity)').order('created_at', { ascending: false }).limit(5);
  if (ordersErr) console.error(ordersErr);
  console.log("Recent Orders:");
  console.dir(orders, { depth: null });

  console.log("\nChecking product variants...");
  const { data: variants, error: varErr } = await supabase.from('product_variants').select('id, size, color, stock_quantity, products(name)');
  if (varErr) console.error(varErr);
  
  const targetVariant = variants.find(v => v.products?.name?.includes('ليب جلاس') && v.color?.includes('احمر'));
  if (targetVariant) {
    console.log("Found target variant:", targetVariant);
    
    // Check order_items for this variant
    const { data: items } = await supabase.from('order_items').select('*, orders(status, source)').eq('product_variant_id', targetVariant.id);
    console.log("Order items for this variant:");
    console.dir(items, { depth: null });
  } else {
    console.log("Target variant not found, here are some variants:");
    console.log(variants.slice(0, 5));
  }
}

checkDb();
