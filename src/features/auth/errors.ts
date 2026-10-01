/**
 * Превращение axios-ошибки в человекочитаемый русский текст +
 * структурированный пробрасывание ошибок по полям формы.
 *
 * Контракт ответов DRF, которые мы поддерживаем:
 *   1. {"detail": "..."}              — общий месседж
 *   2. {"field": ["msg1", "msg2"]}    — ошибки по полям
 *   3. ["msg1"]                       — non_field_errors
 *   4. {"non_field_errors": ["..."]}  — non_field из DRF
 *
 * Сообщения от Django стандартными валидаторами приходят на английском.
 * Переводим самые частые — список держим открытым, дополняем по мере встречи.
 *
 * TODO в документацию проекта: попросить бэк включить django LOCALE_PATHS
 * + LANGUAGE_CODE = 'ru' — тогда стандартные сообщения сами станут на русском
 * и вся эта таблица будет не нужна.
 */
import { AxiosError } from 'axios'

// =====================================================================
// Перевод Django/DRF-сообщений → русский.
// Ключи — substring match (тригерит, если EN-текст содержит ключ).
// =====================================================================
type Translator = string | ((m: RegExpMatchArray) => string)
const TRANSLATIONS: Array<[RegExp | string, Translator]> = [
  // Пароль
  ['This password is too common.', 'Этот пароль слишком распространённый. Выберите более надёжный.'],
  ['This password is entirely numeric.', 'Пароль не может состоять только из цифр.'],
  [/^This password is too short/i, 'Пароль слишком короткий. Минимум 8 символов.'],
  [/password is too similar to/i, 'Пароль слишком похож на ваши личные данные.'],

  // Auth
  ['No active account found with the given credentials', 'Неверный телефон или пароль.'],
  ['Authentication credentials were not provided.', 'Требуется авторизация.'],
  ['Given token not valid for any token type', 'Сессия истекла, войдите снова.'],
  ['Token is invalid or expired', 'Сессия истекла, войдите снова.'],

  // Уникальные ограничения
  [/with this phone already exists/i, 'Клиент с этим телефоном уже зарегистрирован.'],
  [/with this email already exists/i, 'Клиент с этим email уже зарегистрирован.'],

  // Валидация полей
  ['This field may not be blank.', 'Это поле не может быть пустым.'],
  ['This field is required.', 'Это поле обязательно.'],
  ['Enter a valid phone number.', 'Введите корректный номер телефона.'],
  ['Enter a valid email address.', 'Введите корректный email.'],
  [/^Ensure this field has no more than (\d+) characters/i, (m) => `Не больше ${m[1]} символов.`],
  [/^Ensure this field has at least (\d+) characters/i, (m) => `Минимум ${m[1]} символов.`],
  // Числовые границы (DRF min_value / max_value) — напр. пробег: бэк требует >= 1.
  [/^Ensure this value is greater than or equal to (\d+)/i, (m) => `Значение должно быть не меньше ${m[1]}.`],
  [/^Ensure this value is less than or equal to (\d+)/i, (m) => `Значение должно быть не больше ${m[1]}.`],
  ['A valid integer is required.', 'Введите целое число.'],
]

export function translateApiMessage(msg: string): string {
  for (const [pattern, replacement] of TRANSLATIONS) {
    if (pattern instanceof RegExp) {
      const match = msg.match(pattern)
      if (match) {
        return typeof replacement === 'string' ? replacement : replacement(match)
      }
    } else if (msg.includes(pattern)) {
      // Совпадение по строке — для функционального replacement передаём пустой
      // массив с msg на нулевой позиции, чтобы интерфейс был единым.
      return typeof replacement === 'string'
        ? replacement
        : replacement([msg] as unknown as RegExpMatchArray)
    }
  }
  return msg
}

// =====================================================================
// Разбор ошибки в карту полей + общую строку.
// =====================================================================
export interface ParsedApiError {
  /** Общий месседж — показываем в красной плашке наверху формы. */
  general: string | null
  /** Ошибки по полям — отдаём в RHF setError(name, { message }). */
  fields: Record<string, string>
  /**
   * Машиночитаемый код из конверта бэка (`error.code`): `conflict`,
   * `validation_error`, `registration_verification_unavailable`…
   * По нему ветвим логику, не разбирая русский текст сообщения.
   */
  code: string | null
  /** HTTP-статус ответа — null, если ответа не было (сеть/таймаут). */
  status: number | null
  /**
   * Коды ошибок по полям. Бэк (с PR #11) шлёт по полю не только строку, но и
   * объект `{code, message}` — например
   * `preferred_datetime: {code: "BOOKING_SLOT_UNAVAILABLE", message: "…"}`.
   * Текст из `message` уходит в `fields`, код — сюда.
   */
  fieldCodes: Record<string, string>
}

/** Одно сообщение: строка или объект `{code, message}`. */
function messageOf(value: unknown): string | null {
  if (typeof value === 'string') return translateApiMessage(value)
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const msg = (value as Record<string, unknown>).message
    if (typeof msg === 'string' && msg) return translateApiMessage(msg)
  }
  return null
}

/** Значение поля ошибки: строка, объект `{code, message}` или массив из них. */
function joinList(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value.map(messageOf).filter((v): v is string => Boolean(v))
    return parts.length ? parts.join(' ') : null
  }
  return messageOf(value)
}

/** Машиночитаемый код из `{code, message}` (или первого такого в массиве). */
function codeOf(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const v of value) {
      const c = codeOf(v)
      if (c) return c
    }
    return null
  }
  if (value && typeof value === 'object') {
    const c = (value as Record<string, unknown>).code
    if (typeof c === 'string' && c) return c
  }
  return null
}

export function parseApiError(err: unknown, fallback: string): ParsedApiError {
  const fields: Record<string, string> = {}
  const fieldCodes: Record<string, string> = {}
  let general: string | null = null
  let code: string | null = null

  if (!(err instanceof AxiosError)) {
    return { general: fallback, fields, code: null, status: null, fieldCodes }
  }

  // Сетевые / таймаут / CORS — нет response.
  if (!err.response) {
    return {
      general: err.code === 'ECONNABORTED'
        ? 'Превышено время ожидания ответа сервера.'
        : 'Не удалось связаться с сервером. Проверьте интернет.',
      fields,
      code: null,
      status: null,
      fieldCodes,
    }
  }

  const status = err.response.status
  const data = err.response.data

  if (typeof data === 'string') {
    general = data
  } else if (Array.isArray(data)) {
    general = joinList(data) ?? fallback
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const envelope = obj.error

    if (envelope && typeof envelope === 'object' && !Array.isArray(envelope)) {
      // Новый единый обработчик ошибок бэка:
      //   { success:false, error:{ code, message, field, details } }
      // `message` часто — общая КАТЕГОРИЯ ошибки («Ошибка авторизации
      // клиента.», «Ошибка валидации.»), а конкретика лежит в
      // details.non_field_errors / details.detail. Раньше мы склеивали их
      // и получалось «Ошибка X. <настоящее сообщение>» — мусорный префикс.
      // Теперь: есть конкретное non_field/detail сообщение → показываем
      // только его; общий `message` держим как фолбэк, когда конкретики нет.
      const e = envelope as Record<string, unknown>
      if (typeof e.code === 'string') code = e.code
      const envelopeMessage =
        typeof e.message === 'string' ? translateApiMessage(e.message) : null

      const details = e.details
      const generalParts: string[] = []

      if (Array.isArray(details)) {
        const msg = joinList(details)
        if (msg) generalParts.push(msg)
      } else if (details && typeof details === 'object') {
        for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
          const fieldCode = codeOf(value)
          if (fieldCode) fieldCodes[key] = fieldCode
          const msg = joinList(value)
          if (!msg) continue
          if (key === 'non_field_errors' || key === 'detail') {
            generalParts.push(msg)
          } else {
            fields[key] = msg
          }
        }
      }

      general = generalParts.length ? generalParts.join(' ') : envelopeMessage
    } else {
      // Старый DRF-формат (немигрированные ручки / прочие API).
      if (typeof obj.detail === 'string') {
        general = translateApiMessage(obj.detail)
      }

      if (Array.isArray(obj.non_field_errors)) {
        const msg = joinList(obj.non_field_errors)
        if (msg) general = general ? `${general} ${msg}` : msg
      }

      for (const [key, value] of Object.entries(obj)) {
        if (key === 'detail' || key === 'non_field_errors') continue
        const fieldCode = codeOf(value)
        if (fieldCode) fieldCodes[key] = fieldCode
        const msg = joinList(value)
        if (msg) fields[key] = msg
      }
    }
  }

  if (!general && Object.keys(fields).length === 0) {
    general = status >= 500 ? 'Ошибка сервера. Попробуйте позже.' : fallback
  }

  return { general, fields, code, status, fieldCodes }
}

/**
 * Есть ли среди ошибки нужный код — в конверте (`error.code`) или по
 * любому полю (`preferred_datetime: {code, …}`). Где именно бэк положит код
 * брони, до конца не известно, поэтому смотрим везде.
 */
export function hasApiErrorCode(parsed: ParsedApiError, wanted: string): boolean {
  return parsed.code === wanted || Object.values(parsed.fieldCodes).includes(wanted)
}

/**
 * Совместимость со старым API — возвращает одну строку.
 * Использовать только там, где не нужны field-ошибки.
 */
export function extractApiError(err: unknown, fallback: string): string {
  const parsed = parseApiError(err, fallback)
  if (parsed.general) return parsed.general
  const firstField = Object.values(parsed.fields)[0]
  return firstField ?? fallback
}
