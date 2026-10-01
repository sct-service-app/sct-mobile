/**
 * Карточка дефолтной услуги («Услуги с индивидуальным расчётом») — RN-порт
 * features/packages/DefaultServiceCard.tsx. Точной цены нет → price_note,
 * кнопка «Рассчитать стоимость» ведёт на detail дефолтной услуги.
 */
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeImage } from '@/shared/ui/SafeImage'
import type { ClientDefaultServicePage } from './types'

export function DefaultServiceCard({ service }: { service: ClientDefaultServicePage }) {
  const router = useRouter()
  const note = service.price_note || 'Цена рассчитывается индивидуально'

  return (
    <Pressable
      onPress={() => router.push(`/services/default/${service.id}`)}
      className="rounded-sct border border-borderLight bg-white p-5 active:opacity-90"
    >
      {/* Картинка услуги с бэк PR #11; нет её — пустая строка, оставляем иконку. */}
      {service.image_url ? (
        <View
          style={{ aspectRatio: 2 }}
          className="mb-4 w-full items-center justify-center overflow-hidden rounded-xl bg-blue-50"
        >
          <SafeImage
            uri={service.image_url}
            resizeMode="contain"
            className="h-full w-full"
            fallback={<Ionicons name="calculator-outline" size={22} color="#1F5FAF" />}
          />
        </View>
      ) : (
        <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
          <Ionicons name="calculator-outline" size={22} color="#1F5FAF" />
        </View>
      )}
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        numberOfLines={2}
        className="text-base uppercase leading-tight text-textPrimary"
      >
        {service.title}
      </Text>
      {service.short_description ? (
        <Text numberOfLines={2} className="mt-2 text-[13px] text-textSecondary">
          {service.short_description}
        </Text>
      ) : null}
      <View className="mt-4">
        <Text className="text-[9px] uppercase tracking-widest text-textSecondary">Стоимость</Text>
        <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-0.5 text-sm text-brandBlue">
          {note}
        </Text>
      </View>
      <View className="mt-5 items-center rounded-sct bg-brandBlue px-4 py-3">
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-white">
          Рассчитать стоимость
        </Text>
      </View>
    </Pressable>
  )
}
