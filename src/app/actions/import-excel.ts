"use server";

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function importExcelProducts(products: any[]) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("غير مصرح لك بالدخول");

    // Get tenant info and quota columns
    const { data: tenantData, error: tenantErr } = await supabase
      .from('users')
      .select('tenant_id, tenants(subscription_plan, daily_import_count, monthly_import_days, last_import_date, current_quota_month)')
      .eq('id', user.id)
      .single();

    if (tenantErr || !tenantData?.tenant_id) throw new Error("حدث خطأ في جلب بيانات الشركة");

    const tenantId = tenantData.tenant_id;
    const tenant = (tenantData.tenants as any);
    const plan = tenant.subscription_plan || 'basic';

    // 1. Quota Logic for Basic Plan
    if (plan === 'basic') {
      const now = new Date();
      // Format as YYYY-MM
      const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      // Format as YYYY-MM-DD
      const currentDate = now.toISOString().split('T')[0];

      let monthlyDays = tenant.monthly_import_days || 0;
      let dailyCount = tenant.daily_import_count || 0;

      // Reset month if it's a new month
      if (tenant.current_quota_month !== currentMonth) {
        monthlyDays = 0;
        dailyCount = 0;
      }

      // Reset day if it's a new day
      if (tenant.last_import_date !== currentDate) {
        monthlyDays += 1;
        dailyCount = 0;
      }

      // Check limits
      if (monthlyDays > 20 && tenant.last_import_date !== currentDate) {
        return { success: false, error: "quota_exceeded", message: "لقد استهلكت الحد الأقصى لأيام الاستيراد هذا الشهر (20 يوماً). رقي باقتك للاحترافية!" };
      }

      if (dailyCount >= 2) {
        return { success: false, error: "quota_exceeded", message: "لقد استهلكت الحد اليومي للاستيراد (مرتين). رقي باقتك للاحترافية لاستيراد غير محدود!" };
      }

      // Update quota in DB
      await supabase.from('tenants').update({
        current_quota_month: currentMonth,
        last_import_date: currentDate,
        daily_import_count: dailyCount + 1,
        monthly_import_days: monthlyDays
      }).eq('id', tenantId);
    }

    // 2. Process data and insert
    // Group rows by product name to avoid duplicate products
    const productGroups: { [key: string]: any[] } = {};
    for (const row of products) {
      const name = row['الاسم'] || row['اسم المنتج'] || row['name'];
      if (!name) continue;
      
      if (!productGroups[name]) {
        productGroups[name] = [];
      }
      productGroups[name].push(row);
    }

    let importedCount = 0;
    
    for (const [productName, variants] of Object.entries(productGroups)) {
      const category = variants[0]['القسم'] || variants[0]['الفئة'] || variants[0]['category'] || 'عام';
      const description = variants[0]['الوصف'] || variants[0]['description'] || '';

      // Check if product exists for this tenant
      let { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', productName)
        .single();

      let productId = existingProduct?.id;

      if (!productId) {
        const { data: newProduct } = await supabase
          .from('products')
          .insert({
            tenant_id: tenantId,
            name: productName,
            category: category,
            description: description
          })
          .select('id')
          .single();
          
        if (newProduct) productId = newProduct.id;
      }

      if (productId) {
        // Insert variants
        for (const variant of variants) {
          const barcode = variant['الباركود'] || variant['barcode'] || null;
          const sellingPrice = parseFloat(variant['سعر البيع'] || variant['السعر'] || variant['price'] || 0);
          const normalCost = parseFloat(variant['التكلفة'] || variant['cost'] || 0);
          const stockQuantity = parseInt(variant['الكمية'] || variant['المخزون'] || variant['stock'] || 0);
          const sku = variant['sku'] || variant['كود الصنف'] || null;

          // Check if variant with this barcode already exists
          let shouldInsert = true;
          if (barcode) {
             const { data: existingVariant } = await supabase
               .from('product_variants')
               .select('id')
               .eq('barcode', barcode)
               .single();
             if (existingVariant) shouldInsert = false;
          }

          if (shouldInsert) {
             await supabase.from('product_variants').insert({
               product_id: productId,
               barcode: barcode,
               sku: sku,
               selling_price: isNaN(sellingPrice) ? 0 : sellingPrice,
               normal_cost: isNaN(normalCost) ? 0 : normalCost,
               stock_quantity: isNaN(stockQuantity) ? 0 : stockQuantity,
               low_stock_threshold: 5
             });
             importedCount++;
          }
        }
      }
    }

    return { success: true, count: importedCount };
  } catch (error: any) {
    console.error("Import error:", error);
    return { success: false, message: error.message || "حدث خطأ غير متوقع" };
  }
}
