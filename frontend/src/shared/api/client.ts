const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '')
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')
const CSRF_COOKIE = import.meta.env.VITE_CSRF_COOKIE_NAME || 'laporinaja_csrf'
const CSRF_HEADER = import.meta.env.VITE_CSRF_HEADER_NAME || 'X-CSRF-Token'
const CSRF_ENDPOINT = import.meta.env.VITE_CSRF_ENDPOINT ?? '/auth/csrf'
let csrfToken = ''

export type ApiErrorBody = { code?: string; message?: string; fields?: Record<string, string> }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message); this.name = 'ApiError' }
}

export type PageMeta = { page: number; limit: number; total: number }
export type ListPayload<T> = { data: T[]; meta: PageMeta; counts?: Record<string, number> }

function readableCookie(name: string) {
  if (!name || typeof document === 'undefined') return ''
  const prefix = `${encodeURIComponent(name)}=`
  return document.cookie.split('; ').find(part => part.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function isAuthBootstrapRequest(path: string) {
  return /^\/?auth\/(login|register|google)(?:[/?#]|$)/.test(path)
}

function isLogoutRequest(path: string) {
  return /^\/?auth\/logout(?:[/?#]|$)/.test(path)
}

function networkError() {
  return new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke layanan. Periksa koneksi Anda lalu coba lagi.')
}

/** Session is exclusively an HttpOnly server cookie. This client never stores session tokens. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const method = (init.method ?? 'GET').toUpperCase()
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (mutating && isAuthBootstrapRequest(path)) csrfToken = ''
  // Browser supplies Origin. If the API has a readable CSRF cookie, mirror its configured header.
  if (mutating && CSRF_ENDPOINT && !csrfToken && !readableCookie(CSRF_COOKIE) && !isAuthBootstrapRequest(path)) {
    try {
      const csrfResponse = await fetch(`${API_URL}${CSRF_ENDPOINT.startsWith('/') ? CSRF_ENDPOINT : `/${CSRF_ENDPOINT}`}`, { credentials: 'include' })
      if (csrfResponse.status !== 401) {
        const csrfPayload = await csrfResponse.json().catch(() => ({}))
        if (!csrfResponse.ok) {
          const error: ApiErrorBody = csrfPayload?.error ?? {}
          throw new ApiError(csrfResponse.status, error.code ?? 'REQUEST_FAILED', error.message ?? 'Permintaan belum berhasil. Coba lagi.', error.fields)
        }
        csrfToken = csrfPayload?.data?.csrfToken ?? csrfPayload?.csrfToken ?? ''
        if (!csrfToken) throw new ApiError(0, 'CSRF_TOKEN_MISSING', 'Token keamanan tidak tersedia. Muat ulang halaman lalu coba lagi.')
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw networkError()
    }
  }
  const csrf = mutating ? (csrfToken || readableCookie(CSRF_COOKIE)) : ''
  if (csrf) headers.set(CSRF_HEADER, decodeURIComponent(csrf))
  try {
    const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, { ...init, method, headers, credentials: 'include' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error: ApiErrorBody = payload?.error ?? {}
      throw new ApiError(response.status, error.code ?? 'REQUEST_FAILED', error.message ?? 'Permintaan belum berhasil. Coba lagi.', error.fields)
    }
    if (isLogoutRequest(path)) csrfToken = ''
    return payload as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw networkError()
  }
}

/** Returns `payload.data` from the API envelope. */
export async function apiData<T>(path: string, init: RequestInit = {}): Promise<T> {
  const payload = await api<{ data: T }>(path, init)
  return payload.data
}

/** Returns the full list envelope (`data`, `meta`, optional `counts`). */
export async function apiList<T>(path: string, init: RequestInit = {}): Promise<ListPayload<T>> {
  return api<ListPayload<T>>(path, init)
}

/** Downloads a file (used by the CSV export endpoint) and triggers the browser save dialog. */
export async function apiDownload(path: string, fallbackName: string, init: RequestInit = {}): Promise<void> {
  const headers = new Headers(init.headers)
  const csrf = readableCookie(CSRF_COOKIE)
  if (csrf) headers.set(CSRF_HEADER, decodeURIComponent(csrf))
  const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers, credentials: 'include' })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const error: ApiErrorBody = payload?.error ?? {}
    throw new ApiError(response.status, error.code ?? 'REQUEST_FAILED', error.message ?? 'Berkas tidak dapat diunduh.')
  }
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? fallbackName
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const apiBaseUrl = API_URL
export const apiOrigin = API_ORIGIN

/** Resolve a server media path (e.g. `/api/media/...`) into an absolute URL. */
export function mediaSrc(path?: string | null): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}
