"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Clock, ShieldAlert, MoreVertical, Ban, ArrowUpCircle, ArrowRight } from "lucide-react";
import { getAllTenants, activateTenant, updateTenantPlan, updateTenantStatus, deleteTenantCompletely } from "@/app/actions/admin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

export default function SaaSAdminPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchTenants = async () => {
    try {
      const data = await getAllTenants();
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
  }, []);

  const handleAction = async (tenantId: string, actionName: string, actionFn: () => Promise<any>) => {
    setProcessingId(tenantId);
    try {
      await actionFn();
      toast.success(`تم ${actionName} بنجاح`);
      fetchTenants();
    } catch (err: any) {
      console.error(err);
      toast.error(`فشل ${actionName}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center" dir="rtl">جاري التحميل...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-8" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">لوحة تحكم النظام (Super Admin)</h1>
            <p className="text-gray-500">إدارة الاشتراكات وتفعيل حسابات العملاء</p>
          </div>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" className="flex items-center gap-2 text-gray-600">
            العودة للداشبورد <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
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
                    ) : t.account_status === 'suspended' ? (
                      <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-md w-max font-medium text-xs">
                        <Ban className="w-3.5 h-3.5" /> موقوف
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md w-max font-medium text-xs">
                        <Clock className="w-3.5 h-3.5" /> بانتظار التفعيل
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 flex justify-center">
                    {processingId === t.id ? (
                      <span className="text-gray-400 text-xs font-medium">جاري...</span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48" dir="rtl">
                          <div className="px-2 py-1.5 text-sm font-semibold text-gray-900">الإجراءات</div>
                          <DropdownMenuSeparator />
                          {t.account_status !== 'active' && (
                            <DropdownMenuItem onClick={() => handleAction(t.id, "تفعيل الحساب", () => updateTenantStatus(t.id, 'active'))}>
                              <Check className="w-4 h-4 ml-2 text-green-600" /> تفعيل الحساب
                            </DropdownMenuItem>
                          )}
                          {t.account_status === 'active' && (
                            <DropdownMenuItem onClick={() => handleAction(t.id, "إيقاف الحساب", () => updateTenantStatus(t.id, 'suspended'))}>
                              <Ban className="w-4 h-4 ml-2 text-red-600" /> إيقاف الحساب
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAction(t.id, "الترقية للأساسية", () => updateTenantPlan(t.id, 'basic'))} disabled={t.subscription_plan === 'basic'}>
                            <ArrowUpCircle className="w-4 h-4 ml-2 text-indigo-600" /> الترقية للأساسية
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction(t.id, "الترقية للاحترافية", () => updateTenantPlan(t.id, 'pro'))} disabled={t.subscription_plan === 'pro'}>
                            <ArrowUpCircle className="w-4 h-4 ml-2 text-indigo-600" /> الترقية للاحترافية
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => {
                              if (window.confirm("تحذير خطير: هل أنت متأكد من حذف هذه الشركة وكل بياناتها والمستخدمين نهائياً؟ هذا الإجراء لا يمكن التراجع عنه!")) {
                                handleAction(t.id, "حذف الحساب نهائياً", () => deleteTenantCompletely(t.id));
                              }
                            }}
                            className="text-red-600 focus:text-red-700 focus:bg-red-50"
                          >
                            <ShieldAlert className="w-4 h-4 ml-2" /> حذف الحساب نهائياً
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
