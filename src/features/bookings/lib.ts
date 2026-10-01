import type { Booking } from './types'

/**
 * Бэк не переводит запись в терминальный статус автоматически после
 * наступления даты визита (это делает сотрудник вручную) — поэтому
 * "предстоящий" визит определяем сами: активный статус И дата ещё не
 * прошла. Иначе просроченные, но не закрытые сотрудником записи
 * зависают в «ближайших визитах» навсегда.
 */
const ACTIVE_STATUSES = new Set(['DRAFT', 'CREATED', 'CONFIRMED', 'IN_PROGRESS'])

export function isBookingCancelled(status: string): boolean {
  return status === 'CANCELLED_BY_CLIENT' || status === 'CANCELLED_BY_STAFF'
}

function bookingDatetime(booking: Booking): string | null {
  return booking.final_datetime ?? booking.scheduled_datetime ?? booking.preferred_datetime
}

export function isUpcomingBooking(booking: Booking, now: Date = new Date()): boolean {
  if (!ACTIVE_STATUSES.has(booking.status)) return false
  const dt = bookingDatetime(booking)
  if (!dt) return true
  return new Date(dt).getTime() >= now.getTime()
}

function sortByDatetimeAsc(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    const da = bookingDatetime(a)
    const db = bookingDatetime(b)
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return new Date(da).getTime() - new Date(db).getTime()
  })
}

export interface SplitBookings {
  next: Booking | null
  upcoming: Booking[]
  history: Booking[]
}

/** Делит записи клиента на «ближайшую», «остальные предстоящие» и «журнал». */
export function splitBookings(bookings: Booking[], now: Date = new Date()): SplitBookings {
  const upcoming = sortByDatetimeAsc(bookings.filter((b) => isUpcomingBooking(b, now)))
  const history = bookings.filter((b) => !isUpcomingBooking(b, now))
  return { next: upcoming[0] ?? null, upcoming: upcoming.slice(1), history }
}

/** Поля времени, общие у записи (`Booking`) и визита из page-data (`Appointment`). */
interface VisitTimes {
  final_datetime: string | null
  scheduled_datetime: string | null
  preferred_datetime: string | null
  scheduled_end_datetime?: string | null
  duration_minutes?: number | null
}

/**
 * Начало и конец визита. Конец бэк отдаёт с PR #11 (`scheduled_end_datetime`),
 * у старых записей его нет — тогда `end` = null и показываем только начало.
 *
 * Конец посчитан от `scheduled_datetime`. Если сотрудник проставил другое
 * фактическое время (`final_datetime`), сдвигаем конец на длительность от
 * него, а без длительности конец не показываем вовсе — врать не будем.
 */
export function visitTimeRange(v: VisitTimes): { start: string | null; end: string | null } {
  const start = v.final_datetime ?? v.scheduled_datetime ?? v.preferred_datetime
  let end = v.scheduled_end_datetime ?? null
  if (start && end && v.scheduled_datetime && !sameInstant(start, v.scheduled_datetime)) {
    end = v.duration_minutes
      ? new Date(new Date(start).getTime() + v.duration_minutes * 60_000).toISOString()
      : null
  }
  return { start, end }
}

function sameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime()
}
