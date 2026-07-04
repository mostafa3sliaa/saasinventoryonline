"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/components/shared/TenantProvider";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { UploadCloud, Image as ImageIcon, Shield, User, Trash2, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const { tenant, currentUser, loading: tenantLoading, refreshTenant } = useTenant();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#4F46E5");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || "");
      setColor(tenant.primary_color || "#000000");
      setLogoUrl(tenant.logo_url || "");
    }
  }, [tenant]);

  useEffect(() => {
    if (tenant && currentUser?.role === "admin") {
      fetchUsers();
    }
  }, [tenant, currentUser]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("tenant_id", tenant?.id)
      .order("created_at", { ascending: true });
      
    if (!error && data) {
      setUsers(data);
    }
    setLoadingUsers(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", userId);
      
    if (error) {
      toast.error("فشل في تحديث صلاحية المستخدم");
    } else {
      toast.success("تم تحديث الصلاحية بنجاح");
      fetchUsers();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("هل أنت متأكد من إزالة هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    
    // Note: This only deletes the profile from public.users, not auth.users
    // A proper implementation needs Edge Functions to delete auth user
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);
      
    if (error) {
      toast.error("فشل في إزالة المستخدم");
    } else {
      toast.success("تم إزالة المستخدم بنجاح");
      fetchUsers();
    }
  };

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    
    const { error } = await supabase
      .from("tenants")
      .update({ name, primary_color: color, logo_url: logoUrl })
      .eq("id", tenant.id);

    if (error) {
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
    } else {
      toast.success("تم حفظ الإعدادات بنجاح");
      document.documentElement.style.setProperty("--primary", color);
      if (typeof refreshTenant === "function") {
        await refreshTenant();
      }
    }
    
    setSaving(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("يجب اختيار صورة");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${tenant?.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("branding")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("branding")
        .getPublicUrl(filePath);
        
      if (data) {
        setLogoUrl(data.publicUrl);
        toast.success("تم رفع الشعار بنجاح، لا تنس حفظ التغييرات");
      }
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ أثناء رفع الشعار");
    } finally {
      setUploading(false);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm("هل أنت متأكد من مسح جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.")) return;

    setResetting(true);
    try {
      const res = await fetch("/api/reset-data", {
        method: "POST"
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "فشل تصفير البيانات");
      
      toast.success(data.message);
      // Reload page to reflect changes
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setResetting(false);
    }
  };

  if (tenantLoading) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">إعدادات النظام</h2>
        <p className="text-sm text-gray-500 mt-1">
          قم بتخصيص شكل واسم النظام وإدارة المستخدمين.
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="general">الإعدادات العامة</TabsTrigger>
          <TabsTrigger value="users">إدارة المستخدمين</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="bg-white dark:bg-[#1E293B] rounded-xl border border-gray-100 dark:border-white/[0.06] p-6">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">الهوية البصرية</h3>
              <p className="text-sm text-gray-500 mt-1">
                تغيير اسم الشركة واللون الأساسي للتطبيق
              </p>
            </div>
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="space-y-4 flex-1 w-full text-right">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">اسم الشركة</Label>
                    <Input 
                      id="companyName" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      className="text-right bg-white/50 dark:bg-gray-900/50"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">اللون الأساسي</Label>
                    <div className="flex gap-4 items-center">
                      <Input 
                        id="primaryColor" 
                        type="color"
                        value={color} 
                        onChange={(e) => setColor(e.target.value)} 
                        className="w-20 h-10 p-1 cursor-pointer bg-white dark:bg-gray-900"
                      />
                      <span className="text-sm text-gray-500 dir-ltr">{color}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-900/50 flex-1 w-full text-center hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors">
                  {logoUrl ? (
                    <div className="relative w-32 h-32 mb-4 rounded-md overflow-hidden bg-white dark:bg-gray-800 border shadow-sm flex items-center justify-center p-2">
                      <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-24 h-24 mb-4 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                      <ImageIcon size={40} />
                    </div>
                  )}
                  
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex gap-2"
                  >
                    <UploadCloud className="w-4 h-4" />
                    {uploading ? "جاري الرفع..." : "تغيير الشعار"}
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    يفضل استخدام صورة مربعة (PNG أو SVG) شفافة الخلفية.
                  </p>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 dark:border-white/[0.06]">
              <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/30 p-6 mt-6">
            <div className="mb-6 flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-red-700 dark:text-red-400">منطقة الخطر (Danger Zone)</h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                  تصفير جميع البيانات. سيتم مسح جميع المنتجات، الطلبات، العملاء، والموردين. ستحتفظ بحسابك واسم شركتك فقط. هذا الإجراء لا يمكن التراجع عنه!
                </p>
              </div>
            </div>
            
            <div className="pt-4 border-t border-red-200/50 dark:border-red-900/30">
              <Button 
                variant="destructive" 
                onClick={handleResetData} 
                disabled={resetting || currentUser?.role !== "admin"} 
                className="w-full md:w-auto"
              >
                {resetting ? "جاري الحذف..." : "مسح جميع البيانات والبدء من جديد"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="bg-white dark:bg-[#1E293B] rounded-xl border border-gray-100 dark:border-white/[0.06] p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">فريق العمل</h3>
              <p className="text-sm text-gray-500 mt-1">
                إدارة صلاحيات المستخدمين في شركتك.
              </p>
            </div>
            <div>
              {currentUser?.role !== "admin" ? (
                <div className="text-center p-8 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p>عذراً، يجب أن تكون بحساب مدير (Admin) للوصول إلى هذه الصفحة.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {loadingUsers ? (
                    <p className="text-center text-gray-500 py-4">جاري التحميل...</p>
                  ) : users.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">لا يوجد مستخدمين آخرين.</p>
                  ) : (
                    users.map((user) => (
                      <div key={user.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gray-50 dark:bg-white/[0.03] rounded-lg border border-gray-100 dark:border-white/[0.06] gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{user.full_name}</p>
                            <p className="text-sm text-gray-500 dir-ltr text-right">{user.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <Select 
                            defaultValue={user.role} 
                            onValueChange={(val) => handleRoleChange(user.id, val)}
                            disabled={user.id === currentUser?.id}
                          >
                            <SelectTrigger className="w-[140px] h-9">
                              <SelectValue placeholder="الصلاحية" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value="admin">مدير (Admin)</SelectItem>
                              <SelectItem value="sales">مبيعات (Sales)</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-9 w-9 shrink-0"
                            disabled={user.id === currentUser?.id}
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
