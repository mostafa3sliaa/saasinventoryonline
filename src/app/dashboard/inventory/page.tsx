"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, User, TrendingDown, TrendingUp, Users, ArrowUpRight, ArrowDownRight, UserPlus, Wallet, Edit2, AlertTriangle, Package, ShoppingCart } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/components/shared/TenantProvider";

export default function InventoryPage() {
  const { tenant } = useTenant();
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [productsLimit, setProductsLimit] = useState(50);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [inventoryStats, setInventoryStats] = useState({
    totalBought: 0,
    totalReturned: 0,
  });

  const supabase = createClient();

  useEffect(() => {
    fetchProducts(productsLimit);
    fetchOrders();
    fetchInventoryStats();
  }, [productsLimit]);

  const fetchInventoryStats = async () => {
    const { data: purchases } = await supabase
      .from("purchases")
      .select("type, quantity");
      
    if (purchases) {
      let bought = 0;
      let returned = 0;
      purchases.forEach(p => {
        if (p.type === 'invoice') bought += Number(p.quantity || 0);
        if (p.type === 'return') returned += Number(p.quantity || 0);
      });
      setInventoryStats({ totalBought: bought, totalReturned: returned });
    }
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, status, notes")
      .eq("status", "pending")
      .eq("is_deleted", false);
    setOrders(data || []);
  };

  const fetchProducts = async (currentLimit = productsLimit) => {
    setLoading(true);
    // Fetch products along with their variants
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        product_variants (*)
      `)
      .order("name", { ascending: true })
      .limit(currentLimit);
      
    if (error) {
      toast.error("فشل في جلب المخزون");
    } else {
      setProducts(data || []);
      setHasMoreProducts((data?.length || 0) >= currentLimit);
    }
    setLoading(false);
  };

  // Precompute shortage stats once for ALL variants (instead of per-variant in render)
  const shortageMap = useMemo(() => {
    const map: Record<string, { ordersCount: number; deficitQty: number }> = {};
    
    orders.forEach(order => {
      const notes = order.notes || "";
      if (!notes.includes("[نواقص]")) return;

      const matchedKeys = new Set<string>();

      const oosRegex = /\[نواقص:\s*عجز كمية:\s*(.*?)\s*\((?:المطلب|المطلوب):\s*(\d+)\s*،\s*المتاح:\s*(\d+)\)\]/g;
      let oosMatch;
      while ((oosMatch = oosRegex.exec(notes)) !== null) {
        const fullName = oosMatch[1].trim();
        const reqQty = parseInt(oosMatch[2], 10) || 0;
        const availQty = parseInt(oosMatch[3], 10) || 0;
        const deficit = Math.max(0, reqQty - availQty);
        if (deficit > 0) {
          const key = fullName.toLowerCase();
          if (!map[key]) map[key] = { ordersCount: 0, deficitQty: 0 };
          map[key].deficitQty += deficit;
          matchedKeys.add(key);
        }
      }

      const unmatchedRegex = /\[نواقص:\s*منتج غير متوفر:\s*(.*?)\s*-\s*الكمية:\s*(\d+)\]/g;
      let match;
      while ((match = unmatchedRegex.exec(notes)) !== null) {
        const rawName = match[1].trim();
        const qty = parseInt(match[2], 10) || 0;
        if (qty > 0) {
          const key = rawName.toLowerCase();
          if (!map[key]) map[key] = { ordersCount: 0, deficitQty: 0 };
          map[key].deficitQty += qty;
          matchedKeys.add(key);
        }
      }

      matchedKeys.forEach(k => { map[k].ordersCount++; });
    });
    
    return map;
  }, [orders]);

  const getShortageStats = (variantProductName: string, variantNameStr: string) => {
    let ordersCount = 0;
    let deficitQty = 0;
    const pName = variantProductName.toLowerCase();
    const vName = variantNameStr.toLowerCase();
    
    for (const [key, value] of Object.entries(shortageMap)) {
      const isMatch = key.includes(pName) && 
                      (vName === "أساسي" || vName === "-" || key.includes(vName));
      if (isMatch) {
        ordersCount += value.ordersCount;
        deficitQty += value.deficitQty;
      }
    }
    return { ordersCount, deficitQty };
  };

  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    if (product.name?.toLowerCase().includes(query)) return true;
    if (product.category?.toLowerCase().includes(query)) return true;
    
    if (product.product_variants?.some((v: any) => 
      v.sku?.toLowerCase().includes(query) || 
      v.barcode?.toLowerCase().includes(query) ||
      v.size?.toLowerCase().includes(query) ||
      v.color?.toLowerCase().includes(query)
    )) {
      return true;
    }
    
    return false;
  });

  const getVariantSortWeight = (variantName: string) => {
    if (!variantName || variantName === "-" || variantName === "أساسي") return 0;
    const str = variantName.toLowerCase();

    // Ranked from largest/most specific down to smallest to prevent partial matches
    if (/6xl|6\s*x|6\s*اكس/.test(str)) return 10;
    if (/5xl|5\s*x|5\s*اكس/.test(str)) return 9;
    if (/4xl|xxxxl|4\s*x|4\s*اكس/.test(str)) return 8;
    if (/3xl|xxxl|3\s*x|3\s*اكس/.test(str)) return 7;
    if (/2xl|xxl|2\s*x|2\s*اكس/.test(str)) return 6;
    if (/xs|اكس\s*سمول|اكس\s*صغير/.test(str)) return 1;
    if (/\bxl\b|اكس\s*لارج|اكس/.test(str)) return 5;
    if (/\bl\b|large|لارج|كبير/.test(str)) return 4;
    if (/\bm\b|medium|ميديم|وسط/.test(str)) return 3;
    if (/\bs\b|small|سمول|صغير/.test(str)) return 2;

    const numMatch = str.match(/\d+/);
    if (numMatch) return 100 + parseInt(numMatch[0], 10);
    
    return 1000;
  };

  const groupedProducts = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredProducts.forEach(p => {
      const key = p.name.trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          id: p.id,
          name: p.name.trim(),
          category: p.category,
          product_variants: []
        };
      }
      if (p.product_variants) {
        groups[key].product_variants.push(...p.product_variants);
      }
    });

    Object.values(groups).forEach(g => {
      g.product_variants.sort((a: any, b: any) => {
        const nameA = [a.size, a.color].filter(c => c && c !== "-").join(" / ") || "أساسي";
        const nameB = [b.size, b.color].filter(c => c && c !== "-").join(" / ") || "أساسي";
        
        const weightA = getVariantSortWeight(nameA);
        const weightB = getVariantSortWeight(nameB);
        
        if (weightA !== weightB) {
          return weightA - weightB;
        }
        
        return nameA.localeCompare(nameB, 'ar');
      });
    });

    return Object.values(groups).sort((a: any, b: any) => a.name.localeCompare(b.name, 'ar'));
  }, [filteredProducts]);

  const totalInStock = useMemo(() => {
    let total = 0;
    products.forEach(p => {
      p.product_variants?.forEach((v: any) => {
        total += Number(v.stock_quantity || 0);
      });
    });
    return total;
  }, [products]);

  const totalSold = inventoryStats.totalBought - inventoryStats.totalReturned - totalInStock;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-gray-100 dark:border-white/[0.06] shadow-sm flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Package className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-400">متاح الآن</p>
          </div>
          <h3 className="text-3xl font-black text-gray-900 dark:text-white" dir="ltr">{totalInStock.toLocaleString()}</h3>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-gray-100 dark:border-white/[0.06] shadow-sm flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-400">المبيعات</p>
          </div>
          <h3 className="text-3xl font-black text-green-600 dark:text-green-400" dir="ltr">{totalSold > 0 ? totalSold.toLocaleString() : 0}</h3>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-gray-100 dark:border-white/[0.06] shadow-sm flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-400">المشتريات</p>
          </div>
          <h3 className="text-3xl font-black text-blue-600 dark:text-blue-400" dir="ltr">{inventoryStats.totalBought.toLocaleString()}</h3>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-gray-100 dark:border-white/[0.06] shadow-sm flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-400">المرتجعات</p>
          </div>
          <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400" dir="ltr">{inventoryStats.totalReturned.toLocaleString()}</h3>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">المخزون</h2>
          <p className="text-sm text-gray-500 mt-1">إدارة منتجاتك وكمياتها</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            type="text" 
            placeholder="ابحث باسم المنتج، الصنف، الباركود..." 
            className="pl-3 pr-9 h-10 w-full bg-white dark:bg-[#1E293B] rounded-lg border-gray-200 dark:border-white/[0.08] focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#1E293B] rounded-xl border border-gray-100 dark:border-white/[0.06] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right font-bold text-gray-900">المنتج</TableHead>
              <TableHead className="text-right font-bold text-gray-900">التنويعات (مقاس / لون)</TableHead>
              <TableHead className="text-center font-bold text-gray-900">إجمالي المخزون</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24 font-bold text-gray-500">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : groupedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24 font-bold text-gray-500">
                  {searchQuery ? "لم يتم العثور على منتجات مطابقة للبحث" : "لا يوجد منتجات في المخزون"}
                </TableCell>
              </TableRow>
            ) : (
              groupedProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-bold text-gray-900">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-gray-400" />
                      {product.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      {product.product_variants?.map((v: any, index: number, arr: any[]) => {
                        const baseline = Number(v.baseline_stock) || 1;
                        const ratio = Number(v.stock_quantity) / baseline;
                        const isLowStock = ratio <= 0.20;
                        const variantName = [v.size, v.color].filter(c => c && c !== "-").join(" / ") || "أساسي";
                        const isSingleVariant = arr.length === 1;
                        
                        let alertText = "منخفض";
                        if (ratio <= 0) alertText = "نفذ";
                        
                        const stats = getShortageStats(product.name, variantName);
                        
                        return (
                          <div key={v.id} className="flex flex-row items-center justify-between bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all w-full">
                            
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                                {variantName}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {(isLowStock || stats.deficitQty > 0) && (
                                <div className="flex items-center gap-1 pl-3 border-l border-gray-100 dark:border-white/[0.06]">
                                  {stats.deficitQty > 0 && (
                                    <Badge className="text-[10px] py-0 h-5 px-1.5 font-bold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 rounded-md">
                                      عجز: {stats.deficitQty}
                                    </Badge>
                                  )}
                                  {isLowStock && (
                                    <Badge variant="destructive" className="text-[10px] py-0 h-5 px-1.5 flex items-center gap-1 font-semibold bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 rounded-md">
                                      <AlertTriangle className="w-3 h-3" />
                                      {alertText}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-500">
                                  رصيد:
                                </span>
                                <span className={`text-sm font-black ${isLowStock ? "text-red-600" : "text-green-600"}`} dir="ltr">
                                  {v.stock_quantity}
                                </span>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-center text-xl text-gray-900">
                    {product.product_variants?.reduce((acc: number, curr: any) => acc + (curr.stock_quantity || 0), 0) || 0}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {hasMoreProducts && !searchQuery && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => setProductsLimit(prev => prev + 50)}
              disabled={loading}
              className="bg-white hover:bg-gray-50 text-indigo-600 border-indigo-200"
            >
              {loading ? "جاري التحميل..." : "تحميل المزيد من المنتجات"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
