/**
 * Карточка визита — RN-порт features/service-book/AppointmentRow.tsx.
 * highlighted/активный → тёмная navy-карточка; обычный/отменённый → светлая.
 * Дата через date-fns (Hermes Intl для дат ненадёжен). Press → /bookings/[id].
 */
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Card } from '@/shared/ui/Card'
import { cn } from '@/shared/lib/cn'
import type { Booking } from '@/features/bookings/types'
import { isBookingCancelled, visitTimeRange } from '@/features/bookings/lib'

function splitDateTime(iso: string | null, endIso: string | null) {
  if (!iso) return { time: '—', date: '—' }
  try {
    const d = parseISO(iso)
    // Конец визита есть только у записей после бэк PR #11: «16:00–18:00».
    const end = endIso ? parseISO(endIso) : null
    return {
      time: end && end.getTime() > d.getTime() ? `${format(d, 'HH:mm')}–${format(end, 'HH:mm')}` : format(d, 'HH:mm'),
      date: format(d, 'd MMMM, EEEEEE', { locale: ru }).toUpperCase(),
    }
  } catch {
    return { time: '—', date: '—' }
  }
}

export function AppointmentRow({
  appointment,
  highlighted,
}: {
  appointment: Booking
  highlighted?: boolean
}) {
  const router = useRouter()
  const { start, end } = visitTimeRange(appointment)
  const { time, date } = splitDateTime(start, end)
  const svc = appointment.service_data
  const isDefault = appointment.service_source_type === 'default_service_page'
  const title =
    svc?.title ||
    appointment.service_package_data?.title ||
    appointment.default_service_page_data?.title ||
    'Услуга'
  const typeLabel = isDefault ? 'Дефолтная услуга' : 'Точный пакет'
  const priceLabel = appointment.service_package_data?.price?.display || svc?.price?.display || ''
  const station = appointment.service_station_data?.address?.trim()
  const isHighlighted = highlighted
  const go = () => router.push(`/bookings/${appointment.id}`)

  if (isHighlighted) {
    return (
      <Pressable onPress={go}>
        <View className="overflow-hidden rounded-sct-lg bg-navy p-5">
          <View className="self-start rounded-md bg-brandBlue px-2.5 py-1">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-white">
              Ближайший визит
            </Text>
          </View>
          <View className="mt-3 flex-row items-baseline gap-3">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-3xl text-white">{time}</Text>
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-sm uppercase text-brandYellow">{date}</Text>
          </View>
          <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="mt-2 text-base uppercase text-white">
            {title}
          </Text>
          <Text style={{ fontFamily: 'Inter_700Bold' }} numberOfLines={1} className="mt-1 text-[11px] uppercase tracking-widest text-brandYellow">
            {typeLabel}{priceLabel ? ` · ${priceLabel}` : ''}
          </Text>
          {station ? (
            <Text numberOfLines={1} className="mt-0.5 text-[11px] uppercase tracking-widest text-white/50">{station}</Text>
          ) : null}
          <View className="mt-4 self-start rounded-sct bg-white px-5 py-2.5">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-textPrimary">Изменить</Text>
          </View>
        </View>
      </Pressable>
    )
  }

  const isCancelled = isBookingCancelled(appointment.status)

  return (
    <Pressable onPress={go}>
      <Card className={cn('p-4', isCancelled && 'bg-surfaceLight')}>
        <View className={cn('self-start rounded-md px-2.5 py-1', isCancelled ? 'bg-red-50' : 'bg-surfaceMuted')}>
          <Text
            style={{ fontFamily: 'Inter_900Black' }}
            className={cn('text-[10px] uppercase tracking-widest', isCancelled ? 'text-red-500' : 'text-textSecondary')}
          >
            {appointment.status_label || (isCancelled ? 'Отменено' : 'Запланировано')}
          </Text>
        </View>
        <View className="mt-2 flex-row items-baseline gap-3">
          <Text style={{ fontFamily: 'Inter_900Black' }} className={cn('text-2xl', isCancelled ? 'text-textSecondary' : 'text-textPrimary')}>
            {time}
          </Text>
          <Text style={{ fontFamily: 'Inter_900Black' }} className={cn('text-sm uppercase', isCancelled ? 'text-textSecondary' : 'text-brandBlue')}>
            {date}
          </Text>
        </View>
        <Text
          style={{ fontFamily: 'Inter_900Black' }}
          numberOfLines={1}
          className={cn('mt-2 text-sm uppercase', isCancelled ? 'text-textSecondary' : 'text-textPrimary')}
        >
          {title}
        </Text>
        <Text style={{ fontFamily: 'Inter_700Bold' }} numberOfLines={1} className="mt-1 text-[11px] uppercase tracking-widest text-textSecondary">
          {typeLabel}{priceLabel ? ` · ${priceLabel}` : ''}
        </Text>
        {station ? (
          <Text numberOfLines={1} className="mt-0.5 text-[11px] uppercase tracking-widest text-textSecondary">{station}</Text>
        ) : null}
      </Card>
    </Pressable>
  )
}
