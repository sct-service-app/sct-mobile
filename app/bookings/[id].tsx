/**
 * Деталь записи на сервис — функциональный порт pages/BookingDetailPage.tsx.
 * Источник — useBookingQuery. Отмена — useCancelBookingMutation + нативный
 * Alert. Редактирование — EditBookingModal (филиал/дата-время/комментарий).
 */
import { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useBookingQuery, useCancelBookingMutation } from '@/features/bookings/queries'
import { EditBookingModal } from '@/features/bookings/EditBookingModal'
import { RequireAuth } from '@/shared/ui/RequireAuth'
import { Spinner } from '@/shared/ui/Spinner'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { BottomBar } from '@/shared/ui/BottomBar'
import { parseApiError } from '@/features/auth/errors'
import { formatDateTimeRange, formatDuration, formatMileage } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { isBookingCancelled, visitTimeRange } from '@/features/bookings/lib'

export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = params.id ? Number(params.id) : undefined
  return (
    <RequireAuth>
      <BookingInner id={id} />
    </RequireAuth>
  )
}

function statusTone(status: string): string {
  if (isBookingCancelled(status)) return 'bg-red-50 text-red-600'
  if (status === 'COMPLETED') return 'bg-green-50 text-green-700'
  if (status === 'IN_PROGRESS') return 'bg-blue-50 text-brandBlue'
  return 'bg-surfaceMuted text-textSecondary'
}

function BookingInner({ id }: { id?: number }) {
  const router = useRouter()
  const { data, isLoading, isError, refetch } = useBookingQuery(id)
  const cancel = useCancelBookingMutation(id ?? 0)
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight">
        <Stack.Screen options={{ headerShown: true, title: 'Запись' }} />
        <Spinner />
      </View>
    )
  }

  if (isError || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight p-6">
        <Stack.Screen options={{ headerShown: true, title: 'Запись' }} />
        <Card className="w-full items-center p-6">
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-red-700">Запись не найдена.</Text>
          <View className="mt-4 flex-row gap-3">
            <Button variant="secondary" size="sm" onPress={() => refetch()}>Повторить</Button>
            <Button variant="ghost" size="sm" onPress={() => router.replace('/service-book')}>К книжке</Button>
          </View>
        </Card>
      </View>
    )
  }

  const { start: dt, end: dtEnd } = visitTimeRange(data)
  const duration = formatDuration(data.duration_minutes)
  const title =
    data.service_data?.title || data.service_package_data?.title || data.service_package_title_snapshot || 'Услуга'
  const carTitle = data.car?.title || data.car_title_snapshot
  const plate = data.car?.license_plate || data.license_plate_snapshot
  const price = data.price?.display
  const canCancel = data.permissions?.can_cancel && !isBookingCancelled(data.status)
  const canEdit = data.permissions?.can_edit && !isBookingCancelled(data.status)

  const onCancel = () => {
    Alert.alert('Отменить запись?', 'Это действие нельзя отменить.', [
      { text: 'Назад', style: 'cancel' },
      {
        text: 'Отменить запись',
        style: 'destructive',
        onPress: () =>
          cancel.mutate(undefined, {
            onError: (e) =>
              Alert.alert('Ошибка', parseApiError(e, 'Не удалось отменить запись.').general ?? ''),
          }),
      },
    ])
  }

  return (
    <View className="flex-1 bg-surfaceLight">
      <Stack.Screen options={{ headerShown: true, title: 'Запись' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View className={cn('self-start rounded-md px-3 py-1.5', statusTone(data.status))}>
          <Text style={{ fontFamily: 'Inter_900Black' }} className={cn('text-[11px] uppercase tracking-widest', statusTone(data.status))}>
            {data.status_label || data.status}
          </Text>
        </View>

        <Card className="p-5">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl uppercase leading-tight text-textPrimary">
            {title}
          </Text>
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="mt-2 text-sm uppercase tracking-wide text-brandBlue">
            {dt ? formatDateTimeRange(dt, dtEnd) : 'Дата уточняется'}
            {dt && duration ? ` · ${duration}` : ''}
          </Text>

          <View className="mt-5 gap-3">
            <Row label="Автомобиль" value={carTitle || '—'} />
            {plate ? <Row label="Госномер" value={plate} /> : null}
            {price ? <Row label="Стоимость" value={price} accent /> : null}
            {typeof data.current_mileage_km === 'number' ? (
              <Row label="Пробег" value={formatMileage(data.current_mileage_km)} />
            ) : null}
          </View>
        </Card>

        {data.comment ? (
          <Card className="p-5">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-textSecondary">
              Комментарий
            </Text>
            <Text className="mt-2 text-sm text-textPrimary">{data.comment}</Text>
          </Card>
        ) : null}

        {isBookingCancelled(data.status) && data.cancel_reason ? (
          <Card className="border-red-200 bg-red-50 p-5">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-red-600">
              Причина отмены
            </Text>
            <Text className="mt-2 text-sm text-red-700">{data.cancel_reason}</Text>
          </Card>
        ) : null}
      </ScrollView>

      {canEdit || canCancel ? (
        <BottomBar className="gap-2">
          {canEdit ? (
            <Button variant="primary" fullWidth onPress={() => setEditOpen(true)}>
              Изменить запись
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="danger" fullWidth loading={cancel.isPending} onPress={onCancel}>
              Отменить запись
            </Button>
          ) : null}
        </BottomBar>
      ) : null}

      {canEdit ? (
        <EditBookingModal open={editOpen} onClose={() => setEditOpen(false)} booking={data} />
      ) : null}
    </View>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-4 border-t border-borderLight pt-3">
      <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-textSecondary">
        {label}
      </Text>
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        className={cn('flex-1 text-right text-sm', accent ? 'text-brandBlue' : 'text-textPrimary')}
      >
        {value}
      </Text>
    </View>
  )
}
