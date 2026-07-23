-- إضافة أعمدة الحصص الخاصة باستيراد الإكسيل للباقة الأساسية
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS daily_import_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_import_days INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_import_date DATE,
ADD COLUMN IF NOT EXISTS current_quota_month TEXT;

-- تحديث البيانات القديمة لتجنب أخطاء القيم الفارغة
UPDATE public.tenants
SET daily_import_count = 0, monthly_import_days = 0
WHERE daily_import_count IS NULL;
