/**
 * Ссылка «Добавить в Google Календарь» (OTA-вариант, без нативного модуля).
 *
 * Открывает Google Calendar (приложение или браузер) с предзаполненным событием.
 * Работает на iOS и Android без билда. Нативное добавление прямо в системный
 * календарь (в т.ч. Apple Calendar) — это будущий билд с expo-calendar.
 */

/** ISO/Date → компактный UTC-формат Google Calendar: YYYYMMDDTHHMMSSZ. */
function toCalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export interface CalendarEvent {
  title: string
  /** ISO-строка начала (UTC или со смещением — оба ок). */
  startIso: string
  /** Длительность в минутах, по умолчанию 60. */
  durationMin?: number
  location?: string
  details?: string
}

export function buildGoogleCalendarUrl(ev: CalendarEvent): string {
  const start = new Date(ev.startIso)
  const end = new Date(start.getTime() + (ev.durationMin ?? 60) * 60_000)
  const parts = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(ev.title)}`,
    `dates=${toCalDate(start)}/${toCalDate(end)}`,
    ev.location ? `location=${encodeURIComponent(ev.location)}` : '',
    ev.details ? `details=${encodeURIComponent(ev.details)}` : '',
  ].filter(Boolean)
  return `https://calendar.google.com/calendar/render?${parts.join('&')}`
}
