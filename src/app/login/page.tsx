"use client";

import { useState } from "react";
import React from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Check } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [planChoice, setPlanChoice] = useState("trial");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  // Handle URL errors on load
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "must_choose_plan") {
      setIsLogin(false);
      setError("عذراً، هذا الحساب غير مسجل لدينا. يرجى اختيار الباقة أولاً لإنشاء حساب شركتك.");
      toast.error("يرجى اختيار الباقة أولاً");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    let authError = null;
    try {
      let submitEmail = email.trim().toLowerCase();
      if (!submitEmail.endsWith('.com')) {
        setError("عذراً، يجب أن ينتهي البريد الإلكتروني بـ .com");
        setLoading(false);
        return;
      }
      
      let submitPassword = password;
      if (submitPassword === 'bobos') {
         submitPassword = 'bobosbobos';
      } else if (submitPassword.length > 0 && submitPassword.length < 6) {
         submitPassword = submitPassword + '123456';
      }

      let authData = null;

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: submitEmail,
        password: submitPassword,
      });
      authError = signInError;
      authData = data;

      if (authError) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        toast.error("فشل تسجيل الدخول");
        setLoading(false);
      } else {
        toast.success("تم تسجيل الدخول بنجاح!");
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error("Login Exception:", err);
      setError("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?plan=${planChoice}&isLogin=${isLogin}`,
      },
    });
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 text-center text-white max-w-2xl w-full">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Package className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">مخزني SaaS</h1>
          <p className="text-lg text-white leading-relaxed mb-8">
            أدر مخزونك، طلباتك، ومبيعاتك بكل سهولة واحترافية من مكان واحد.
          </p>

          {!isLogin && (
            <div className="text-right bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-xl mt-8">
              <Label className="text-2xl font-bold text-white block mb-6 text-center">اختر باقتك</Label>
              <div className="grid grid-cols-3 gap-6">
                {/* Trial */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPlanChoice('trial')}
                  className={`relative flex flex-col h-full items-start p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                    planChoice === 'trial' ? 'border-white bg-white/20 scale-105 shadow-2xl z-10' : 'border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-lg font-bold text-white mb-2">التجربة المجانية</div>
                  <div className="text-sm font-bold text-white border border-white/40 px-3 py-1 rounded-full mb-4">5 أيام مجاناً</div>
                  <ul className="space-y-2 mt-1 w-full flex-1 mb-4">
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> جرب كل المميزات مجاناً</li>
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> بدون بطاقة ائتمان</li>
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> تقارير مبيعات أساسية</li>
                  </ul>
                  <div className={`w-full mt-auto py-2.5 rounded-xl text-sm font-bold transition-all text-center ${planChoice === 'trial' ? 'bg-white text-indigo-700 shadow-md' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {planChoice === 'trial' ? 'تم الاختيار' : 'اختر الباقة'}
                  </div>
                </div>

                {/* Basic */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPlanChoice('basic')}
                  className={`relative flex flex-col h-full items-start p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                    planChoice === 'basic' ? 'border-white bg-white/20 scale-105 shadow-2xl z-10' : 'border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-lg font-bold text-white mb-2">الباقة الأساسية</div>
                  <div className="text-sm font-bold text-white border border-white/40 px-3 py-1 rounded-full mb-4">499 ج.م / شهر</div>
                  <ul className="space-y-2 mt-1 w-full flex-1 mb-4">
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> حتى 500 طلب شهرياً</li>
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> 2 مستخدمين بصلاحيات</li>
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> إدارة المنتجات والمخزون</li>
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> طباعة الباركود والفواتير</li>
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> حسابات الموردين والخزنة</li>
                  </ul>
                  <div className={`w-full mt-auto py-2.5 rounded-xl text-sm font-bold transition-all text-center ${planChoice === 'basic' ? 'bg-white text-indigo-700 shadow-md' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {planChoice === 'basic' ? 'تم الاختيار' : 'اختر الباقة'}
                  </div>
                </div>

                {/* Pro */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPlanChoice('pro')}
                  className={`relative flex flex-col h-full items-start p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                    planChoice === 'pro' ? 'border-white bg-white/20 scale-105 shadow-2xl z-10' : 'border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="absolute -top-3 left-4 bg-yellow-400 text-yellow-900 text-[11px] font-bold px-3 py-1 rounded-full shadow-md">
                    الأكثر مبيعاً
                  </div>
                  <div className="text-lg font-bold text-white mb-2 mt-1">الباقة الاحترافية</div>
                  <div className="text-sm font-bold text-white border border-white/40 px-3 py-1 rounded-full mb-4">999 ج.م / شهر</div>
                  <ul className="space-y-2 mt-1 w-full flex-1 mb-4">
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> حتى 2000 طلب شهرياً</li>
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> 5 مستخدمين بصلاحيات</li>
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> الذكاء الاصطناعي للطلبات</li>
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> استيراد سريع عبر إكسيل</li>
                    <li className="flex items-start gap-2 text-xs text-white leading-relaxed"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-300" /> طباعة الباركود والفواتير</li>
                  </ul>
                  <div className={`w-full mt-auto py-2.5 rounded-xl text-sm font-bold transition-all text-center ${planChoice === 'pro' ? 'bg-white text-indigo-700 shadow-md' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {planChoice === 'pro' ? 'تم الاختيار' : 'اختر الباقة'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side — Form */}
      <div className="flex-1 flex items-center justify-center bg-white p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isLogin ? "تسجيل الدخول" : "إنشاء حساب شركة جديدة"}
            </h2>
            <p className="text-gray-500 text-sm">
              {isLogin ? "أدخل بياناتك أو استخدم جوجل للوصول لحسابك" : "اختر باقتك وسجل حساب شركتك فوراً باستخدام جوجل"}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                {error}
              </div>
            )}
            
            {!isLogin && (
              <div className="space-y-3 pt-2 text-right lg:hidden mb-6">
                <Label className="text-sm font-bold text-gray-900">اختر باقتك</Label>
                <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setPlanChoice('trial')}
                  className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all ${
                    planChoice === 'trial' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={`font-bold ${planChoice === 'trial' ? 'text-indigo-900' : 'text-gray-900'}`}>التجربة المجانية</span>
                    <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full">5 أيام</span>
                  </div>
                  <span className="text-xs text-gray-500">جرب النظام بالكامل مجاناً</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPlanChoice('pro')}
                  className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all ${
                    planChoice === 'pro' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <div className="absolute -top-3 left-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    الأكثر مبيعاً
                  </div>
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={`font-bold ${planChoice === 'pro' ? 'text-indigo-900' : 'text-gray-900'}`}>الباقة الاحترافية</span>
                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">999 ج.م</span>
                  </div>
                  <span className="text-xs text-gray-500">للشركات والمتاجر الاحترافية</span>
                </button>
              </div>
            </div>
            )}
            
            {isLogin && (
              <>
                <div className="space-y-2 text-right">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="أدخل بريدك الإلكتروني"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    pattern="^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.com$"
                    title="يجب أن يكون بريداً إلكترونياً صحيحاً وينتهي بـ .com"
                    required
                    className="text-right h-11 rounded-lg border-gray-200 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500"
                  />
                </div>

                <div className="space-y-2 text-right">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="text-right h-11 rounded-lg border-gray-200 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors" 
                  disabled={loading}
                >
                  {loading ? "جاري المعالجة..." : "تسجيل الدخول"}
                </Button>
              </>
            )}

            <div className="text-center mt-2 mb-4">
              <button 
                type="button" 
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
              >
                {isLogin ? "ليس لديك حساب؟ سجل شركتك الآن" : "لديك حساب بالفعل؟ تسجيل الدخول"}
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">أو</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              className="w-full h-11 text-base font-medium rounded-lg border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              الدخول باستخدام Google
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
