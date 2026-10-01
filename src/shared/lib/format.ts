/**
 * Форматирование значений для UI.
 */
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

/**
 * Бэк отдаёт денежные значения как строки в стиле DRF Decimal ("15400.00").
 * Парсим в число и форматируем как KZT для ru-RU.
 *
 * Пустые/невалидные значения превращаем в '—', чтобы не показывать клиенту
 * "NaN ₸".
 */
export function formatMoney(value: string | number | null | undefined, currency = 'KZT'): string {
  if (value === null || value === undefined || value === '') return '—'
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '—'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Форматирование пробега: 123456 → "123 456 км".
 */
export function formatMileage(km: number | null | undefined): string {
  if (km === null || km === undefined) return '—'
  return `${new Intl.NumberFormat('ru-RU').format(km)} км`
}

/**
 * Объём двигателя: бэк отдаёт целое в см³ (1984, 1986, 2000…). Делим на 1000
 * без округления до десятых (иначе 1984/1986/1994 сливаются в "2.0 L") и
 * убираем хвостовые нули: 1984 → "1.984 L", 2000 → "2 L".
 */
export function formatEngineVolume(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  // Бэк отдаёт объём либо строкой-литрами ('1.4'), либо числом в куб.см (1498),
  // либо уже числом-литрами (1.5). Нормализуем к числу и приводим к литрам.
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(n)) return null
  const liters = n >= 100 ? n / 1000 : n
  return `${liters.toFixed(1)} L`
}

/**
 * ISO дата → "12 Апр 2026".
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: ru })
  } catch {
    return '—'
  }
}

/**
 * ISO дата+время → "12 Апр, 14:30".
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'd MMM, HH:mm', { locale: ru })
  } catch {
    return '—'
  }
}

/**
 * Начало + конец визита → "12 Апр, 16:00–18:00". Конца нет (старые записи,
 * у них `scheduled_end_datetime` = null) или он кривой — "12 Апр, 16:00".
 */
export function formatDateTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const base = formatDateTime(start)
  if (!start || !end || base === '—') return base
  try {
    const s = parseISO(start)
    const e = parseISO(end)
    if (!(e.getTime() > s.getTime())) return base
    return `${base}–${format(e, 'HH:mm', { locale: ru })}`
  } catch {
    return base
  }
}

/** Длительность услуги: 30 → "30 мин", 120 → "2 ч", 90 → "1 ч 30 мин". */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return ''
  if (minutes < 60) return `${minutes} мин`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

/**
 * Маска госномера: убираем лишние пробелы, переводим в верхний регистр.
 * Сам ввод не блокируем (бэк сам валидирует по pattern), просто причёсываем.
 */
export function normalizeLicensePlate(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase()
}

/**
 * Маска телефона для отображения: +7 (XXX) XXX-XX-XX → +7 XXX XXX XX XX
 * НЕ конвертирует на лету при вводе — это задача input mask библиотеки.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== 11) return phone
  const [c, a, b, d, e] = [
    digits[0],
    digits.slice(1, 4),
    digits.slice(4, 7),
    digits.slice(7, 9),
    digits.slice(9, 11),
  ]
  return `+${c} ${a} ${b} ${d} ${e}`
}
