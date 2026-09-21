import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/authStore";

const BASE_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

// The REFRESH token now lives only in an httpOnly cookie (bos_refresh) that JS
// cannot read — so an XSS can no longer steal a durable credential and keep a
// session alive forever. The short-lived ACCESS token is still mirrored in
// localStorage for now because several pages read it directly; moving that to a
// cookie too is a follow-up. `withCredentials` makes the browser send the
// cookies on every call.
// 30 s default (was 15 s): the backend is on Render's free tier, which cold-starts
// in 30–60 s after idling. 15 s meant the first request of the day always failed
// even though the server was on its way up. Individual calls that expect to hit a
// cold server (login, the login-page warm-up ping) pass a longer per-request
// `timeout` on top of this.
const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
  withCredentials: true,
});

// ── One-time migration off the localStorage refresh token ─────
// Pre-cookie sessions still have refreshToken in localStorage and no cookie.
// Redeem it once (body form, still accepted) so the server sets cookies, then
// delete it. After this, refresh is cookie-only.
let legacyMigration: Promise<void> | null = null;
function migrateLegacyRefreshToken(): Promise<void> {
  if (legacyMigration) return legacyMigration;
  const legacy = localStorage.getItem("refreshToken");
  if (!legacy) { legacyMigration = Promise.resolve(); return legacyMigration; }
  legacyMigration = axios
    .post(`${BASE_URL}/auth/refresh`, { refreshToken: legacy },
      { withCredentials: true, headers: { "X-Request-Timestamp": String(Date.now()) } })
    .then(({ data }) => {
      const at = data?.data?.accessToken;
      if (at) { localStorage.setItem("accessToken", at); useAuthStore.setState({ accessToken: at }); }
    })
    .catch(() => { /* dead token — next 401 sends the user to login */ })
    .finally(() => { localStorage.removeItem("refreshToken"); });
  return legacyMigration;
}

// ── Request interceptor — access token, org context, replay guard ─
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  await migrateLegacyRefreshToken();
  const token = localStorage.getItem("accessToken");
  const orgId = localStorage.getItem("activeOrgId");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (orgId) config.headers["x-organization-id"] = orgId;
  config.headers["x-request-timestamp"] = String(Date.now());
  return config;
});

// ── Response interceptor — auto refresh on 401 ────────────────
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];
function subscribeRefresh(cb: (token: string | null) => void) { refreshSubscribers.push(cb); }
function notifyRefresh(token: string | null) { refreshSubscribers.forEach((cb) => cb(token)); refreshSubscribers = []; }

// ── Cross-tab refresh coordination ──────────────────────────
// Refresh is single-use + rotated server-side, and replaying a rotated-away
// token now revokes the whole session family — so only one tab may redeem at a
// time. Others wait for the shared lock to clear, then retry (cookie is fresh).
const REFRESH_LOCK_KEY = "authRefreshLock";
const REFRESH_LOCK_TTL = 8000;

function acquireRefreshLock(): boolean {
  const existing = Number(localStorage.getItem(REFRESH_LOCK_KEY) || 0);
  if (existing && Date.now() - existing < REFRESH_LOCK_TTL) return false;
  localStorage.setItem(REFRESH_LOCK_KEY, String(Date.now()));
  return true;
}
function releaseRefreshLock() { localStorage.removeItem(REFRESH_LOCK_KEY); }

function waitForOtherTabRefresh(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("storage", onStorage);
      reject(new Error("Timed out waiting for another tab to refresh"));
    }, REFRESH_LOCK_TTL + 2000);
    function onStorage(e: StorageEvent) {
      if (e.key === "accessToken" && e.newValue) {
        clearTimeout(timer); window.removeEventListener("storage", onStorage); resolve(e.newValue);
      } else if (e.key === REFRESH_LOCK_KEY && e.newValue === null) {
        clearTimeout(timer); window.removeEventListener("storage", onStorage);
        resolve(localStorage.getItem("accessToken"));
      }
    }
    window.addEventListener("storage", onStorage);
  });
}

async function performRefresh(): Promise<string | null> {
  // Cookie carries the refresh token; body is empty. /auth/refresh is behind
  // replayGuard, hence the timestamp header.
  const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, {
    withCredentials: true,
    headers: { "X-Request-Timestamp": String(Date.now()) },
  });
  const at: string | null = data?.data?.accessToken ?? null;
  if (at) {
    localStorage.setItem("accessToken", at);
    useAuthStore.setState({ accessToken: at });
  }
  return at;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean; _dbRetry?: number }) | undefined;
    if (!original) return Promise.reject(error);

    if (error.response?.status === 503 && (error.response.data as { retryable?: boolean })?.retryable) {
      const retries = original._dbRetry ?? 0;
      if (retries < 3) {
        original._dbRetry = retries + 1;
        await new Promise((r) => setTimeout(r, 3000));
        return api(original);
      }
    }

    const isAuthRoute = original.url?.includes("/auth/login") || original.url?.includes("/auth/register")
      || original.url?.includes("/auth/forgot") || original.url?.includes("/auth/reset")
      || original.url?.includes("/auth/refresh");
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => subscribeRefresh((token) => {
          if (token) { original.headers.Authorization = `Bearer ${token}`; resolve(api(original)); }
          else reject(error);
        }));
      }

      if (!acquireRefreshLock()) {
        try {
          const token = await waitForOtherTabRefresh();
          if (token) original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        } catch {
          hardLogout(); return Promise.reject(error);
        }
      }

      isRefreshing = true;
      try {
        const token = await performRefresh();
        notifyRefresh(token);
        if (token) original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        notifyRefresh(null);
        hardLogout();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
        releaseRefreshLock();
      }
    }
    return Promise.reject(error);
  }
);

function hardLogout() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("activeOrgId");
  localStorage.removeItem("authRefreshLock");
  localStorage.removeItem("businessos-auth");
  window.location.href = window.location.pathname.startsWith("/super-admin") ? "/super-admin/login" : "/login";
}

export default api;
