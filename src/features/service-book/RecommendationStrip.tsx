/**
 * Список рекомендаций сервиса — RN-порт features/service-book/RecommendationStrip.tsx.
 *
 * Бэк отдаёт набор в service_recommendations.recommendations[] — по объекту на
 * вид обслуживания (масло ДВС/АКПП, тормозная жидкость, антифриз…). Показываем
 * по срочности: сначала «уже пора» (is_due), затем по остатку пробега. Цвет и
 * подпись берём из category. Нет рекомендаций (клиент без истории) — не рендерим.
 */
import { Text, View } from 'react-native'
import { formatMileage } from '@/shared/lib/format'
import type { ServiceRecommendations } from './types'
import { sortRecommendationsByUrgency } from './recommendations'

export function RecommendationStrip({
  recommendations,
}: {
  recommendations: ServiceRecommendations | null | undefined
}) {
  const items = sortRecommendationsByUrgency(recommendations?.recommendations ?? [])
  if (items.length === 0) return null

  return (
    <View className="gap-3">
      {items.map((rec) => {
        const color = rec.category?.color || '#1F5FAF'
        return (
          <View
            key={rec.code}
            className="flex-row items-center justify-between gap-4 rounded-sct border border-l-4 border-borderLight bg-white px-5 py-4"
            style={{ borderLeftColor: color }}
          >
            <View className="flex-1">
              <Text style={{ fontFamily: 'Inter_900Black', color }} className="text-[10px] uppercase tracking-widest">
                {rec.is_due ? 'Пора обслужить' : 'Рекомендация сервиса'}
              </Text>
              <Text
                style={{ fontFamily: 'Inter_700Bold' }}
                numberOfLines={1}
                className="mt-0.5 text-[13px] uppercase tracking-tight text-textPrimary"
              >
                {rec.category?.name || rec.title}
              </Text>
              {rec.last_service?.mileage_km != null ? (
                <Text className="mt-0.5 text-[10px] text-textSecondary">
                  последняя замена — {formatMileage(rec.last_service.mileage_km)}
                </Text>
              ) : null}
            </View>
            <View className="items-end">
              {rec.next_service_mileage_km != null ? (
                <Text style={{ fontFamily: 'Inter_900Black', color }} className="text-xl">
                  {formatMileage(rec.next_service_mileage_km)}
                </Text>
              ) : null}
              {!rec.is_due && rec.remaining_mileage_km != null ? (
                <Text style={{ fontFamily: 'Inter_700Bold' }} className="mt-1 text-[10px] uppercase tracking-widest text-textSecondary">
                  осталось ~{formatMileage(rec.remaining_mileage_km)}
                </Text>
              ) : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}
