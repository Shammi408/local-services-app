// src/utils/api.js
// Robust API helper — avoids double /api segments and supports refresh cookie flow.

const RAW_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";
// remove any trailing slash for consistent joins
const CLEAN_BASE = RAW_BASE.replace(/\/+$/, "");
// If user provided a base that already includes /api, don't add another.
const API_BASE = CLEAN_BASE.endsWith("/api") ? CLEAN_BASE : CLEAN_BASE + "/api";

/** safe token reader */
function getToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

/** save token helper used by auth store if needed externally */
function setLocalToken(token) {
  try {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  } catch {}
}

/**
 * low-level request helper
 */
async function request(path, opts = {}, retry = true) {
  // if path is absolute (starts with http) use it as-is, otherwise join with API_BASE
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = { ...(opts.headers || {}) };

  // handle body encoding
  let body = opts.body;
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body,
    credentials: "include", // include cookies for refresh
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // On 401 try refresh once (POST /auth/refresh)
  if (res.status === 401 && retry) {
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      const refreshText = await refreshRes.text();
      let refreshData;
      try {
        refreshData = refreshText ? JSON.parse(refreshText) : null;
      } catch {
        refreshData = refreshText;
      }

      if (refreshRes.ok && refreshData?.accessToken) {
        setLocalToken(refreshData.accessToken);
        return request(path, opts, false);
      } else {
        setLocalToken(null);
        const err = {
          status: refreshRes.status,
          body: refreshData,
          message: refreshData?.error || refreshRes.statusText || "Refresh failed",
        };
        throw err;
      }
    } catch (refreshErr) {
      throw refreshErr;
    }
  }

  if (!res.ok) {
    const err = {
      status: res.status,
      body: data,
      message: data?.error || data?.message || res.statusText,
    };
    throw err;
  }

  return { status: res.status, body: data };
}

export default {
  get: (p) => request(p, { method: "GET" }),
  post: (p, b) => request(p, { method: "POST", body: b }),
  put: (p, b) => request(p, { method: "PUT", body: b }),
  patch: (p, b) => request(p, { method: "PATCH", body: b }),
  del: (p) => request(p, { method: "DELETE" }),
  raw: request,
  _setLocalToken: setLocalToken,
  _API_BASE: API_BASE, // export for debugging if needed
};
