const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, details = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiRequest(path, { signal, method = 'GET', body, headers = {}, notifyUnauthorized = true } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include', headers: { Accept: 'application/json', ...headers }, signal, method,
      ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Không kết nối được máy chủ. Vui lòng thử lại.', 0)
  }
  let data
  try {
    data = await response.json()
  } catch {
    throw new ApiError('Máy chủ chưa sẵn sàng. Vui lòng thử lại sau.', response.status)
  }
  if (!response.ok) {
    if (response.status === 401 && notifyUnauthorized) window.dispatchEvent(new Event('auth:expired'))
    throw new ApiError(data.error?.message || 'Dịch vụ chưa sẵn sàng. Vui lòng thử lại sau.', response.status, data)
  }
  return data
}

export function apiGet(path, options) { return apiRequest(path, options) }

export async function apiPost(path, body) {
  return apiMutation(path, body, 'POST')
}

export async function apiMutation(path, body, method = 'PATCH') {
  const { csrfToken } = await apiGet('/auth/csrf/')
  const headers = { 'X-CSRFToken': csrfToken }
  if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  return apiRequest(path, { method, body, headers })
}
