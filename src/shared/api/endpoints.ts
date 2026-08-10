/**
 * Единое место со всеми URL'ами клиентского API (перенос из sct-web,
 * staff_endpoints выкинуты — админки в мобильном приложении нет).
 *
 * Источник правды по контракту — sct-web (`features/*\/api.ts`, сверено
 * live-curl'ом), не только OpenAPI-схема. См. MOBILE_PORTING_GUIDE.md §10.
 */

export const endpoints = {
  // --- Клиент: авторизация ---
  clientLogin: '/api/v1/client_endpoints/auth/login/',
  clientRegister: '/api/v1/client_endpoints/auth/register/',
  // Регистрация двухэтапная: register → SMS → register/verify.
  clientRegisterVerify: '/api/v1/client_endpoints/auth/register/verify/',
  clientRegisterResend: '/api/v1/client_endpoints/auth/register/resend/',
  clientRefresh: '/api/v1/client_endpoints/auth/refresh/',
  clientProfile: '/api/v1/client_endpoints/auth/profile/',
  clientDeleteAccount: '/api/v1/client_endpoints/auth/delete-account/',

  // --- Клиент: восстановление пароля по SMS ---
  clientPasswordResetRequest: '/api/v1/client_endpoints/auth/password-reset/request/',
  clientPasswordResetConfirm: '/api/v1/client_endpoints/auth/password-reset/confirm/',

  // --- Клиент: гараж ---
  garageCars: '/api/v1/client_endpoints/garage/cars/',
  garageCar: (id: number) => `/api/v1/client_endpoints/garage/cars/${id}/`,
  garageCarSetDefault: (id: number) =>
    `/api/v1/client_endpoints/garage/cars/${id}/set-default/`,
  garageFormPageData: '/api/v1/client_endpoints/garage/form-page-data/',

  // --- Клиент: пакеты ---
  packages: '/api/v1/client_endpoints/packages/',
  package: (id: number) => `/api/v1/client_endpoints/packages/${id}/`,
  defaultService: (id: number) =>
    `/api/v1/client_endpoints/packages/default-services/${id}/`,

  // --- Клиент: сервисная книжка ---
  serviceBookPageData: '/api/v1/client_endpoints/service-book/page-data/',

  // --- Клиент: записи на сервис (booking) ---
  bookings: '/api/v1/client_endpoints/service-book/bookings/',
  booking: (id: number) => `/api/v1/client_endpoints/service-book/bookings/${id}/`,
  bookingCancel: (id: number) =>
    `/api/v1/client_endpoints/service-book/bookings/${id}/cancel/`,
  createBooking: '/api/v1/client_endpoints/service-book/create_booking/',

  // --- Клиент: филиалы (service stations) ---
  serviceStations: '/api/v1/client_endpoints/service_stations/',
  serviceStation: (id: number) =>
    `/api/v1/client_endpoints/service_stations/${id}/`,

  // --- Публичный конфигуратор авто (add_car / change) ---
  carsMarks: '/api/v1/cars/marks/',
  carsModels: '/api/v1/cars/models/',
  carsFilters: '/api/v1/cars/filters/',
  carsModifications: '/api/v1/cars/modifications/',
  carsTrims: '/api/v1/cars/trims/',
} as const
