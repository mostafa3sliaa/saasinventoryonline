"use client";

import { useState } from "react";
import { useTenant } from "@/components/shared/TenantProvider";
import { createClient } from "@/utils/supabase/client";
import { Check, Crown, Zap, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const plans = [
  {
    id: "basic",
    name: "الباقة الأساسية",
    description: "مثالية للتجار المبتدئين والمتاجر الصغيرة.",
    price: "499",
    icon: Shield,
    features: [
      "حتى 500 طلب شهرياً",
      "2 مستخدمين (أدمن + موظف)",
      "إدارة المنتجات والمخزون",
      "طباعة الباركود والفواتير",
      "تسجيل الطلبات يدوياً",
      "حسابات الموردين والخزنة",
      "تقارير المبيعات الأساسية",
    ],
  },
  {
    id: "pro",
    name: "الباقة الاحترافية",
    description: "للشركات المتوسطة التي تبحث عن الأتمتة.",
    price: "999",
    icon: Zap,
    popular: true,
    features: [
      "كل مميزات الباقة الأساسية",
      "حتى 2000 طلب شهرياً",
      "5 مستخدمين بصلاحيات مخصصة",
      "استيراد سريع للطلبات عبر إكسيل",
      "استخدام الذكاء الاصطناعي لرفع الطلبات",
      "تقرير النواقص التلقائي وحل التعارض",
      "طباعة الباركود والفواتير",
    ],
  },
];

export default function BillingPage() {
  const { tenant, refreshTenant } = useTenant();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleSubscribe = async (planId: string) => {
    if (!tenant) return;
    
    setLoadingPlan(planId);
    
    try {
      // Update the tenant's subscription plan
      const { error } = await supabase
        .from('tenants')
        .update({ subscription_plan: planId, account_status: 'pending' })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success("تم تحديث باقتك بنجاح!");
      await refreshTenant(); // Refresh context to reflect new plan
      router.push('/dashboard'); // Go back to dashboard
    } catch (err: any) {
      toast.error("حدث خطأ أثناء تفعيل الباقة");
      console.error(err);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8" dir="rtl">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
          اختر الباقة المناسبة لنمو أعمالك
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          وفرنا لك باقات مرنة لتناسب حجم عملك. يمكنك الترقية في أي وقت بكل سهولة للوصول إلى ميزات الأتمتة المتقدمة.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = tenant?.subscription_plan === plan.id;
          const isPopular = plan.popular;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col p-8 rounded-3xl transition-all duration-300 ${
                isPopular
                  ? "bg-white dark:bg-[#1E293B] shadow-2xl ring-2 ring-indigo-600 scale-105 z-10"
                  : "bg-white dark:bg-[#1E293B] shadow-xl border border-gray-100 dark:border-white/[0.06]"
              }`}
            >
              {isPopular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                  الأكثر مبيعاً
                </div>
              )}

              <div className="mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  isPopular ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}>
                  <plan.icon className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 min-h-[40px]">{plan.description}</p>
              </div>

              <div className="mb-8">
                <span className="text-5xl font-extrabold text-gray-900 dark:text-white">{plan.price}</span>
                <span className="text-gray-500 dark:text-gray-400 font-medium"> ج.م / شهرياً</span>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className={`w-5 h-5 shrink-0 ${isPopular ? "text-indigo-600" : "text-green-500"}`} />
                    <span className="text-gray-700 dark:text-gray-300 font-medium text-sm leading-tight">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(plan.id)}
                disabled={isCurrentPlan || loadingPlan === plan.id}
                className={`w-full h-14 rounded-xl text-lg font-bold transition-all ${
                  isCurrentPlan
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 cursor-default"
                    : isPopular
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-xl hover:-translate-y-1"
                    : "bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 text-white"
                }`}
              >
                {loadingPlan === plan.id ? "جاري التفعيل..." : isCurrentPlan ? "باقتك الحالية" : "اشترك الآن"}
              </Button>
            </div>
          );
        })}
      </div>
      
      <div className="mt-12 text-center">
        <Button variant="ghost" className="gap-2" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="w-4 h-4" /> العودة للوحة التحكم
        </Button>
      </div>
    </div>
  );
}
