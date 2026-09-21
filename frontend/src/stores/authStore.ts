import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "@/lib/api";
import type { User, AuthResponse, OrganizationSummary } from "@/types";

export interface EmployeeProfile {
  id: string;
  name: string;
  designation?: string;
  orgRole?: string;   // MANAGEMENT | HR | PROJECT_MANAGER | TEAM_LEAD | EMPLOYEE
  department?: string;
  employeeCode?: string;
  projectMembers?: Array<{ role: string; project: { id: string; name: string; status: string } }>;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  organizations: OrganizationSummary[];
  activeOrg: OrganizationSummary | null;
  isAuthenticated: boolean;
  moduleAccess: string[];
  isOrgAdmin: boolean;
  employeeProfile: EmployeeProfile | null;

  setAuth: (data: AuthResponse) => void;
  setActiveOrg: (org: OrganizationSummary) => void;
  addOrganization: (org: OrganizationSummary) => void;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  syncModulesFromOrg: () => void;
  loadModuleAccess: () => Promise<void>;
  setModuleAccess: (keys: string[], isAdmin: boolean) => void;
  updateActiveOrgModules: (enabledModules: string[]) => void;
  loadEmployeeProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      organizations: [],
      activeOrg: null,
      isAuthenticated: false,
      moduleAccess: [],
      isOrgAdmin: false,
      employeeProfile: null,

      setAuth: (data: AuthResponse) => {
        localStorage.setItem("accessToken", data.accessToken);
        // Refresh token is NOT stored in JS anymore — it lives only in the
        // httpOnly `bos_refresh` cookie the API set alongside this response.
        localStorage.removeItem("refreshToken");
        // Normalise: ensure every org has enabledModules array (legacy orgs may not)
        const orgs = data.organizations.map((o) => ({ ...o, enabledModules: o.enabledModules ?? [] }));
        const firstOrg = orgs[0] || null;
        if (firstOrg) localStorage.setItem("activeOrgId", firstOrg.id);
        // Seed moduleAccess immediately so sidebar shows correct modules even before
        // loadModuleAccess fires — avoids showing stale modules from a previous session.
        // Empty array falls through to getNavModules([]) = ALL_MODULES (correct fallback).
        const seedModules = firstOrg?.enabledModules ?? [];
        const seedAdmin = firstOrg?.role === "OWNER" || firstOrg?.role === "ADMIN";
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: null,
          organizations: orgs,
          activeOrg: firstOrg,
          isAuthenticated: true,
          moduleAccess: seedModules,
          isOrgAdmin: seedAdmin,
          employeeProfile: null, // always reset on login — prevents stale orgRole from previous session
        });
      },

      setActiveOrg: (org: OrganizationSummary) => {
        localStorage.setItem("activeOrgId", org.id);
        // Reset moduleAccess to the new org's modules immediately so the sidebar
        // never shows a previous org's modules while loadModuleAccess is in flight.
        set({
          activeOrg: org,
          moduleAccess: org.enabledModules ?? [],
          isOrgAdmin: org.role === "OWNER" || org.role === "ADMIN",
        });
      },

      addOrganization: (org: OrganizationSummary) => {
        localStorage.setItem("activeOrgId", org.id);
        set((state) => ({
          organizations: [...state.organizations, org],
          activeOrg: org,
          // Immediately reflect the new org's modules — don't wait for loadModuleAccess
          moduleAccess: org.enabledModules ?? [],
          isOrgAdmin: org.role === "OWNER" || org.role === "ADMIN",
        }));
      },

      logout: async () => {
        try {
          // The httpOnly bos_refresh cookie identifies the session to revoke;
          // no body needed. Legacy body kept harmless for the migration window.
          await api.post("/auth/logout", {});
        } catch { /* ignore */ }
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("activeOrgId");
        set({ user: null, accessToken: null, refreshToken: null, organizations: [], activeOrg: null, isAuthenticated: false, employeeProfile: null });
      },

      loadEmployeeProfile: async (): Promise<void> => {
        try {
          const { data } = await api.get("/hr/my-profile");
          set({ employeeProfile: (data.data as EmployeeProfile | null) ?? null });
        } catch {
          set({ employeeProfile: null });
        }
      },

      updateUser: (updates: Partial<User>) => {
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null }));
      },

      setModuleAccess: (keys: string[], isAdmin: boolean) => {
        set({ moduleAccess: keys, isOrgAdmin: isAdmin });
      },

      updateActiveOrgModules: (enabledModules: string[]) => {
        set((state) => {
          if (!state.activeOrg) return {};
          const updated = { ...state.activeOrg, enabledModules };
          return {
            activeOrg: updated,
            organizations: state.organizations.map((o) => o.id === updated.id ? updated : o),
            moduleAccess: enabledModules, // keep moduleAccess in sync so sidebar always reflects new modules
          };
        });
      },

      syncModulesFromOrg: () => {
        const { activeOrg, moduleAccess } = get();
        const orgModules = activeOrg?.enabledModules ?? [];
        if (orgModules.length > 0 &&
            JSON.stringify(moduleAccess) !== JSON.stringify(orgModules)) {
          set({ moduleAccess: orgModules });
        }
      },

      loadModuleAccess: async () => {
        try {
          const { data } = await api.get("/access/my-access");
          const moduleKeys: string[] = data.data.moduleKeys ?? [];
          const isAdmin: boolean = data.data.isAdmin ?? false;
          set((state) => {
            // For OWNER/ADMIN keep activeOrg.enabledModules in sync so admin pages see fresh data
            if (isAdmin && state.activeOrg) {
              const updated = { ...state.activeOrg, enabledModules: moduleKeys };
              return {
                moduleAccess: moduleKeys,
                isOrgAdmin: isAdmin,
                activeOrg: updated,
                organizations: state.organizations.map((o) => o.id === updated.id ? updated : o),
              };
            }
            return { moduleAccess: moduleKeys, isOrgAdmin: isAdmin };
          });
        } catch {
          // On transient failure fall back to activeOrg.enabledModules so sidebar is correct
          const { activeOrg } = get();
          if (activeOrg?.enabledModules?.length) {
            set({ moduleAccess: activeOrg.enabledModules });
          }
        }
        // Load employee profile so sidebar can show role-specific links (PM / TL)
        get().loadEmployeeProfile();
      },
    }),
    {
      name: "businessos-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        // refreshToken intentionally NOT persisted — it lives in an httpOnly cookie.
        organizations: state.organizations,
        activeOrg: state.activeOrg,
        isAuthenticated: state.isAuthenticated,
        moduleAccess: state.moduleAccess,
        isOrgAdmin: state.isOrgAdmin,
      }),
    }
  )
);
