/**
 * Блок активного авто на дашборде — порт features/home/ActiveCarBlock.tsx.
 * По дизайну веба: фото авто с бэйджем «Активное авто», название, плашки
 * (Пробег / Замена масла / Ближайший визит), рекомендация и CTA «Записаться».
 * Источник — service-book/page-data (selected_car + рекомендация + визит).
 */
import { Text, View } from 'react-native'
import { useServiceBookQuery } from '@/features/service-book/queries'
import { sortRecommendationsByUrgency } from '@/features/service-book/recommendations'
import { CarSpecChips } from '@/features/service-book/CarSpecChips'
import { PlateBadge } from '@/features/service-book/CarHeroCompact'
import { BookServiceCTA } from '@/features/service-book/BookServiceCTA'
import { Card } from '@/shared/ui/Card'
import { SafeImage } from '@/shared/ui/SafeImage'
import { Skeleton } from '@/shared/ui/Skeleton'
import { formatMileage } from '@/shared/lib/format'

export function ActiveCarBlock() {
  const { data, isLoading } = useServiceBookQuery({ status: 'all', period: 'upcoming', limit: 1, offset: 0 })

  if (isLoading) return <Skeleton.Card className="h-72" />

  const car = data?.selected_car
  if (!car) return null

  const recs = data?.service_recommendations?.recommendations
  const topRec = sortRecommendationsByUrgency(recs ?? [])[0]
  const topRecMessage = topRec
    ? topRec.is_due
      ? `${topRec.title} — уже пора`
      : topRec.remaining_mileage_km != null
        ? `${topRec.title} — примерно через ${formatMileage(topRec.remaining_mileage_km)}`
        : topRec.title
    : null
  const next = data?.next_appointment
  const title = car.full_car_title || car.display_name
  const year = car.production_year ?? car.generation?.year_from ?? null

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
        {/* Те же чёрные рамки, что на вкладке «Авто» и в «Моём гараже» —
            раньше здесь была серая плашка без года, и блоки не совпадали. */}
        <View className="mt-2 flex-row items-center gap-1.5">
          {car.license_plate ? <PlateBadge>{car.license_plate}</PlateBadge> : null}
          {year ? <PlateBadge>{String(year)}</PlateBadge> : null}
        </View>

        {/* Плашки: Пробег / Замена масла / Ближайший визит — общий компонент,
            он же на вкладке «Авто», чтобы вёрстка не разъезжалась. */}
        <View className="mt-4">
          <CarSpecChips />
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

