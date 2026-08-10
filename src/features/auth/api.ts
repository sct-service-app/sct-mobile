/**
 * API-функции для модуля авторизации клиента.
 * Тонкая обёртка над http: без бизнес-логики, только запросы.
 */
import { http, noAuth } from '@/shared/api/http'
import { endpoints } from '@/shared/api/endpoints'
import { tokenStorage } from '@/shared/api/token-storage'
import type {
  ClientLoginRequest,
  ClientProfile,
  ClientRegisterRequest,
  ClientTokenResponse,
} from '@/shared/api/types'

export async function loginClient(payload: ClientLoginRequest) {
  const response = await noAuth<ClientTokenResponse>({
    url: endpoints.clientLogin,
    method: 'POST',
    data: payload,
  })
  return response.data
}

/**
 * Ответ register/ теперь НЕ содержит JWT — только данные для экрана
 * подтверждения телефона. Токены приезжают позже, из register/verify/.
 */
export interface RegisterInitResponse {
  phone: string
  verification_required: boolean
  code_expires_in: number
  /** через сколько секунд можно будет отправить SMS повторно */
  resend_available_in: number
}

export async function registerClient(payload: ClientRegisterRequest) {
  const response = await noAuth<RegisterInitResponse>({
    url: endpoints.clientRegister,
    method: 'POST',
    data: payload,
  })
  return response.data
}

/**
 * Второй шаг регистрации: подтверждение телефона кодом из SMS.
 * Возвращает то, что раньше возвращал register/ — access, refresh, user.
 */
export async function verifyRegistration(payload: { phone: string; code: string }) {
  const response = await noAuth<ClientTokenResponse>({
    url: endpoints.clientRegisterVerify,
    method: 'POST',
    data: payload,
  })
  return response.data
}

/**
 * Повторная отправка SMS-кода. Бэк может вернуть новый `resend_available_in`
 * (для перезапуска таймера) — если нет, вызывающий код фолбэчит на дефолт.
 */
export async function resendRegistrationCode(payload: { phone: string }) {
  const response = await noAuth<{ resend_available_in?: number }>({
    url: endpoints.clientRegisterResend,
    method: 'POST',
    data: payload,
  })
  return response.data
}

export async function fetchClientProfile() {
  const response = await http.get<ClientProfile>(endpoints.clientProfile)
  return response.data
}

/**
 * Обновление профиля клиента. ВНИМАНИЕ: бэк сейчас отвечает 405 на PATCH
 * (BACKEND_NOTES §4.3) — форма готова, заработает после подключения ручки.
 * `phone` намеренно не отправляем: смена телефона требует SMS-подтверждения.
 */
export async function updateClientProfile(
  payload: Partial<{
    first_name: string
    last_name: string
    middle_name: string
    email: string | null
    date_of_birth: string | null
    password: string
  }>,
) {
  const response = await http.patch<ClientProfile>(endpoints.clientProfile, payload)
  return response.data
}

/**
 * Удаление аккаунта клиента (требование Google Play / App Store).
 * Бэк подтверждает пароль, отменяет активные записи, архивирует авто и
 * анонимизирует персональные данные. Тело: { password, confirmation:"DELETE",
 * refresh }. После успеха вызывающий код обязан разлогинить пользователя.
 */
export async function deleteClientAccount(password: string) {
  const response = await http.request<{ deleted?: boolean }>({
    url: endpoints.clientDeleteAccount,
    method: 'DELETE',
    data: { password, confirmation: 'DELETE', refresh: tokenStorage.getRefresh() },
  })
  return response.data
}
