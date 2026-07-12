"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Brain, FileSpreadsheet, Send, Settings, AlertTriangle, Plus, Trash2, CheckCircle2, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";

interface AIOfficeAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allVariants: any[];
  tenantId: string;
  onSuccess: () => void;
}

interface ExtractedItem {
  rawProductName: string;
  variantId: string; // Matched variant ID
  quantity: number;
  price: number;
}

interface ExtractedOrder {
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  shippingFee: number;
  notes: string;
  items: ExtractedItem[];
}

const formatOrderCountArabic = (count: number): string => {
  if (count === 1) return "طلب واحد";
  if (count === 2) return "طلبين";
  if (count >= 3 && count <= 10) return `${count} طلبات`;
  return `${count} طلباً`;
};

const getUnmatchedOrdersText = (count: number): string => {
  if (count === 1) return "يوجد طلب واحد يحتوي على منتجات غير مطابقة مع المخزن";
  if (count === 2) return "يوجد طلبان يحتويان على منتجات غير مطابقة مع المخزن";
  if (count >= 3 && count <= 10) return `يوجد ${count} طلبات تحتوي على منتجات غير مطابقة مع المخزن`;
  return `يوجد ${count} طلباً يحتوي كل منها على منتجات غير مطابقة مع المخزن`;
};

export default function AIOfficeAssistant({ open, onOpenChange, allVariants, tenantId, onSuccess }: AIOfficeAssistantProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [showSettings, setShowSettings] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load API key from local storage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem("flatkey_api_key") || "sk-sc6UurN4FkPZTtmM5qzKoxPFOJampmWrFwLeBRdSk8bHjeMn";
    setApiKey(savedKey);
    const savedModel = localStorage.getItem("flatkey_model") || "gpt-4o-mini";
    setSelectedModel(savedModel);
  }, []);

  const handleSaveApiKey = () => {
    localStorage.setItem("flatkey_api_key", apiKey.trim());
    localStorage.setItem("flatkey_model", selectedModel);
    toast.success("تم حفظ المفتاح والإعدادات بنجاح");
    setShowSettings(false);
  };

  // Fuzzy match function for product variants
  const matchVariant = (rawName: string): string => {
    if (!rawName || allVariants.length === 0) return "";
    const cleanRaw = rawName.toLowerCase().replace(/[^a-zA-Z0-9آ-ي\s]/g, "");
    const rawWords = cleanRaw.split(/\s+/).filter(w => w.length > 1);
    
    let bestMatchId = "";
    let bestScore = 0;
    
    for (const v of allVariants) {
      const combinedName = `${v.productName} ${v.variantName}`.toLowerCase().replace(/[^a-zA-Z0-9آ-ي\s]/g, "");
      const variantWords = combinedName.split(/\s+/).filter(w => w.length > 1);
      
      let score = 0;
      for (const rw of rawWords) {
        if (variantWords.includes(rw)) {
          score += 2; // Exact word match
        } else if (variantWords.some(vw => vw.includes(rw) || rw.includes(vw))) {
          score += 1; // Partial word match
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatchId = v.id;
      }
    }
    
    return bestScore >= 2 ? bestMatchId : "";
  };

  // Call Gemini API to extract data
  const extractWithAI = async (textToProcess: string) => {
    const activeKey = apiKey.trim() || "";
    
    if (!activeKey) {
      toast.error("يرجى إدخال مفتاح الـ API أولاً من زر الإعدادات ⚙️");
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setLoadingStep("جاري إرسال البيانات للذكاء الاصطناعي لاستخراج الطلبات...");

    const systemPrompt = `
You are an expert order extraction assistant for an e-commerce dashboard.
Your task is to parse unstructured input text (which could be chat logs from WhatsApp/Facebook, email order details, or structured lists) and extract all order details into a clean JSON object containing an "orders" array matching the schema below.

Rules:
1. You must extract all orders found in the text.
2. For each order, extract:
   - customerName: Full name of the customer (Default to "" if not found)
   - customerPhone: Phone number of the customer as a string. IMPORTANT: Keep the leading zero (e.g., "01012345678"). Do not output it as a number, output it strictly as a string with 11 digits starting with 0.
   - customerCity: City or Governorate (e.g. القاهرة, الجيزة, الإسكندرية, etc.)
   - customerAddress: Detailed street address
   - shippingFee: Numeric value for shipping fee. (If mentioned, extract it, e.g. "شحن 50" -> 50. Default to 0)
   - notes: Any special delivery instructions or client comments
   - items: An array of ordered items, each containing:
     * rawProductName: The product name, size, color exactly as written in the text (e.g. "كوتشي ابيض مقاس 43")
     * quantity: Number of items ordered (default to 1)
     * price: Unit price of the item (if mentioned, extract it as number, default to 0)

Ensure you return ONLY a raw JSON object matching this structure:
{
  "orders": [
    {
      "customerName": "أحمد محمد",
      "customerPhone": "01012345678",
      "customerCity": "القاهرة",
      "customerAddress": "12 شارع التحرير، الدقي",
      "shippingFee": 50,
      "notes": "الاتصال قبل التسليم",
      "items": [
        {
          "rawProductName": "كوتشي كاجوال أبيض مقاس 43",
          "quantity": 1,
          "price": 350
        }
      ]
    }
  ]
}
`;

    try {
      let responseData: any = null;
      
      const payload = {
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Input text to extract orders from:\n${textToProcess}` }
        ],
        response_format: { type: "json_object" }
      };

      const response = await fetch(`https://console.flatkey.ai/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${activeKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || "فشلت عملية الاستخراج";
        throw new Error(errorMessage);
      }

      responseData = await response.json();
      const rawText = responseData.choices?.[0]?.message?.content || "{}";
      
      // Clean up markdown code blocks if the model wrapped the JSON
      let cleanText = rawText.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```json\s*/i, "")
                             .replace(/^```\s*/, "")
                             .replace(/```\s*$/, "")
                             .trim();
      }

      const parsedData = JSON.parse(cleanText);
      const parsedOrders = Array.isArray(parsedData) ? parsedData : (parsedData.orders || []);
      
      if (!Array.isArray(parsedOrders)) {
        throw new Error("تنسيق الرد غير صحيح");
      }

      // Helper function to clean and format Egyptian mobile numbers to exactly 11 digits
      const cleanEgyptianPhone = (phoneStr: string): string => {
        if (!phoneStr) return "";
        // Convert to string and keep only digits
        let cleaned = String(phoneStr).replace(/\D/g, "");
        
        // Remove Egyptian country code if present (20 or 0020)
        if (cleaned.startsWith("20") && cleaned.length === 12) {
          cleaned = "0" + cleaned.substring(2);
        } else if (cleaned.startsWith("0020") && cleaned.length === 14) {
          cleaned = "0" + cleaned.substring(4);
        }
        
        // If leading zero was dropped by JSON parser (e.g. 1012345678 instead of 01012345678)
        if (cleaned.length === 10 && (cleaned.startsWith("10") || cleaned.startsWith("11") || cleaned.startsWith("12") || cleaned.startsWith("15"))) {
          cleaned = "0" + cleaned;
        }
        
        return cleaned;
      };

      // Map and match variants
      const processed = parsedOrders.map(order => ({
        customerName: order.customerName || "",
        customerPhone: cleanEgyptianPhone(order.customerPhone),
        customerCity: order.customerCity || "",
        customerAddress: order.customerAddress || "",
        shippingFee: Number(order.shippingFee) || 0,
        notes: order.notes || "",
        items: (order.items || []).map((item: any) => {
          const matchedId = matchVariant(item.rawProductName);
          // Get price of matched variant if extracted price is 0
          let unitPrice = Number(item.price) || 0;
          if (unitPrice === 0 && matchedId) {
            const v = allVariants.find(av => av.id === matchedId);
            if (v) unitPrice = Number(v.price) || 0;
          }
          return {
            rawProductName: item.rawProductName || "",
            variantId: matchedId,
            quantity: Number(item.quantity) || 1,
            price: unitPrice
          };
        })
      }));

      setExtractedOrders(processed);
      setReviewMode(true);
      toast.success(`تم استخراج ${processed.length} طلب(ات) بنجاح! يرجى مراجعتها وتأكيدها.`);
    } catch (e: any) {
      console.error(e);
      toast.error(`حدث خطأ أثناء الاستخراج: ${e.message}`);
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  // Parse Excel upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setLoadingStep("جاري قراءة وتحليل ملف الإكسيل...");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (rawJson.length === 0) {
          throw new Error("الملف فارغ!");
        }

        // Format as structured text for LLM parsing
        const formattedText = rawJson
          .map((row, index) => `الصف ${index + 1}: ${row.map(val => val !== undefined && val !== null ? String(val).trim() : "").join(" | ")}`)
          .join("\n");

        toast.info("تم قراءة ملف الإكسيل. جاري إرساله للذكاء الاصطناعي للتعرف الذكي على الأعمدة والبيانات...");
        await extractWithAI(formattedText);
      } catch (err: any) {
        toast.error("فشل قراءة ملف الإكسيل: " + err.message);
        setLoading(false);
        setLoadingStep("");
      }
    };
    reader.readAsArrayBuffer(file);
    // Clear input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Edit fields in review state
  const handleOrderChange = (orderIdx: number, field: keyof ExtractedOrder, val: any) => {
    const updated = [...extractedOrders];
    updated[orderIdx] = { ...updated[orderIdx], [field]: val } as any;
    setExtractedOrders(updated);
  };

  const handleItemChange = (orderIdx: number, itemIdx: number, field: keyof ExtractedItem, val: any) => {
    const updated = [...extractedOrders];
    const items = [...updated[orderIdx].items];
    
    if (field === "variantId") {
      // Auto-fill price from selected variant if variant changes
      const v = allVariants.find(av => av.id === val);
      items[itemIdx] = { 
        ...items[itemIdx], 
        variantId: val,
        price: v ? Number(v.price) || 0 : items[itemIdx].price
      };
    } else {
      items[itemIdx] = { ...items[itemIdx], [field]: val } as any;
    }
    
    updated[orderIdx] = { ...updated[orderIdx], items };
    setExtractedOrders(updated);
  };

  const addItemToOrder = (orderIdx: number) => {
    const updated = [...extractedOrders];
    updated[orderIdx].items.push({
      rawProductName: "منتج يدوي",
      variantId: "",
      quantity: 1,
      price: 0
    });
    setExtractedOrders(updated);
  };

  const removeItemFromOrder = (orderIdx: number, itemIdx: number) => {
    const updated = [...extractedOrders];
    updated[orderIdx].items = updated[orderIdx].items.filter((_, idx) => idx !== itemIdx);
    setExtractedOrders(updated);
  };

  const removeOrder = (orderIdx: number) => {
    setExtractedOrders(extractedOrders.filter((_, idx) => idx !== orderIdx));
  };

  const unmatchedOrders = extractedOrders.filter(order => 
    order.items.some(item => !item.variantId)
  );

  const handleDownloadUnmatched = () => {
    if (unmatchedOrders.length === 0) return;
    
    const dataRows = [];
    for (const order of unmatchedOrders) {
      for (const item of order.items) {
        if (!item.variantId) {
          dataRows.push({
            "اسم العميل": order.customerName,
            "رقم الهاتف": order.customerPhone,
            "المحافظة": order.customerCity,
            "العنوان التفصيلي": order.customerAddress,
            "المنتج المطلوب (الغير مطابق)": item.rawProductName,
            "الكمية": item.quantity,
            "السعر": item.price,
            "مصاريف الشحن": order.shippingFee,
            "ملاحظات": order.notes
          });
        }
      }
    }
    
    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "طلبات غير مطابقة");
    XLSX.writeFile(workbook, `طلبات_غير_مطابقة_بالمخزن_${new Date().getTime()}.xlsx`);
    toast.success("تم تحميل ملف الطلبات غير المطابقة بنجاح");
  };

  // Save all confirmed orders to database
  const handleConfirmAndSave = async () => {
    if (extractedOrders.length === 0) {
      toast.error("لا توجد طلبات لحفظها!");
      return;
    }

    // Validate that all items have required customer name/phone and has at least one item
    for (let i = 0; i < extractedOrders.length; i++) {
      const order = extractedOrders[i];
      if (!order.customerName || !order.customerPhone) {
        toast.error(`يرجى استكمال اسم ورقم هاتف العميل للطلب رقم ${i + 1}`);
        return;
      }
      if (order.items.length === 0) {
        toast.error(`الطلب رقم ${i + 1} لا يحتوي على أي منتجات!`);
        return;
      }
    }

    setIsSaving(true);
    let successCount = 0;

    // Track running stock for each variant to properly assign shortages sequentially
    const runningStockMap: { [key: string]: number } = {};
    allVariants.forEach(v => {
      runningStockMap[v.id] = Number(v.stock_quantity) || 0;
    });

    try {
      for (const order of extractedOrders) {
        // 1. Create or Get Customer
        let customerId = null;
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", order.customerPhone.trim())
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          // Update details
          await supabase
            .from("customers")
            .update({
              name: order.customerName.trim(),
              city: order.customerCity.trim(),
              address: order.customerAddress.trim()
            })
            .eq("id", customerId);
        } else {
          const { data: newCustomer, error: custErr } = await supabase
            .from("customers")
            .insert({
              name: order.customerName.trim(),
              phone: order.customerPhone.trim(),
              city: order.customerCity.trim(),
              address: order.customerAddress.trim(),
              tenant_id: tenantId
            })
            .select("id")
            .single();
          
          if (custErr || !newCustomer) throw new Error(`فشل حفظ العميل: ${order.customerName}`);
          customerId = newCustomer.id;
        }

        // Determine if it has shortages (missing variant or quantity exceeds stock)
        let hasShortage = false;
        let notesText = order.notes ? order.notes.trim() : "";
        const itemsToInsert = [];
        
        for (const item of order.items) {
          if (!item.variantId) {
            hasShortage = true;
            const prefix = `[نواقص: منتج غير متوفر: ${item.rawProductName} - الكمية: ${item.quantity}]`;
            notesText = notesText ? `${notesText}\n${prefix}` : prefix;
          } else {
            const variant = allVariants.find(av => av.id === item.variantId);
            const stockQty = runningStockMap[item.variantId] !== undefined ? runningStockMap[item.variantId] : (variant ? Number(variant.stock_quantity) || 0 : 0);
            
            if (item.quantity > stockQty) {
              hasShortage = true;
              const prefix = `[نواقص: عجز كمية: ${variant?.productName} - ${variant?.variantName} (المطلوب: ${item.quantity}، المتاح: ${stockQty})]`;
              notesText = notesText ? `${notesText}\n${prefix}` : prefix;
            } else {
              runningStockMap[item.variantId] = Math.max(0, stockQty - item.quantity);
              itemsToInsert.push(item);
            }
          }
        }
        
        if (hasShortage) {
          const prefixBadge = "[نواقص]";
          if (!notesText.includes(prefixBadge)) {
            notesText = notesText ? `${prefixBadge}\n${notesText}` : prefixBadge;
          }
        }

        // Calculate order total
        const itemsTotal = order.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
        const finalTotal = itemsTotal + Number(order.shippingFee);

        // 2. Create Order
        const { data: newOrder, error: orderErr } = await supabase
          .from("orders")
          .insert({
            customer_id: customerId,
            total_amount: finalTotal,
            shipping_fee: Number(order.shippingFee) || 0,
            status: "pending",
            payment_status: "unpaid",
            source: "AI Extractor",
            tenant_id: tenantId,
            notes: notesText
          })
          .select("id")
          .single();

        if (orderErr || !newOrder) throw new Error(`فشل إنشاء الطلب للعميل: ${order.customerName}`);

        // 3. Create Order Items (only insert matched variants to avoid foreign key violations)
        for (const item of itemsToInsert) {
          const { error: itemErr } = await supabase
            .from("order_items")
            .insert({
              order_id: newOrder.id,
              product_variant_id: item.variantId,
              quantity: Number(item.quantity),
              unit_price: Number(item.price)
            });

          if (itemErr) throw itemErr;
        }

        successCount++;
      }

      toast.success(`تم حفظ عدد ${successCount} طلب(ات) بنجاح وتحديث المخزون!`);
      onSuccess();
      onOpenChange(false);
      // Reset
      setTextInput("");
      setExtractedOrders([]);
      setReviewMode(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`حدث خطأ أثناء الحفظ بعد إدراج ${successCount} طلب: ` + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl w-[95vw] max-h-[95vh] !p-6 overflow-y-auto flex flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" dir="rtl">
        <DialogHeader className="pb-3 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <DialogTitle className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
              <Brain className="w-6 h-6 text-indigo-600 animate-pulse" />
              <span>مساعد استيراد الطلبات بالذكاء الاصطناعي 🤖</span>
            </DialogTitle>
            <DialogDescription className="text-gray-500 mt-1 text-sm">
              قم بلصق محادثات واتساب/فيسبوك أو رفع ملف إكسيل مباشرة، وسيتكفل الذكاء الاصطناعي باستخراج بيانات العميل والمنتجات تلقائياً وتجهيز الطلب لتأكيده.
            </DialogDescription>
          </div>

          {reviewMode && !loading && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-start md:justify-end shrink-0" dir="rtl">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setReviewMode(false)}
                className="h-10 text-xs font-semibold"
              >
                الرجوع للتعديل والرفع
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => onOpenChange(false)} 
                disabled={isSaving}
                className="h-10 text-xs font-semibold"
              >
                إلغاء
              </Button>
              <Button 
                type="button" 
                disabled={isSaving || extractedOrders.length === 0}
                onClick={handleConfirmAndSave} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[130px] h-10 text-xs font-bold gap-1.5 shadow-sm"
              >
                {isSaving ? "جاري الحفظ..." : `تأكيد وإضافة ${formatOrderCountArabic(extractedOrders.length)}`}
              </Button>
            </div>
          )}
        </DialogHeader>

        {/* Gemini API Settings Collapsible Panel */}
        <div className="bg-gray-50 border rounded-lg p-3 space-y-3">
          <button 
            type="button" 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
          >
            <span className="flex items-center gap-1">
              <Settings className="w-3.5 h-3.5" />
              إعدادات محرك الذكاء الاصطناعي (Gemini Key)
            </span>
            <span>{showSettings ? "إخفاء ▲" : "إظهار ▼"}</span>
          </button>
          
          {showSettings && (
            <div className="pt-2 border-t flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1 space-y-1 w-full">
                <Label className="text-xs text-gray-500">مفتاح واجهة برمجة تطبيقات Flatkey API Key</Label>
                <Input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder="sk-..." 
                  className="h-9 font-mono text-sm bg-white"
                />
              </div>
              <div className="w-full md:w-56 space-y-1">
                <Label className="text-xs text-gray-500">النموذج المستخدم (Model)</Label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-white text-xs text-gray-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (سريع وموفر - موصى به)</option>
                  <option value="gpt-4o">gpt-4o (قوي جداً)</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo (كلاسيكي)</option>
                </select>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                <Button type="button" onClick={handleSaveApiKey} className="h-9 bg-gray-800 text-white hover:bg-gray-900 text-xs">
                  حفظ الإعدادات
                </Button>
                <a 
                  href="https://console.flatkey.ai/" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[10px] text-blue-600 hover:underline shrink-0 block"
                >
                  حساب Flatkey ↗
                </a>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          /* Loading State */
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="font-bold text-gray-800 text-lg">{loadingStep}</p>
            <p className="text-sm text-gray-500">يرجى الانتظار، هذه العملية قد تستغرق بضع ثوانٍ...</p>
          </div>
        ) : !reviewMode ? (
          /* Input State */
          <div className="space-y-5 my-3 flex-1 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Text Input Panel */}
              <div className="space-y-2 flex flex-col">
                <Label className="font-bold text-gray-800 flex items-center gap-1">
                  <Send className="w-4 h-4 text-indigo-500" />
                  لصق شات أو نص الطلبات
                </Label>
                <Textarea 
                  value={textInput} 
                  onChange={(e) => setTextInput(e.target.value)} 
                  placeholder="مثال للرسالة:
الاسم: محمود علي
موبايل: 01234567890
العنوان: 15 شارع الهرم، الجيزة
الطلبات: 
2 كوتشي أبيض مقاس 41 بسعر 300 جنيه للواحد
مصاريف الشحن: 50"
                  className="flex-1 min-h-[250px] text-sm bg-white leading-relaxed focus-visible:ring-indigo-500"
                />
                <Button 
                  type="button" 
                  disabled={!textInput.trim()}
                  onClick={() => extractWithAI(textInput)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-base font-bold gap-2 rounded-lg"
                >
                  <Brain className="w-5 h-5" />
                  تحليل واستخراج بالذكاء الاصطناعي 🪄
                </Button>
              </div>

              {/* Excel Upload Panel */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
                  <FileSpreadsheet className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-800 text-lg">استيراد من ملف إكسيل</h4>
                  <p className="text-sm text-gray-500 max-w-xs">
                    ارفع ملف الإكسيل الذي يحتوي على الطلبات، وسوف يتعرف الذكاء الاصطناعي على البيانات أياً كان ترتيب الأعمدة.
                  </p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleExcelUpload} 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 h-11 px-6 text-sm font-semibold rounded-lg"
                >
                  اختيار ملف إكسيل
                </Button>
                <div className="text-[10px] text-gray-400">
                  يدعم صيغ Excel (.xlsx, .xls) وصيغ (.csv)
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Review & Confirmation State */
          <div className="space-y-6 my-3 flex-1">
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3.5 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-indigo-600 shrink-0" />
              <div>
                <h4 className="font-bold text-indigo-900 text-sm">شاشة المراجعة والتأكيد المسبق للطلبات</h4>
                <p className="text-indigo-700 text-xs mt-0.5">
                  يرجى التأكد من مطابقة المنتجات المستخرجة (من القائمة المنسدلة) مع المخزون الفعلي ومراجعة الأسعار والعناوين قبل الحفظ النهائي.
                </p>
              </div>
            </div>

            {unmatchedOrders.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" dir="rtl">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-yellow-900 text-sm">تنبيه: {getUnmatchedOrdersText(unmatchedOrders.length)}</h4>
                    <p className="text-yellow-700 text-xs mt-0.5">
                      يجب تحديد المنتج الفعلي من القائمة لتلك الطلبات، أو يمكنك تحميلها كملف إكسيل للتعامل معها لاحقاً وحذفها من هنا لإتمام حفظ الطلبات السليمة.
                    </p>
                  </div>
                </div>
                <Button 
                  type="button" 
                  onClick={handleDownloadUnmatched}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold h-9 px-4 gap-1.5 shrink-0 rounded-md"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  تحميل الطلبات غير المطابقة (Excel)
                </Button>
              </div>
            )}

            {extractedOrders.length === 0 ? (
              <div className="text-center py-10 border rounded-xl bg-gray-50 space-y-3">
                <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto" />
                <p className="font-bold text-gray-700">لم يتم العثور على أي طلبات في النص المستخرج.</p>
                <Button type="button" onClick={() => setReviewMode(false)} variant="outline">
                  الرجوع والمحاولة مرة أخرى
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {extractedOrders.map((order, orderIdx) => (
                  <div key={orderIdx} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
                    
                    {/* Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                      <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-mono">
                          {orderIdx + 1}
                        </span>
                        طلب العميل: {order.customerName || "غير محدد"}
                      </span>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeOrder(orderIdx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 w-8 h-8 rounded-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Content Grid */}
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                      
                      {/* Customer Info Column (Left 1/3) */}
                      <div className="lg:col-span-1 bg-gray-50/50 p-3 rounded-lg border border-gray-100 space-y-3">
                        <h4 className="font-bold text-gray-800 border-b pb-1 text-xs">👤 بيانات العميل</h4>
                        
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-gray-500">الاسم بالكامل</Label>
                              <Input 
                                value={order.customerName} 
                                onChange={e => handleOrderChange(orderIdx, "customerName", e.target.value)}
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-gray-500">رقم الهاتف</Label>
                              <Input 
                                value={order.customerPhone} 
                                onChange={e => handleOrderChange(orderIdx, "customerPhone", e.target.value)}
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-gray-500">المحافظة / المدينة</Label>
                              <Input 
                                value={order.customerCity} 
                                onChange={e => handleOrderChange(orderIdx, "customerCity", e.target.value)}
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-gray-500">مصاريف الشحن</Label>
                              <Input 
                                type="number"
                                value={order.shippingFee} 
                                onChange={e => handleOrderChange(orderIdx, "shippingFee", parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] text-gray-500">العنوان التفصيلي</Label>
                            <Input 
                              value={order.customerAddress} 
                              onChange={e => handleOrderChange(orderIdx, "customerAddress", e.target.value)}
                              className="h-8 text-xs bg-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] text-gray-500">ملاحظات / تعليمات الشحن</Label>
                            <Input 
                              value={order.notes} 
                              onChange={e => handleOrderChange(orderIdx, "notes", e.target.value)}
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Products List Column (Right 2/3) */}
                      <div className="lg:col-span-2 space-y-3">
                        <h4 className="font-bold text-gray-800 border-b pb-1 text-xs">📦 المنتجات المطلوبة</h4>
                        
                        <div className="space-y-2">
                          {order.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-gray-50/50 p-2.5 rounded-lg border border-gray-100">
                              
                              {/* Raw Extracted Text */}
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] text-gray-400">النص المستخرج:</div>
                                <div className="text-xs font-semibold text-gray-700 truncate" title={item.rawProductName}>
                                  {item.rawProductName || "منتج غير مسمى"}
                                </div>
                              </div>

                              {/* Variant Match Selection Dropdown */}
                              <div className="w-full sm:w-[220px]">
                                <div className="text-[10px] text-gray-400">مطابقة مع منتجات المخزن:</div>
                                <select
                                  className={`h-8 w-full rounded-md border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white px-2 ${!item.variantId ? 'border-red-300 bg-red-50 text-red-700 font-bold' : 'border-gray-200'}`}
                                  value={item.variantId}
                                  onChange={e => handleItemChange(orderIdx, itemIdx, "variantId", e.target.value)}
                                >
                                  <option value="">-- اختر المنتج الفعلي --</option>
                                  {allVariants.map(v => (
                                    <option key={v.id} value={v.id}>
                                      {v.productName} - {v.variantName} (السعر: {v.price} | المتاح: {v.stock_quantity})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Price and Qty */}
                              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                <div className="w-16">
                                  <div className="text-[10px] text-gray-400">الكمية:</div>
                                  <Input 
                                    type="number" 
                                    min="1"
                                    value={item.quantity} 
                                    onChange={e => handleItemChange(orderIdx, itemIdx, "quantity", parseInt(e.target.value) || 1)}
                                    className="h-8 text-xs text-center bg-white"
                                  />
                                </div>
                                <div className="w-20">
                                  <div className="text-[10px] text-gray-400">السعر:</div>
                                  <Input 
                                    type="number" 
                                    min="0"
                                    value={item.price} 
                                    onChange={e => handleItemChange(orderIdx, itemIdx, "price", parseFloat(e.target.value) || 0)}
                                    className="h-8 text-xs text-center bg-white"
                                  />
                                </div>
                                
                                <div className="flex items-end justify-center pb-0.5">
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => removeItemFromOrder(orderIdx, itemIdx)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 w-8 h-8 rounded-full mt-4"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>

                            </div>
                          ))}
                        </div>
                        
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => addItemToOrder(orderIdx)}
                          className="w-full border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 h-8 text-xs gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          إضافة منتج آخر للطلب
                        </Button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 pt-3 border-t flex flex-col sm:flex-row gap-2 sm:justify-end shrink-0">
          {reviewMode && !loading && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setReviewMode(false)}
              className="h-10 text-sm font-semibold order-2 sm:order-none"
            >
              الرجوع للتعديل والرفع
            </Button>
          )}
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            disabled={isSaving}
            className="h-10 text-sm font-semibold"
          >
            إلغاء
          </Button>
          {reviewMode && !loading && (
            <Button 
              type="button" 
              disabled={isSaving || extractedOrders.length === 0}
              onClick={handleConfirmAndSave} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[150px] h-10 text-sm font-bold gap-2"
            >
              {isSaving ? "جاري الحفظ..." : `تأكيد وإضافة ${formatOrderCountArabic(extractedOrders.length)}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
