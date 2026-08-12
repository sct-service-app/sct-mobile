import { env } from '@/shared/config/env'

/**
 * Приводит медиа-URL от бэка к абсолютному.
 *
 * Бэк иногда отдаёт относительные пути (напр. `/media/cars/mark_logos/AUDI.png`).
 * RN <Image> с относительным uri не грузится. Достраиваем такие пути через
 * `API_BASE_URL`.
 *
 * Трогаем ТОЛЬКО пути бэкового медиа (`/media/...`). Абсолютные URL (http/https,
 * protocol-relative, data:) оставляем как есть.
 */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^(?:https?:)?\/\//i.test(url) || url.startsWith('data:')) return url
  if (url.startsWith('/media/')) {
    return env.API_BASE_URL.replace(/\/+$/, '') + url
  }
  return url
}
