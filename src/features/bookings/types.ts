/**
 * Runtime-типы для booking-эндпоинтов.
 *
 * Источник — реальные ответы /service-book/bookings/* (см. BACKEND_NOTES).
 * В schema.yml не описаны, поэтому fully manual.
 */

export type BookingStatus =
  | 'DRAFT'
  | 'CREATED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED_BY_CLIENT'
  | 'CANCELLED_BY_STAFF'
  | 'NO_SHOW'
  | string

export interface MoneyValue {
  amount: string | null
  currency: string
  display: string
}

export interface BookingCarRef {
  id: number
  title: string
  full_title: string
  license_plate: string
  nickname: string
  vin_code: string | null
}

export interface BookingPackageData {
  id: number
  title: string
  slug: string
  description: string
  short_description: string
  final_price: string
  price: MoneyValue
  has_promotion: boolean
}

/** Унифицированный объект услуги записи (service_data) — пакет ИЛИ дефолтная. */
export interface BookingServiceData {
  source_type?: 'service_package' | 'default_service_page' | string
  id?: number
  title?: string
  slug?: string
  price?: MoneyValue | null
}

/** Данные дефолтной услуги в записи (default_service_page_data). */
export interface BookingDefaultServiceData {
  id?: number
  title?: string
  slug?: string
  short_description?: string
  description?: string
  price_note?: string
  price?: MoneyValue | null
}

export interface BookingServiceStationData {
  id: number
  title: string
  name: string
  city: string
  address: string
  phone: string
  latitude: string
  longitude: string
}

export interface BookingPermissions {
  can_edit: boolean
  can_cancel: boolean
}

export interface BookingActions {
  detail_api: string
  edit_api: string
  list_api: string
  create_api: string
}

export interface Booking {
  id: number
  status: BookingStatus
  status_label: string
  preferred_datetime: string | null
  scheduled_datetime: string | null
  final_datetime: string | null
  /**
   * Конец визита и длительность услуги (бэк PR #11). Бэк считает их сам по
   * длительности категории. У записей, созданных до PR, — null.
   */
  scheduled_end_datetime?: string | null
  duration_minutes?: number | null
  price_snapshot: string | null
  currency: string
  price: MoneyValue
  service_package_title_snapshot: string
  car_title_snapshot: string
  license_plate_snapshot: string
  comment: string
  staff_comment: string
  cancel_reason: string
  current_mileage_km: number | null
  car: BookingCarRef
  /** Дискриминатор услуги: 'service_package' | 'default_service_page'. */
  service_source_type?: 'service_package' | 'default_service_page' | string
  /** Унифицированный объект услуги (есть и для пакета, и для дефолтной). */
  service_data?: BookingServiceData | null
  service_package_data?: BookingPackageData | null
  default_service_page_data?: BookingDefaultServiceData | null
  service_station_data?: BookingServiceStationData | null
  permissions: BookingPermissions
  actions: BookingActions
  created_at: string
  updated_at: string
}

export interface BookingsListResponse {
  count?: number
  next?: string | null
  previous?: string | null
  results: Booking[]
}

/** Query-параметры GET /service-book/bookings/ — все опциональные. */
export interface BookingsListQuery {
  car_id?: number
  status?: string
  period?: string
  limit?: number
  offset?: number
}

/**
 * Payload для POST /create_booking/ (сверено со свежей схемой
 * ClientServiceBookingCreateRequest).
 *
 * Услуга — РОВНО одна из двух: `service_package_id` (точный пакет) ИЛИ
 * `default_service_page_id` (дефолтная услуга). Бэк вернёт 400, если
 * передать оба или ни одного.
 */
export interface CreateBookingPayload {
  client_car_id: number
  service_package_id?: number
  default_service_page_id?: number
  preferred_datetime: string // ISO 8601
  client_comment?: string
  service_station_id?: number // филиал, опционально
  current_mileage_km?: number // текущий пробег, опционально
}

/** Payload для PATCH /bookings/{id}/. Все поля опциональные. */
export interface UpdateBookingPayload {
  preferred_datetime?: string
  comment?: string
  service_station_id?: number
}
