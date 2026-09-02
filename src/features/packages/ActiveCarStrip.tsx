/**
 * Узкая плашка активного авто над списком услуг — RN-порт features/packages/
 * ActiveCarStrip.tsx.
 *
 * Фото: в `/packages/page/` его нет — ClientActiveCar отдаёт только id,
 * display_name, license_plate, car_title. Поэтому берём картинку из
 * `service-book/page-data/` (selected_car.image_url) и показываем её только
 * если это тот же автомобиль (сверяем id). Запрос уже в кэше — им же живёт
 * блок «Активное авто» на главной.
 */
import { Text, View } from 'react-native'
import { useServiceBookQuery } from '@/features/service-book/queries'
import { Card } from '@/shared/ui/Card'
import { SafeImage } from '@/shared/ui/SafeImage'
import { PlateBadge } from '@/features/service-book/CarHeroCompact'
import type { ClientActiveCar } from '@/shared/api/types'

export function ActiveCarStrip({ activeCar }: { activeCar: ClientActiveCar }) {
  const { data: book } = useServiceBookQuery({})
  const selected = book?.selected_car
  const sameCar = selected && selected.id === activeCar.id ? selected : null
  const photo = sameCar?.image_url ?? null
  const year = sameCar ? (sameCar.production_year ?? sameCar.generation?.year_from ?? null) : null

  return (
    <Card className="flex-row items-center gap-4 p-4">
      <View className="h-14 w-20 items-center justify-center overflow-hidden rounded-sct border border-borderLight bg-surfaceLight">
        <SafeImage
          uri={photo}
          resizeMode="cover"
          className="h-full w-full"
          fallback={
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase text-borderLight">
              авто
            </Text>
          }
        />
      </View>
      <View className="flex-1">
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-brandBlue">
          ● Активное авто
        </Text>
        <Text
          style={{ fontFamily: 'Inter_900Black' }}
          numberOfLines={2}
          className="mt-1 text-base uppercase leading-tight text-textPrimary"
        >
          Услуги для {activeCar.car_title}
        </Text>
      </View>
      {/* Госномер и год — те же рамки, что на «Авто». Год берём из того же
          selected_car: в ClientActiveCar его нет. */}
      <View className="items-end gap-1">
        {activeCar.license_plate ? <PlateBadge>{activeCar.license_plate}</PlateBadge> : null}
        {year ? <PlateBadge>{String(year)}</PlateBadge> : null}
      </View>
    </Card>
  )
}
