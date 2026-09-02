/**
 * Утилиты для разбора ответа `ClientGarageCar`.
 *
 * Поле `car` бэк описал в schema как `additionalProperties: {}`. Это значит,
 * что точную форму OpenAPI не зафиксировал, но по примерам ответов там лежит
 * сводка о модификации: марка, модель, поколение, фото и т.д.
 *
 * Здесь — единственное место, где мы делаем безопасную «нашлёпку» над этим
 * нестрого типизированным объектом. Если бэк потом обогатит schema —
 * заменим any-индексацию на нормальный тип.
 */
import type { ClientGarageCar } from '@/shared/api/types'

type CarInfo = ClientGarageCar['car']

function readString(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const v = (obj as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : undefined
  }
  return undefined
}

function readNested(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key]
  }
  return undefined
}

export function getCarPhoto(car: ClientGarageCar): string | null {
  const c = car.car as CarInfo
  return (
    readString(c, 'photo_url') ??
    readString(c, 'image_url') ??
    readString(c, 'image') ??
    // Фолбэк на mark.logo_url убран: он и рисовал кружки BMW/VW вместо фото
    // машин, на что жаловался заказчик. Нет фото — показываем заглушку.
    null
  )
}

/**
 * Фактический год выпуска. Бэк отдаёт `production_year` во всех ручках гаража
 * (проверено на проде 2026-09-02), но в сгенерированной schema.ts поля нет —
 * она отстала. Читаем безопасно, как и остальные поля этого объекта.
 */
export function getCarProductionYear(car: ClientGarageCar): number | null {
  const v = (car as unknown as Record<string, unknown>).production_year
  return typeof v === 'number' ? v : null
}

export function getCarTitle(car: ClientGarageCar): string {
  return car.full_car_title || car.display_name || 'Автомобиль'
}

export function getCarSubtitle(car: ClientGarageCar): string {
  const c = car.car as CarInfo
  const parts: string[] = []
  const mark = readString(readNested(c, 'mark'), 'name')
  const model = readString(readNested(c, 'model'), 'name')
  const year = readString(c, 'year')
  const engine = readString(c, 'engine_short') ?? readString(c, 'engine')
  const transmission = readString(c, 'transmission_short') ?? readString(c, 'transmission')
  if (mark || model) parts.push([mark, model].filter(Boolean).join(' '))
  if (year) parts.push(`${year}`)
  if (engine) parts.push(engine)
  if (transmission) parts.push(transmission)
  return parts.join(' • ') || car.display_name || ''
}
