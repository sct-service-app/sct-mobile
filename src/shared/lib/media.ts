import { env } from '@/shared/config/env'

/**
 * Приводит медиа-URL от бэка к виду, который реально грузится в RN <Image>.
 *
 * Две проблемы бэка, которые тут лечим:
 *  1. Относительные пути (напр. `/media/cars/mark_logos/AUDI.png`) — RN <Image>
 *     с относительным uri не грузится. Достраиваем через `API_BASE_URL`.
 *  2. Абсолютные ссылки бэк отдаёт по `http://` (cleartext), напр.
 *     `http://api.sct-service.kz/media/...`. Браузер сам апгрейдит http→https для
 *     картинок, поэтому на вебе всё ок. RN <Image> так не умеет, и cleartext-http
 *     блокируется на уровне ОС (iOS ATS / Android network security) → битые
 *     картинки. Поэтому принудительно апгрейдим http→https.
 *
 * `data:` и локальный dev-хост (localhost / LAN по http) оставляем как есть.
 */

// http-хосты локальной разработки, которые НЕ апгрейдим до https (там https нет).
const LOCAL_HTTP_HOST =
  /^http:\/\/(localhost|127\.0\.0\.1|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i

export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('data:')) return url

  // Абсолютный https — как есть.
  if (/^https:\/\//i.test(url)) return url

  // Абсолютный http — апгрейдим до https (кроме локального dev-хоста).
  if (/^http:\/\//i.test(url)) {
    return LOCAL_HTTP_HOST.test(url) ? url : url.replace(/^http:\/\//i, 'https://')
  }

  // Protocol-relative `//host/...` — тоже на https.
  if (url.startsWith('//')) return `https:${url}`

  // Относительный путь бэкового медиа — достраиваем через API base (он https).
  if (url.startsWith('/media/')) {
    return env.API_BASE_URL.replace(/\/+$/, '') + url
  }

  return url
}
