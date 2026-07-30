/**
 * Карточка обычной услуги (раздел «Все услуги») — RN-порт features/packages/
 * ServiceCard.tsx. Иконки SVG заменены на @expo/vector-icons. По нажатию ведёт
 * на детальную пакета (во вебе была модалка выбора пакета категории —
 * PackageOptionsModal; для мобайла упрощено до перехода на пакет).
 */
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { ClientServicePackage } from '@/shared/api/types'
import { formatMoney } from '@/shared/lib/format'
import { getPackageShortTitle } from './lib'

function categoryIcon(code?: string): keyof typeof Ionicons.glyphMap {
  // Пакет без категории (service_package из произвольных товаров/услуг)
  // приходит с category: null — иконку берём generic-шестерёнку.
  const c = (code ?? '').toLowerCase()
  if (c.includes('oil')) return 'water-outline'
  if (c.includes('brake')) return 'disc-outline'
  if (c.includes('tire') || c.includes('wheel')) return 'ellipse-outline'
  if (c.includes('diag')) return 'pulse-outline'
  if (c.includes('transmission')) return 'cog-outline'
  return 'construct-outline'
}

export function ServiceCard({ pkg }: { pkg: ClientServicePackage }) {
  const router = useRouter()
  const title = getPackageShortTitle(pkg)

  return (
    <View className="rounded-sct border border-borderLight bg-white p-5">
      <Pressable onPress={() => router.push(`/services/${pkg.id}`)}>
        <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
          <Ionicons name={categoryIcon(pkg.category?.code)} size={22} color="#1F5FAF" />
        </View>
        <Text
          style={{ fontFamily: 'Inter_900Black' }}
          numberOfLines={2}
          className="text-base uppercase leading-tight text-textPrimary"
        >
          {title}
        </Text>
        <View className="mt-4">
          <Text className="text-[9px] uppercase tracking-widest text-textSecondary">Ориентировочно</Text>
          <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-0.5 text-xl text-brandBlue">
            от {formatMoney(pkg.final_price, pkg.currency)}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push(`/services/${pkg.id}`)}
        className="mt-5 items-center rounded-sct bg-textPrimary px-4 py-3 active:opacity-90"
      >
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-white">
          Выбрать услугу
        </Text>
      </Pressable>
    </View>
  )
}
