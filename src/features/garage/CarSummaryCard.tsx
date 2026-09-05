/**
 * Карточка-сводка автомобиля на экране «Редактировать авто».
 *
 * Правка заказчика от 05.09: «перенести вот этот модуль с главной страницы —
 * без кнопки «Записаться на сервис» — чтобы просто вся информация была:
 * большая фотография, BMW X7 I (G07) Рестайлинг Внедорожник…, номер, год,
 * пробег, замена масла, ближайший. Потому что сейчас в редактировать авто
 * информации практически никакой нет, кроме поля и удаления, а места много».
 *
 * Поэтому повторяем геометрию features/home/ActiveCarBlock, но без CTA и без
 * плашки-рекомендации: экран про редактирование, а не про запись.
 */
import { Text, View } from 'react-native'
import type { ClientGarageCar } from '@/shared/api/types'
import { Card } from '@/shared/ui/Card'
import { SafeImage } from '@/shared/ui/SafeImage'
import { CarSpecChips } from '@/features/service-book/CarSpecChips'
import { PlateBadge } from '@/features/service-book/CarHeroCompact'
import { useCarPhoto } from '@/features/service-book/carPhoto'
import { getCarPhoto, getCarSubtitle, getCarTitle } from './lib'
import { useCarYear } from './carYear'

export function CarSummaryCard({ car }: { car: ClientGarageCar }) {
  // Фото и год — из тех же источников, что и на остальных экранах, чтобы
  // машина везде выглядела и называлась одинаково.
  const photo = useCarPhoto(car.id) ?? getCarPhoto(car)
  const year = useCarYear(car.id)
  const title = getCarTitle(car)
  const subtitle = getCarSubtitle(car)

  return (
    <Card className="overflow-hidden p-0">
      <View className="relative h-44 w-full bg-surfaceLight">
        <SafeImage
          uri={photo}
          resizeMode="cover"
          className="h-44 w-full"
          fallback={
            <View className="h-44 w-full items-center justify-center">
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-4xl uppercase text-borderLight">
                {title.slice(0, 2)}
              </Text>
            </View>
          }
        />
        {car.is_default ? (
          <View className="absolute bottom-3 left-3 flex-row items-center gap-2 rounded-md bg-brandBlue px-2.5 py-1">
            <View className="h-1.5 w-1.5 rounded-full bg-brandYellow" />
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-white">
              Активное авто
            </Text>
          </View>
        ) : null}
      </View>

      <View className="p-5">
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-lg uppercase leading-tight text-textPrimary">
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{ fontFamily: 'Inter_700Bold' }}
            numberOfLines={1}
            className="mt-1 text-[12px] uppercase text-textSecondary"
          >
            {subtitle}
          </Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
          <PlateBadge>{car.license_plate || '—'}</PlateBadge>
          {year ? <PlateBadge>{String(year)}</PlateBadge> : null}
        </View>

        {car.vin_code ? (
          <Text className="mt-2 text-[10px] uppercase tracking-widest text-textSecondary">
            VIN: {car.vin_code}
          </Text>
        ) : null}

        {/* Пробег / Замена масла / Ближайший визит — тот же компонент, что на
            «Главной» и «Авто», только по этой машине, а не по активной. */}
        <View className="mt-4">
          <CarSpecChips carId={car.id} />
        </View>
      </View>
    </Card>
  )
}
