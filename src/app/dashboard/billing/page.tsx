"use client";

import { useState, useEffect } from "react";
import { useTenant } from "@/components/shared/TenantProvider";
import { createClient } from "@/utils/supabase/client";
import { Check, Crown, Zap, Shield, ArrowLeft, Search, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { downgradePlanWithKeptUsers } from "@/app/actions/billing-actions";

const plans = [
  {
    id: "basic",
    name: "الباقة الأساسية",
    description: "مثالية للتجار المبتدئين والمتاجر الصغيرة.",
    durations: [
      { months: 1, price: "499", label: "1 شهر" },
      { months: 6, price: "2,500", label: "6 شهور" },
      { months: 12, price: "4,300", label: "سنة" },
    ],
    icon: Shield,
    features: [
      "تجربة مجانية لمدة 15 يوماً",
      "عدد طلبات غير محدود",
      "حتى 5 مستخدمين بصلاحيات",
      "إدارة المنتجات والمخزون",
      "طباعة الباركود والفواتير",
      "حسابات الموردين والخزنة",
      "استيراد إكسيل مرتين يومياً فقط",
    ],
  },
  {
    id: "pro",
    name: "الباقة الاحترافية",
    description: "للشركات المتوسطة التي تبحث عن الأتمتة.",
    durations: [
      { months: 1, price: "999", label: "1 شهر" },
      { months: 6, price: "5,000", label: "6 شهور" },
      { months: 12, price: "8,600", label: "سنة" },
    ],
    icon: Zap,
    popular: true,
    features: [
      "تجربة مجانية لمدة 15 يوماً",
      "مستخدمين غير محدودين",
      "استيراد سريع للطلبات عبر إكسيل (غير محدود)",
      "استخدام الذكاء الاصطناعي",
      "تقرير النواقص التلقائي وحل التعارض",
      "كل مميزات الباقة الأساسية",
    ],
  },
];

export default function BillingPage() {
  const { tenant, refreshTenant } = useTenant();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [isDowngradeModalOpen, setIsDowngradeModalOpen] = useState(false);
  const [selectedKeepUsers, setSelectedKeepUsers] = useState<string[]>([]);
  const [searchUser, setSearchUser] = useState("");
  const [isDowngrading, setIsDowngrading] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  const handleSubscribe = async (planId: string) => {
    if (!tenant) return;
    
    // Check for downgrade logic
    if (planId === 'basic' && tenant.subscription_plan === 'pro') {
      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData && usersData.length > 5) {
        setTeamUsers(usersData);
        // Pre-select current user and the first few to reach 5
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const preSelected = [user.id];
          for (const u of usersData) {
            if (preSelected.length < 5 && !preSelected.includes(u.id)) {
              preSelected.push(u.id);
            }
          }
          setSelectedKeepUsers(preSelected);
        }
        setIsDowngradeModalOpen(true);
        return;
      }
    }

    // Normal plan switch
    setLoadingPlan(planId);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ subscription_plan: planId })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success("تم تحديث باقتك بنجاح!");
      await refreshTenant();
      router.push('/dashboard');
    } catch (err: any) {
      toast.error("حدث خطأ أثناء تفعيل الباقة");
      console.error(err);
    } finally {
      setLoadingPlan(null);
    }
  };

  const [selectedDurations, setSelectedDurations] = useState<{ [key: string]: number }>({ basic: 1, pro: 1 });

  const handleDurationSelect = (planId: string, months: number) => {
    setSelectedDurations(prev => ({ ...prev, [planId]: months }));
  };

  const executeDowngrade = async () => {
    if (selectedKeepUsers.length > 5) {
      toast.error("لا يمكنك الاحتفاظ بأكثر من 5 مستخدمين في الباقة الأساسية");
      return;
    }
    
    setIsDowngrading(true);
    try {
      const res = await downgradePlanWithKeptUsers(selectedKeepUsers);
      if (res.success) {
        toast.success("تم النزول للباقة الأساسية وحذف الموظفين بنجاح");
        setIsDowngradeModalOpen(false);
        await refreshTenant();
        router.push('/dashboard');
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("حدث خطأ غير متوقع");
    } finally {
      setIsDowngrading(false);
    }
  };

  const toggleKeepUser = (id: string, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      toast.error("لا يمكنك حذف حسابك الخاص كمدير");
      return;
    }

    if (selectedKeepUsers.includes(id)) {
      setSelectedKeepUsers(selectedKeepUsers.filter(u => u !== id));
    } else {
      if (selectedKeepUsers.length >= 5) {
        toast.error("الحد الأقصى هو 5 مستخدمين فقط");
        return;
      }
      setSelectedKeepUsers([...selectedKeepUsers, id]);
    }
  };

  const filteredUsers = teamUsers.filter(u => 
    u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto py-8" dir="rtl">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
          اختر الباقة المناسبة لنمو أعمالك
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          وفرنا لك باقات مرنة لتناسب حجم عملك. جرب أي باقة لمدة 15 يوماً مجاناً، وقم بالترقية أو النزول بحريتك في أي وقت.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
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

              {/* Duration Selectors */}
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6">
                {plan.durations.map(dur => {
                  const isSelected = selectedDurations[plan.id] === dur.months;
                  return (
                    <button
                      key={dur.months}
                      onClick={() => handleDurationSelect(plan.id, dur.months)}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                        isSelected 
                          ? "bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white shadow-sm" 
                          : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {dur.label}
                    </button>
                  );
                })}
              </div>

              <div className="mb-8">
                {plan.durations.map(dur => {
                  if (dur.months !== selectedDurations[plan.id]) return null;
                  return (
                    <div key={dur.months}>
                      <span className="text-5xl font-extrabold text-gray-900 dark:text-white">{dur.price}</span>
                      <span className="text-gray-500 dark:text-gray-400 font-medium"> ج.م</span>
                    </div>
                  );
                })}
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
                {loadingPlan === plan.id ? "جاري التفعيل..." : isCurrentPlan ? "باقتك الحالية" : "اختيار الباقة"}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Enterprise / Buy the system section */}
      <div className="max-w-4xl mx-auto bg-gradient-to-r from-gray-900 to-indigo-900 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="text-right flex-1">
            <h3 className="text-3xl font-black text-white mb-3">امتلك النظام بالكامل</h3>
            <p className="text-indigo-100 text-lg mb-4">
              هل تدير شركة كبيرة وتريد استقلالية تامة؟ يمكنك شراء نسخة كاملة من النظام (White-label) وتركيبها على سيرفراتك الخاصة بدون اشتراكات شهرية.
            </p>
            <ul className="flex flex-wrap gap-4 text-sm font-medium text-indigo-200">
              <li className="flex items-center gap-1"><Check className="w-4 h-4 text-green-400" /> سيرفر خاص بك</li>
              <li className="flex items-center gap-1"><Check className="w-4 h-4 text-green-400" /> لوجو واسم شركتك</li>
              <li className="flex items-center gap-1"><Check className="w-4 h-4 text-green-400" /> دعم فني مخصص</li>
            </ul>
          </div>
          
          <a 
            href="https://wa.me/201000000000?text=أريد الاستفسار عن شراء نسخة كاملة من نظام مخزني" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button className="h-14 px-8 text-lg font-bold bg-white text-indigo-900 hover:bg-indigo-50 shadow-xl hover:scale-105 transition-all gap-2 rounded-xl whitespace-nowrap">
              <Phone className="w-5 h-5" /> تواصل مع المبيعات
            </Button>
          </a>
        </div>
      </div>
      
      <div className="mt-12 text-center">
        <Button variant="ghost" className="gap-2" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="w-4 h-4" /> العودة للوحة التحكم
        </Button>
      </div>

      {/* Downgrade Modal */}
      <Dialog open={isDowngradeModalOpen} onOpenChange={setIsDowngradeModalOpen}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">النزول للباقة الأساسية</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              الباقة الأساسية تدعم حتى 5 مستخدمين فقط، بينما شركتك بها {teamUsers.length} مستخدمين.
              يرجى اختيار 5 موظفين بحد أقصى (شاملاً إياك) <span className="font-bold text-indigo-600">للاحتفاظ بهم</span>. أي موظف لم يتم اختياره سيتم حذف حسابه نهائياً.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="ابحث عن الموظف بالاسم أو البريد..." 
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              className="pl-3 pr-9 h-11"
            />
          </div>

          <div className="bg-indigo-50 text-indigo-800 text-sm p-3 rounded-lg font-bold flex justify-between items-center mb-4">
            <span>تم اختيار: {selectedKeepUsers.length} من 5</span>
            {selectedKeepUsers.length === 5 && <span className="text-green-600">اكتمل العدد</span>}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredUsers.map(u => {
              const isCurrentUser = u.role === 'admin'; // Assuming admin is the one doing this
              const isSelected = selectedKeepUsers.includes(u.id);

              return (
                <div 
                  key={u.id}
                  onClick={() => toggleKeepUser(u.id, isCurrentUser)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 hover:border-gray-300'
                  } ${isCurrentUser ? 'opacity-80 cursor-not-allowed' : ''}`}
                >
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {u.full_name} {isCurrentUser && "(المدير - أنت)"}
                    </p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                  
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="mt-6 flex gap-3 sm:justify-start">
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto font-bold"
              onClick={executeDowngrade}
              disabled={isDowngrading || selectedKeepUsers.length > 5}
            >
              {isDowngrading ? "جاري التحديث..." : "تأكيد والنزول للباقة"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsDowngradeModalOpen(false)}
              disabled={isDowngrading}
              className="w-full sm:w-auto"
            >
              تراجع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
