/**
 * HTTP-клиент для клиентского (не staff) API.
 *
 * Поведение:
 *  1. Базовый URL берём из env.
 *  2. Если в storage есть access token — добавляем Authorization: Bearer.
 *  3. На 401:
 *     - если у нас есть refresh token — пробуем обновить access,
 *       и единожды повторяем оригинальный запрос с новым токеном.
 *     - если refresh не сработал — чистим сессию и пробрасываем ошибку
 *       наверх (компонент должен сам решить, редиректить на login или нет).
 *
 * Чтобы избежать «гонки» при параллельных 401 (когда сразу 3 запроса
 * получают 401 одновременно), все рефреши группируем в один Promise через
 * `refreshPromise`. Стандартная техника для axios.
 */
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { env } from '@/shared/config/env'
import { tokenStorage } from './token-storage'
import { unwrapEnvelope } from './unwrap'
import type { TokenRefresh } from './types'

// Кастомное поле в config — пометить запрос, чтобы не пытаться его рефрешить
// бесконечно при повторной 401.
type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
  _skipAuth?: boolean
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh()
  if (!refresh) return null

  try {
    // Делаем рефреш напрямую через axios (не через http), чтобы не уйти в
    // рекурсию interceptor'ов.
    const response = await axios.post<TokenRefresh>(
      `${env.API_BASE_URL}/api/v1/client_endpoints/auth/refresh/`,
      { refresh },
      { headers: { 'Content-Type': 'application/json' } },
    )
    const refreshData = unwrapEnvelope(response.data) as
      | (TokenRefresh & { refresh?: string })
      | undefined
    const newAccess = refreshData?.access
    if (typeof newAccess === 'string' && newAccess) {
      // Если бэк включит ROTATE_REFRESH_TOKENS, в ответе приедет и новый
      // refresh, а старый попадёт в блэклист. Сегодня ротации нет (сверено
      // на проде 2026-09-02: ответ содержит только `access`), но сохраняем
      // новый токен на будущее — иначе в день включения ротации у всех
      // пользователей начнёт выкидывать на экран входа после первого же
      // обновления, и причину будем искать заново.
      const rotated = refreshData?.refresh
      if (typeof rotated === 'string' && rotated) {
        tokenStorage.setTokens(newAccess, rotated)
      } else {
        tokenStorage.setAccess(newAccess)
      }
      return newAccess
    }
    return null
  } catch {
    return null
  }
}

export const http: AxiosInstance = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const cfg = config as RetryableConfig
  if (cfg._skipAuth) return cfg
  const access = tokenStorage.getAccess()
  if (access) {
    cfg.headers.set('Authorization', `Bearer ${access}`)
  }
  return cfg
})

http.interceptors.response.use(
  (response) => {
    // Разворачиваем единый конверт бэка { success, data } → data.
    response.data = unwrapEnvelope(response.data)
    return response
  },
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined
    const status = error.response?.status

    // Если это не 401, либо у нас нет config'а, либо уже retried — пробрасываем.
    if (status !== 401 || !original || original._retry || original._skipAuth) {
      return Promise.reject(error)
    }

    original._retry = true

    // Объединяем параллельные 401 в один refresh-запрос.
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }

    const newAccess = await refreshPromise

    if (!newAccess) {
      tokenStorage.clear()
      return Promise.reject(error)
    }

    original.headers.set('Authorization', `Bearer ${newAccess}`)
    return http.request(original)
  },
)

/**
 * Используй для запросов БЕЗ авторизации (login, register).
 * Префиксуй с осторожностью — Authorization header не добавится автоматом.
 */
export function noAuth<T = unknown>(config: AxiosRequestConfig) {
  return http.request<T>({ ...config, _skipAuth: true } as AxiosRequestConfig)
}
