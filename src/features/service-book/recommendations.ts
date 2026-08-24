import type { ServiceRecommendationItem } from './types'

/**
 * Сортировка рекомендаций по срочности: сначала те, что «уже пора» (is_due),
 * затем по возрастанию остатка пробега (меньше осталось — выше). Записи без
 * remaining_mileage_km уходят в конец. RN-порт features/service-book/recommendations.ts.
 */
export function sortRecommendationsByUrgency(
  items: ServiceRecommendationItem[],
): ServiceRecommendationItem[] {
  return [...items].sort((a, b) => {
    if (a.is_due !== b.is_due) return a.is_due ? -1 : 1
    const ra = a.remaining_mileage_km
    const rb = b.remaining_mileage_km
    if (ra == null && rb == null) return 0
    if (ra == null) return 1
    if (rb == null) return -1
    return ra - rb
  })
}

/** Находит рекомендацию по коду категории (engine_oil, brake_fluid, …). */
export function findRecommendation(
  items: ServiceRecommendationItem[] | undefined,
  code: string,
): ServiceRecommendationItem | undefined {
  return items?.find((r) => r.code === code)
}
