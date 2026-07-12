"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Clock, ShieldAlert } from "lucide-react";

export default function SaaSAdminPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const supabase = createClient();

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_tenants');
      if (error) throw error;
      setTenants(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("فشل جلب بيانات الشركات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [supabase]);

  const handleActivate = async (tenantId: string) => {
    setActivating(tenantId);
    try {
      const { error } = await supabase.rpc('activate_tenant', { p_tenant_id: tenantId });
      if (error) throw error;
      toast.success("تم تفعيل الحساب بنجاح");
      fetchTenants();
    } catch (err: any) {
      console.error(err);
      toast.error("فشل تفعيل الحساب");
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center" dir="rtl">جاري التحميل...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-8" dir="rtl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة تحكم النظام (Super Admin)</h1>
          <p className="text-gray-500">إدارة الاشتراكات وتفعيل حسابات العملاء</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 font-semibold">الشركة</th>
                <th className="px-6 py-4 font-semibold text-left">الإيميل (المدير)</th>
                <th className="px-6 py-4 font-semibold">الباقة</th>
                <th className="px-6 py-4 font-semibold text-left">تاريخ التسجيل</th>
                <th className="px-6 py-4 font-semibold">الحالة</th>
                <th className="px-6 py-4 font-semibold text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{t.name}</td>
                  <td className="px-6 py-4 text-left" dir="ltr">{t.admin_email}</td>
                  <td className="px-6 py-4">
                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-medium text-xs">
                      {t.subscription_plan === 'pro' ? 'الاحترافية' : t.subscription_plan === 'basic' ? 'الأساسية' : 'التجريبية'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-left" dir="ltr">
                    {new Date(t.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-4">
                    {t.account_status === 'active' ? (
                      <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2.5 py-1 rounded-md w-max font-medium text-xs">
                        <Check className="w-3.5 h-3.5" /> مفعل
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md w-max font-medium text-xs">
                        <Clock className="w-3.5 h-3.5" /> بانتظار التفعيل
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 flex justify-center">
                    {t.account_status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleActivate(t.id)}
                        disabled={activating === t.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      >
                        {activating === t.id ? 'جاري التفعيل...' : 'تفعيل الحساب'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">لا يوجد عملاء مسجلين حتى الآن</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
