/**
 * Builds the correct URL for backend API calls.
 * - If VITE_BACKEND_URL is unset, returns a path like "/api/..." so Vite can proxy to the server in dev.
 * - If VITE_BACKEND_URL is set to "http://host:port" or "http://host:port/api", avoids duplicating "/api".
 */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const raw = import.meta.env.VITE_BACKEND_URL?.trim();
  if (!raw) {
    return p;
  }
  let base = raw.replace(/\/$/, "");
  if (base.endsWith("/api")) {
    base = base.slice(0, -4);
  }
  if (!base.startsWith("http")) {
    return p;
  }
  return `${base}${p}`;
}

/** Default Express URL in local dev (must match backend PORT, usually 5000). */
const DEFAULT_DEV_API_ORIGIN = "http://127.0.0.1:5000";

/**
 * Contact form POST URL — in Vite dev we call Express directly so the request is not dependent
 * on the Vite proxy (fixes "Route not found" when proxy/port/origin mismatches).
 */
export function getContactPostUrl() {
  const raw = import.meta.env.VITE_BACKEND_URL?.trim();
  if (raw) {
    return apiUrl("/api/contact");
  }
  if (import.meta.env.DEV) {
    return `${DEFAULT_DEV_API_ORIGIN}/api/contact`;
  }
  return "/api/contact";
}