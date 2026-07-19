"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getMyTenantData } from "@/app/actions/tenant";

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

  const loadTenant = async () => {
    try {
      // Use the Server Action to fetch data securely and bypass RLS constraints
      const data = await getMyTenantData();
      
      if (data.user) {
        setCurrentUser(data.user);
      }
      
      if (data.tenant) {
        setTenant(data.tenant);
        
        // Dynamic white-labeling
        if (data.tenant.primary_color) {
          document.documentElement.style.setProperty(
            "--primary",
            data.tenant.primary_color
          );
        }
        if (data.tenant.name) {
          document.title = `${data.tenant.name} - نظام إدارة المخزون`;
        }
        if (data.tenant.logo_url) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.tenant.logo_url;
        }
      }
    } catch (e) {
      console.error("Failed to load tenant data", e);
    } finally {
      setLoading(false);
    }
  };
    
  useEffect(() => {
    loadTenant();
  }, []);

  const refreshTenant = async () => {
    await loadTenant();
  };

  return (
    <TenantContext.Provider value={{ tenant, currentUser, loading, refreshTenant }}>
      {children}
    </TenantContext.Provider>
  );
}
