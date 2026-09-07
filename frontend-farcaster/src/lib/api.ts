const LOCAL_API_URL = "http://localhost:3001";
const PRODUCTION_API_URL = "https://replate-backend61.vercel.app";

function normalizeBaseUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function getApiBaseUrl() {
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return LOCAL_API_URL;
  }

  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  return PRODUCTION_API_URL;
}

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
