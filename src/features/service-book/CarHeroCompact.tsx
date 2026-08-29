/**
 * Компактная hero-карточка активного авто — RN-порт features/service-book/
 * CarHeroCompact.tsx. Кнопка-карандаш ведёт на /garage/edit/[id].
 */
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '@/shared/ui/Card'
import { SafeImage } from '@/shared/ui/SafeImage'
import type { ServiceBookCar } from './types'

export function CarHeroCompact({ car }: { car: ServiceBookCar }) {
  const router = useRouter()
  // Год: сначала реальный год выпуска экземпляра, и только если его нет —
  // год начала поколения (это разные вещи, см. production_year в типах).
  const year = car.production_year ?? car.generation?.year_from ?? null
  const title = `${car.mark.display_name} ${car.model.name}${
    year ? ` ${year}` : ''
  }`.toUpperCase()

  return (
    <Card className="p-5">
      <View className="flex-row items-center gap-5">
        <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-sct border border-borderLight bg-surfaceLight">
          <SafeImage
            uri={car.image_url}
            resizeMode="cover"
            className="h-full w-full"
            fallback={
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl uppercase text-borderLight">
                {car.mark.name.slice(0, 2)}
              </Text>
            }
          />
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-1.5 self-start rounded-md bg-brandBlue px-2 py-0.5">
            <View className="h-1.5 w-1.5 rounded-full bg-brandYellow" />
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-white">
              Активное авто
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={2} className="mt-3 text-2xl uppercase leading-none text-textPrimary">
            {title}
          </Text>
          {car.license_plate ? (
            <View className="mt-3 self-start rounded-md bg-textPrimary px-3 py-1">
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[12px] uppercase tracking-widest text-white">
                {car.license_plate}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={() => router.push(`/garage/edit/${car.id}`)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full border border-borderLight"
        >
          <Ionicons name="pencil" size={15} color="#4B5968" />
        </Pressable>
      </View>
    </Card>
  )
}
