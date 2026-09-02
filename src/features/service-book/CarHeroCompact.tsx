/**
 * Плашка активного авто на вкладке «Авто».
 *
 * Переделана по правке заказчика: раньше это была высокая карточка с большим
 * квадратным фото и крупным заголовком. Просьба дословно — «верхний блок
 * должен быть точно такой же, как в услугах: тоненький, маленький,
 * аккуратненький, фотография машины, активное авто, госномер». Поэтому
 * повторяем геометрию features/packages/ActiveCarStrip.
 *
 * Справа — госномер в чёрной рамке, под ним год выпуска в такой же рамке
 * (тоже правка: год, который человек вводит в редактировании авто, должен
 * выводиться рядом с госномером).
 *
 * Вся карточка нажимается и ведёт в редактирование — заказчик просил
 * «редактирование по клику на авто, а не на карандашик». Карандаш убран.
 */
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Card } from '@/shared/ui/Card'
import { SafeImage } from '@/shared/ui/SafeImage'
import { useCarYear } from '@/features/garage/carYear'
import type { ServiceBookCar } from './types'

export function CarHeroCompact({ car }: { car: ServiceBookCar }) {
  const router = useRouter()
  // Год — через общий хук: page-data отдаёт production_year пустым, поэтому
  // введённое человеком значение берётся из гаража (см. useCarYear).
  const year = useCarYear(car.id)
  // Полное название модификации — как в плашке на «Услугах», которую заказчик
  // и просил повторить («BMW X7 I (G07) Рестайлинг Внедорожник…»). Год в
  // заголовок не дублируем: он рядом, в отдельной чёрной рамке.
  const title = (car.full_car_title || car.display_name).toUpperCase()

  return (
    <Pressable onPress={() => router.push(`/garage/edit/${car.id}`)} className="active:opacity-90">
      <Card className="flex-row items-center gap-4 p-4">
        <View className="h-14 w-20 items-center justify-center overflow-hidden rounded-sct border border-borderLight bg-surfaceLight">
          <SafeImage
            uri={car.image_url}
            resizeMode="cover"
            className="h-full w-full"
            fallback={
              <Text
                style={{ fontFamily: 'Inter_900Black' }}
                className="text-[10px] uppercase text-borderLight"
              >
                авто
              </Text>
            }
          />
        </View>

        <View className="min-w-0 flex-1">
          <Text
            style={{ fontFamily: 'Inter_900Black' }}
            className="text-[10px] uppercase tracking-widest text-brandBlue"
          >
            ● Активное авто
          </Text>
          <Text
            style={{ fontFamily: 'Inter_900Black' }}
            numberOfLines={2}
            className="mt-1 text-base uppercase leading-tight text-textPrimary"
          >
            {title}
          </Text>
        </View>

        <View className="items-end gap-1">
          {car.license_plate ? <PlateBadge>{car.license_plate}</PlateBadge> : null}
          {year ? <PlateBadge>{String(year)}</PlateBadge> : null}
        </View>
      </Card>
    </Pressable>
  )
}

/** Чёрная рамка под госномер и год — одна на оба, чтобы совпадали пиксель в пиксель. */
export function PlateBadge({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-md bg-textPrimary px-3 py-1">
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        className="text-[12px] uppercase tracking-widest text-white"
      >
        {children}
      </Text>
    </View>
  )
}
