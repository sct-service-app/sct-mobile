/**
 * «История обслуживания» — RN-порт features/service-book/HistorySection.tsx.
 * Пусто → плашка «История пуста». Дата через date-fns. Press → /bookings/[id].
 */
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '@/shared/ui/Card'
import { formatDate } from '@/shared/lib/format'
import type { Booking } from '@/features/bookings/types'

export function HistorySection({ history }: { history: Booking[] }) {
  const router = useRouter()

  if (history.length === 0) {
    return (
      <Card className="items-center border-2 border-dashed border-borderLight bg-surfaceLight p-10">
        {/* Порядок по правке заказчика: сначала надпись, потом кружок с
            иконкой по центру, затем пояснение. Раньше иконка была сверху. */}
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-xl uppercase text-textPrimary">
          История пуста
        </Text>
        <View className="my-4 h-16 w-16 items-center justify-center rounded-full bg-white">
          <Ionicons name="document-text-outline" size={28} color="#94A3B8" />
        </View>
        <Text className="text-center text-sm text-textSecondary">
          Здесь появится список выполненных работ после визита.
        </Text>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <View className="border-b border-borderLight px-5 py-4">
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-base uppercase text-textPrimary">
          История обслуживания
        </Text>
      </View>
      {history.map((visit) => {
        const iso = visit.final_datetime ?? visit.scheduled_datetime ?? visit.preferred_datetime ?? ''
        let day = '--'
        let month = ''
        if (iso) {
          try {
            const d = parseISO(iso)
            day = format(d, 'dd')
            month = format(d, 'MMM', { locale: ru }).replace('.', '')
          } catch {
            /* keep defaults */
          }
        }
        const station = visit.service_station_data?.address?.trim()
        const title =
          visit.service_data?.title ||
          visit.service_package_data?.title ||
          visit.default_service_page_data?.title ||
          'Услуга'

        return (
          <Pressable
            key={visit.id}
            onPress={() => router.push(`/bookings/${visit.id}`)}
            className="flex-row items-center gap-4 border-b border-borderLight px-5 py-4 active:opacity-90"
          >
            <View className="h-12 w-12 items-center justify-center rounded-xl border border-borderLight bg-surfaceLight">
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-sm text-textPrimary">{day}</Text>
              <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-[9px] uppercase text-textSecondary">{month}</Text>
            </View>
            <View className="flex-1">
              <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="text-sm uppercase text-textPrimary">
                {title}
              </Text>
              <Text numberOfLines={1} className="mt-0.5 text-[11px] uppercase tracking-widest text-textSecondary">
                {station || formatDate(iso)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D9DEE5" />
          </Pressable>
        )
      })}
    </Card>
  )
}
