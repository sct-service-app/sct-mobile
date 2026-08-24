/**
 * Runtime-типы для /service_stations/.
 *
 * Источник — реальный ответ от 2026-05-26. В schema.yml бэк ещё не описал
 * (см. BACKEND_NOTES). Опишу руками.
 */

export interface StationScheduleDay {
  date: string // YYYY-MM-DD
  weekday: number // 1..7
  weekday_label: string // "Понедельник"
  is_today: boolean
  is_closed: boolean
  opens_at: string // "09:00:00"
  closes_at: string // "19:00:00"
  appointments_count: number
  available: boolean
  label: string // "09:00–19:00" или "Выходной"
}

export interface ServiceStation {
  id: number
  name: string
  slug: string
  city: string
  address: string
  latitude: string | null
  longitude: string | null
  phone: string | null
  /** Фото филиала (media-URL бэка, приходит по http → чинит resolveMediaUrl). */
  photo: string | null
  /** Ссылка на филиал в 2ГИС. Может отсутствовать/быть пустой — тогда не показываем. */
  two_gis_url: string | null
  is_active: boolean
  schedule: StationScheduleDay[]
}

export interface ServiceStationsResponse {
  count: number
  days: number
  results: ServiceStation[]
}

export interface ServiceStationsQuery {
  days?: number // сколько дней расписания вернуть (default 7)
  city?: string
}
