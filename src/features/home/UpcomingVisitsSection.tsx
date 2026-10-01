/**
 * «Предстоящие визиты» на дашборде — RN-порт features/home/
 * UpcomingVisitsSection.tsx. До 3 активных записей; пусто → не рендерим.
 *
 * Список берём из `/service-book/bookings/` (не из `page-data`, где
 * `appointments` сейчас всегда приходит пустым) и делим через
 * `splitBookings`, чтобы просроченные, но не закрытые сотрудником записи
 * не зависали в «ближайших» навсегда.
 */
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useBookingsQuery } from '@/features/bookings/queries'
import { splitBookings, visitTimeRange } from '@/features/bookings/lib'
import type { Booking } from '@/features/bookings/types'
import { Card } from '@/shared/ui/Card'
import { formatDateTimeRange } from '@/shared/lib/format'

export function UpcomingVisitsSection() {
  const router = useRouter()
  const { data } = useBookingsQuery({ status: 'all', period: 'all', limit: 20, offset: 0 })
  if (!data) return null

  const { next, upcoming } = splitBookings(data)
  const items = (next ? [next, ...upcoming] : upcoming).slice(0, 3)
  if (items.length === 0) return null

  return (
    <View className="gap-3">
      <View className="flex-row items-end justify-between">
        <View className="flex-1">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-xl uppercase text-textPrimary">
            Предстоящие визиты
          </Text>
          <Text className="mt-1 text-[12px] text-textSecondary">Ваши активные записи на обслуживание</Text>
        </View>
        <Pressable onPress={() => router.push('/service-book')}>
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-brandBlue">
            Записи →
          </Text>
        </Pressable>
      </View>

      {items.map((booking, idx) => (
        <VisitRow key={booking.id} booking={booking} highlighted={idx === 0} onPress={() => router.push(`/bookings/${booking.id}`)} />
      ))}
    </View>
  )
}

function VisitRow({
  booking,
  highlighted,
  onPress,
}: {
  booking: Booking
  highlighted: boolean
  onPress: () => void
}) {
  const { start, end } = visitTimeRange(booking)
  const title =
    booking.service_data?.title ||
    booking.service_package_data?.title ||
    booking.default_service_page_data?.title ||
    'Услуга'

  return (
    <Pressable onPress={onPress}>
      <Card className={`p-4 ${highlighted ? 'border-brandBlue/30 bg-blue-50' : ''}`}>
        {highlighted ? (
          <View className="mb-1 self-start rounded-md bg-brandBlue px-2 py-0.5">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[9px] uppercase tracking-widest text-white">
              Ближайший визит
            </Text>
          </View>
        ) : null}
        <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="text-base uppercase text-textPrimary">
          {title}
        </Text>
        <Text style={{ fontFamily: 'Inter_700Bold' }} className="mt-1 text-[11px] uppercase tracking-wide text-textSecondary">
          {formatDateTimeRange(start, end)}
          {booking.car?.title ? ` · ${booking.car.title}` : ''}
        </Text>
      </Card>
    </Pressable>
  )
}
