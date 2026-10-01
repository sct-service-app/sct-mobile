/**
 * Утилиты wizard'а записи на сервис (RN-порт features/booking-wizard/lib.ts).
 *
 * Два источника времени, переключаются флагом `useSlotsApiEnabled`:
 *  - НОВЫЙ (бэк PR #11): GET available-slots отдаёт только реально свободные
 *    старты с учётом длительности услуги и занятости боксов — `slotsFromApi`;
 *  - СТАРЫЙ: бэк отдаёт лишь часы работы (opens_at/closes_at) на день, и мы
 *    режем их по 30 минут сами — `buildTimeSlots`. Про занятость не знает.
 *    TODO: удалить вместе с флагом, когда PR #11 задеплоен на прод.
 *
 * Отличия от веба:
 *  - даты форматируем через date-fns + ru (как весь sct-mobile), чтобы не
 *    зависеть от наличия Intl-локалей в Hermes;
 *  - `localIso → UTC` собираем из компонентов даты — надёжнее строкового
 *    `new Date(str)` на Hermes.
 */
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { StationScheduleDay } from '@/features/service-stations/types'
import { hasApiErrorCode, type ParsedApiError } from '@/features/auth/errors'
import type { AvailableSlotsData } from './api'

export interface TimeSlot {
  /**
   * Что уходит в выбор и потом в `preferred_datetime`:
   *  - новый флоу — строка бэка как есть, со смещением (`2026-10-15T09:00:00+05:00`);
   *  - старый — локальное `YYYY-MM-DDTHH:mm`. В ISO обе переводит `slotToIso`.
   */
  value: string
  /** Лейбл для UI — `09:30` */
  label: string
  /** Час начала слота (для сегментации «утро/день/вечер») */
  hour: number
  /** Если слот в прошлом — блокируем (только старый флоу, для is_today) */
  inPast?: boolean
}

const SLOT_STEP_MIN = 30

/**
 * Слоты из ответа available-slots. Ничего не достраиваем и не фильтруем:
 * прошедшее время и занятые боксы бэк уже отсёк.
 *
 * Часы берём прямо из строки бэка (`…T09:30:00+05:00` → `09:30`), а не через
 * Date: это время филиала, оно не должно уехать из-за пояса телефона.
 */
export function slotsFromApi(data: AvailableSlotsData): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (const { datetime } of data.slots) {
    const m = /T(\d{2}):(\d{2})/.exec(datetime)
    if (!m) continue
    slots.push({ value: datetime, label: `${m[1]}:${m[2]}`, hour: Number(m[1]) })
  }
  return slots
}

/**
 * Строим временные слоты из расписания дня. Пустой массив для is_closed дней.
 * @param day          день из schedule филиала
 * @param firstAllowed самое раннее допустимое время (для is_today: now + 30 мин)
 */
export function buildTimeSlots(day: StationScheduleDay, firstAllowed?: Date): TimeSlot[] {
  if (day.is_closed || !day.available) return []
  const [openH, openM] = day.opens_at.split(':').map((s) => Number(s))
  const [closeH, closeM] = day.closes_at.split(':').map((s) => Number(s))
  const [year, month, dayNum] = day.date.split('-').map((s) => Number(s))

  const slots: TimeSlot[] = []
  let h = openH
  let m = openM
  while (h < closeH || (h === closeH && m <= closeM - SLOT_STEP_MIN)) {
    const slotDate = new Date(year, month - 1, dayNum, h, m)
    const value = `${year}-${pad(month)}-${pad(dayNum)}T${pad(h)}:${pad(m)}`
    const inPast = firstAllowed ? slotDate.getTime() < firstAllowed.getTime() : false
    slots.push({ value, label: `${pad(h)}:${pad(m)}`, hour: h, inPast })
    m += SLOT_STEP_MIN
    if (m >= 60) {
      m -= 60
      h += 1
    }
  }
  return slots
}

/** Разделяем слоты на «Утро / День / Вечер». */
export function groupSlotsByPeriod(slots: TimeSlot[]) {
  const morning = slots.filter((s) => s.hour < 12)
  const day = slots.filter((s) => s.hour >= 12 && s.hour < 18)
  const evening = slots.filter((s) => s.hour >= 18)
  return { morning, day, evening }
}

/**
 * Конвертирует «YYYY-MM-DDTHH:mm» (локальная TZ устройства) в ISO 8601 UTC,
 * который ждёт бэк. Собираем Date из компонентов — без зависимости от того,
 * как движок парсит строку без таймзоны.
 */
export function localIsoToUtcIso(localIso: string): string {
  const [datePart, timePart] = localIso.split('T')
  const [y, mo, d] = datePart.split('-').map((s) => Number(s))
  const [h, mi] = (timePart ?? '00:00').split(':').map((s) => Number(s))
  return new Date(y, mo - 1, d, h, mi).toISOString()
}

/**
 * Значение слота → ISO. Слот бэка уже со смещением — отдаём как есть;
 * старый локальный `YYYY-MM-DDTHH:mm` переводим в UTC. Через
 * `localIsoToUtcIso` строку бэка гнать нельзя: смещение потеряется.
 */
export function slotToIso(value: string): string {
  return /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : localIsoToUtcIso(value)
}

/** Лейбл дня для ленты: `{ weekday: 'ПН', date: '24 апр' }`. */
export function dayShortLabel(day: StationScheduleDay): { weekday: string; date: string } {
  const [y, m, d] = day.date.split('-').map((s) => Number(s))
  const dt = new Date(y, m - 1, d)
  const weekday = format(dt, 'EEEEEE', { locale: ru }).toUpperCase()
  const date = format(dt, 'd MMM', { locale: ru })
  return { weekday, date }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Отказ create_booking из-за занятости (бэк PR #11). Бэк повторно проверяет
 * время при POST: пока человек выбирал, слот мог занять другой клиент.
 *  - `slot_taken`  — времени больше нет: сбросить выбор и перезапросить слоты;
 *  - `day_closed`  — филиал в этот день не работает: выбрать другую дату;
 *  - `unavailable` — у филиала не настроены боксы/длительности.
 */
export type BookingConflict = 'slot_taken' | 'day_closed' | 'unavailable'

export function bookingConflict(parsed: ParsedApiError): { kind: BookingConflict; message: string } | null {
  if (hasApiErrorCode(parsed, 'BOOKING_SLOT_UNAVAILABLE')) {
    return {
      kind: 'slot_taken',
      message: 'Это время только что заняли. Выберите другое свободное время.',
    }
  }
  if (hasApiErrorCode(parsed, 'BOOKING_STATION_CLOSED')) {
    return {
      kind: 'day_closed',
      message: 'В этот день филиал не принимает записи. Выберите другую дату.',
    }
  }
  if (hasApiErrorCode(parsed, 'BOOKING_CONFIGURATION_ERROR')) {
    return {
      kind: 'unavailable',
      message: 'Онлайн-запись в этот филиал временно недоступна. Выберите другой филиал или позвоните нам.',
    }
  }
  return null
}
