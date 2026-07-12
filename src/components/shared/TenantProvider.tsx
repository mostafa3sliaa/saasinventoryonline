"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface Tenant {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  subscription_plan?: string;
  account_status?: string;
  trial_ends_at?: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  currentUser: any | null;
  loading: boolean;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  currentUser: null,
  loading: true,
  refreshTenant: async () => {},
});

export const useTenant = () => useContext(TenantContext);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadTenant = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      // Fetch user to get tenant_id, then fetch tenant
      const { data: userRecord } = await supabase
        .from("users")
        .select("*")
        .eq("id", userData.user.id)
        .single();

      if (userRecord) {
        setCurrentUser(userRecord);
      }

      if (userRecord?.tenant_id) {
        const { data: tenantRecord } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", userRecord.tenant_id)
          .single();

        if (tenantRecord) {
          setTenant(tenantRecord);
          
          // Dynamic white-labeling
          if (tenantRecord.primary_color) {
            document.documentElement.style.setProperty(
              "--primary",
              tenantRecord.primary_color
            );
          }
          if (tenantRecord.name) {
            document.title = `${tenantRecord.name} - نظام إدارة المخزون`;
          }
          if (tenantRecord.logo_url) {
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            link.href = tenantRecord.logo_url;
          }
        }
      }
    }
    setLoading(false);
  };
    
  useEffect(() => {
    loadTenant();
  }, [supabase]);

  const refreshTenant = async () => {
    await loadTenant();
  };

  return (
    <TenantContext.Provider value={{ tenant, currentUser, loading, refreshTenant }}>
      {children}
    </TenantContext.Provider>
  );
}
