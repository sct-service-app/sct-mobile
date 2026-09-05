/**
 * «Мой гараж» — список неактивных авто + кнопка «Добавить автомобиль».
 *
 * Переделан по правкам заказчика (видео 3):
 *   — вместо логотипов марок показываем ФОТО машин. Раньше фото брали через
 *     getCarPhoto из /garage/cars/, а там снимка нет, и функция падала на
 *     фолбэк mark.logo_url — отсюда и кружки BMW с VW. Настоящие фото лежат
 *     в service-book/page-data → cars[].image_url, оттуда и берём. Запрос уже
 *     в кэше обоих экранов, где живёт этот блок, лишней сети нет;
 *   — госномер в чёрной рамке, как в верхней плашке, и год выпуска под ним;
 *   — по клику на карточку открывается редактирование авто;
 *   — «Добавить автомобиль» — такая же кнопка, как «Сделать активным»
 *     (синий фон, белый текст, тонкая), только с плюсиком вместо галочки.
 */
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSetDefaultCarMutation } from '@/features/garage/queries'
import { useServiceBookQuery } from '@/features/service-book/queries'
import { PlateBadge } from '@/features/service-book/CarHeroCompact'
import { useCarYear } from '@/features/garage/carYear'
import { Card } from '@/shared/ui/Card'
import { SafeImage } from '@/shared/ui/SafeImage'
import { Skeleton } from '@/shared/ui/Skeleton'
import type { ServiceBookCar } from '@/features/service-book/types'

export function MyGarageColumn() {
  const router = useRouter()
  const { data, isLoading } = useServiceBookQuery({})
  const setDefault = useSetDefaultCarMutation()
  const others = (data?.cars ?? []).filter((c) => !c.is_default)

  return (
    <Card className="p-5">
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        className="text-[12px] uppercase tracking-widest text-textSecondary"
      >
        Мой гараж
      </Text>
      <View className="mt-5 gap-3">
        {isLoading ? (
          <>
            <Skeleton.Row />
            <Skeleton.Row />
          </>
        ) : (
          <>
            {others.map((car) => (
              <CarRow
                key={car.id}
                car={car}
                onOpen={() => router.push(`/garage/edit/${car.id}`)}
                onSetDefault={() => setDefault.mutate(car.id)}
                isPending={setDefault.isPending && setDefault.variables === car.id}
              />
            ))}
            <GarageButton
              icon="add"
              label="Добавить автомобиль"
              onPress={() => router.push('/garage/add')}
            />
          </>
        )}
      </View>
    </Card>
  )
}

function CarRow({
  car,
  onOpen,
  onSetDefault,
  isPending,
}: {
  car: ServiceBookCar
  onOpen: () => void
  onSetDefault: () => void
  isPending: boolean
}) {
  const year = useCarYear(car.id)
  const title = car.full_car_title || car.display_name || 'Автомобиль'

  return (
    <View className="rounded-sct border border-borderLight bg-white p-3">
      <Pressable onPress={onOpen} className="flex-row items-center gap-3 active:opacity-90">
        <View className="h-12 w-16 items-center justify-center overflow-hidden rounded-lg border border-borderLight bg-surfaceLight">
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
            numberOfLines={1}
            className="text-sm uppercase text-textPrimary"
          >
            {title}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-1.5">
            {car.license_plate ? <PlateBadge>{car.license_plate}</PlateBadge> : null}
            {year ? <PlateBadge>{String(year)}</PlateBadge> : null}
          </View>
        </View>
      </Pressable>

      <View className="mt-3">
        <GarageButton
          icon="checkmark"
          label={isPending ? 'Сохраняем…' : 'Сделать активным'}
          onPress={onSetDefault}
          disabled={isPending}
        />
      </View>
    </View>
  )
}

/**
 * Единая кнопка блока «Мой гараж»: синий фон, белая надпись, иконка слева.
 * «Сделать активным» и «Добавить автомобиль» отличаются только иконкой и
 * подписью — заказчик просил, чтобы они были «абсолютно одинаковые».
 */
function GarageButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center justify-center gap-1.5 rounded-sct bg-brandBlue px-3 py-2 active:opacity-90"
    >
      <Ionicons name={icon} size={12} color="#ffffff" />
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        className="text-[10px] uppercase tracking-widest text-white"
      >
        {label}
      </Text>
    </Pressable>
  )
}
