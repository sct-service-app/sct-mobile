/**
 * Три плашки активного авто: Пробег / Замена масла / Ближайший визит.
 *
 * Вынесено в общий компонент по правке заказчика: раньше эти плашки жили
 * только внутри ActiveCarBlock на «Главной», и на вкладке «Авто» их не было —
 * «пусть он тоже просто будет». Теперь один компонент на обоих экранах, так
 * что разъехаться по вёрстке они больше не могут.
 *
 * Данные берём сами из service-book/page-data — запрос уже в кэше на обоих
 * экранах, лишнего обращения к сети не будет.
 */
import { Text, View } from 'react-native'
import { useServiceBookQuery } from './queries'
import { findRecommendation } from './recommendations'
import { formatDateTime, formatMileage } from '@/shared/lib/format'

export function CarSpecChips({ carId }: { carId?: number } = {}) {
  // Без carId — активное авто (главная, вкладка «Авто»). С carId — конкретная
  // машина: экран редактирования открывается и для неактивной, а рекомендации
  // и ближайший визит лежат в page-data только для выбранной, поэтому просим
  // бэк отдать книжку именно по ней.
  const { data } = useServiceBookQuery(carId ? { car_id: carId } : {})
  const car = data?.selected_car
  if (!car) return null

  const engineOil = findRecommendation(data?.service_recommendations?.recommendations, 'engine_oil')
  const next = data?.next_appointment
  const nextDt = next?.final_datetime ?? next?.scheduled_datetime ?? next?.preferred_datetime
  const hasMileage = typeof car.latest_mileage_km === 'number' && car.latest_mileage_km > 0

  return (
    <View className="flex-row gap-2">
      <SpecChip label="Пробег" value={hasMileage ? formatMileage(car.latest_mileage_km) : '—'} />
      <SpecChip
        label="Замена масла"
        value={
          engineOil?.next_service_mileage_km != null
            ? formatMileage(engineOil.next_service_mileage_km)
            : '—'
        }
      />
      <SpecChip
        label="Ближайший визит"
        value={nextDt ? formatDateTime(nextDt) : 'Нет'}
        accent={Boolean(nextDt)}
      />
    </View>
  )
}

function SpecChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="flex-1 rounded-sct border border-borderLight bg-surfaceLight px-3 py-2.5">
      {/* Две строки и фиксированная высота: «Ближайший визит» и «Замена
          масла» в одну строку не влезали и обрезались многоточием, а плашки
          из-за разной длины подписи вставали на разной высоте. */}
      <Text
        style={{ fontFamily: 'Inter_900Black', minHeight: 22 }}
        numberOfLines={2}
        className="text-[9px] uppercase leading-[11px] tracking-wide text-textSecondary"
      >
        {label}
      </Text>
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        numberOfLines={1}
        className={`mt-1 text-[13px] ${accent ? 'text-brandBlue' : 'text-textPrimary'}`}
      >
        {value}
      </Text>
    </View>
  )
}
