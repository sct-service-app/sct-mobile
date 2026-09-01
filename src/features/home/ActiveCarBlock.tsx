/**
 * Блок активного авто на дашборде — порт features/home/ActiveCarBlock.tsx.
 * По дизайну веба: фото авто с бэйджем «Активное авто», название, плашки
 * (Пробег / Замена масла / Ближайший визит), рекомендация и CTA «Записаться».
 * Источник — service-book/page-data (selected_car + рекомендация + визит).
 */
import { Text, View } from 'react-native'
import { useServiceBookQuery } from '@/features/service-book/queries'
import { findRecommendation, sortRecommendationsByUrgency } from '@/features/service-book/recommendations'
import { BookServiceCTA } from '@/features/service-book/BookServiceCTA'
import { Card } from '@/shared/ui/Card'
import { SafeImage } from '@/shared/ui/SafeImage'
import { Skeleton } from '@/shared/ui/Skeleton'
import { formatDateTime, formatMileage } from '@/shared/lib/format'

export function ActiveCarBlock() {
  const { data, isLoading } = useServiceBookQuery({ status: 'all', period: 'upcoming', limit: 1, offset: 0 })

  if (isLoading) return <Skeleton.Card className="h-72" />

  const car = data?.selected_car
  if (!car) return null

  const recs = data?.service_recommendations?.recommendations
  const engineOil = findRecommendation(recs, 'engine_oil')
  const topRec = sortRecommendationsByUrgency(recs ?? [])[0]
  const topRecMessage = topRec
    ? topRec.is_due
      ? `${topRec.title} — уже пора`
      : topRec.remaining_mileage_km != null
        ? `${topRec.title} — примерно через ${formatMileage(topRec.remaining_mileage_km)}`
        : topRec.title
    : null
  const next = data?.next_appointment
  const nextDt = next?.final_datetime ?? next?.scheduled_datetime ?? next?.preferred_datetime
  const title = car.full_car_title || car.display_name
  const hasMileage = typeof car.latest_mileage_km === 'number' && car.latest_mileage_km > 0

  return (
    <Card className="overflow-hidden p-0">
      {/* Фото авто с бэйджем «Активное авто» */}
      <View className="relative h-44 w-full bg-surfaceLight">
        <SafeImage
          uri={car.image_url}
          resizeMode="cover"
          className="h-44 w-full"
          fallback={
            <View className="h-44 w-full items-center justify-center">
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-4xl uppercase text-borderLight">
                {(title || 'АВ').slice(0, 2)}
              </Text>
            </View>
          }
        />
        <View className="absolute bottom-3 left-3 flex-row items-center gap-2 rounded-md bg-brandBlue px-2.5 py-1">
          <View className="h-1.5 w-1.5 rounded-full bg-brandYellow" />
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-white">
            Активное авто
          </Text>
        </View>
      </View>

      <View className="p-5">
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-lg uppercase text-textPrimary">
          {title}
        </Text>
        {car.license_plate ? (
          <View className="mt-2 self-start rounded bg-surfaceMuted px-2 py-1">
            <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-[10px] uppercase tracking-wide text-textSecondary">
              {car.license_plate}
            </Text>
          </View>
        ) : null}

        {/* Плашки: Пробег / Замена масла / Ближайший визит */}
        <View className="mt-4 flex-row gap-2">
          <SpecChip label="Пробег" value={hasMileage ? formatMileage(car.latest_mileage_km) : '—'} />
          <SpecChip
            label="Замена масла"
            value={engineOil?.next_service_mileage_km != null ? formatMileage(engineOil.next_service_mileage_km) : '—'}
          />
          <SpecChip label="Ближайший визит" value={nextDt ? formatDateTime(nextDt) : 'Нет'} accent={Boolean(nextDt)} />
        </View>

        {topRecMessage ? (
          <View className="mt-4 flex-row items-start gap-2 rounded-sct border-l-4 border-brandYellow bg-brandYellow/15 p-3">
            <Text className="text-base">⏳</Text>
            <Text style={{ fontFamily: 'Inter_700Bold' }} className="flex-1 text-[12px] uppercase text-textPrimary">
              {topRecMessage}
            </Text>
          </View>
        ) : null}

        {next ? (
          <View className="mt-3 rounded-sct border border-brandBlue/30 bg-blue-50 p-3">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-brandBlue">
              Ближайший визит
            </Text>
            <Text style={{ fontFamily: 'Inter_700Bold' }} className="mt-1 text-sm text-textPrimary">
              {next.service?.title ?? next.service_package?.title ?? 'Услуга'}
            </Text>
          </View>
        ) : null}

        {/* Та же кнопка, что на «Авто» — с иконкой календаря. Раньше здесь был
            обычный Button без иконки, и заказчик заметил разнобой между
            вкладками. Общий компонент, чтобы не разъезжались снова. */}
        <View className="mt-4">
          <BookServiceCTA />
        </View>
      </View>
    </Card>
  )
}

function SpecChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="flex-1 rounded-sct border border-borderLight bg-surfaceLight px-3 py-2.5">
      <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="text-[9px] uppercase tracking-widest text-textSecondary">
        {label}
      </Text>
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        numberOfLines={1}
        className={'mt-0.5 text-sm ' + (accent ? 'text-brandBlue' : 'text-textPrimary')}
      >
        {value}
      </Text>
    </View>
  )
}
