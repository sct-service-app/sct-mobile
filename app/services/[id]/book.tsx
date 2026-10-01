/**
 * Запись на сервис (RN-порт pages/BookServicePage.tsx) — 3 шага:
 *   филиал → дата/время → подтверждение.
 *
 * Сверху — тёмная сводка-бар (услуга + авто + «к оплате»), под ней
 * 3-сегментный прогресс. Авто отдельно не выбираем — берём активное
 * (или ?car_id=). После подтверждения — экран «Визит подтверждён».
 *
 * Submit: POST /service-book/create_booking/ { client_car_id,
 * service_package_id | default_service_page_id, preferred_datetime,
 * service_station_id, client_comment }. Пробег в дизайне не запрашивается.
 *
 * Ветка ?type=default шлёт default_service_page_id (для дефолтных услуг).
 *
 * Время: с бэк PR #11 (флаг `useSlotsApiEnabled`) — только свободные старты
 * из available-slots, `preferred_datetime` уходит строкой бэка как есть.
 * Бокс бэк выбирает сам. Если слот заняли, пока человек подтверждал, бэк
 * отвечает BOOKING_SLOT_UNAVAILABLE — возвращаем на шаг времени со свежим
 * списком. Без флага — старая нарезка часов работы.
 */
import { useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { RequireAuth } from '@/shared/ui/RequireAuth'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Spinner } from '@/shared/ui/Spinner'
import { SafeImage } from '@/shared/ui/SafeImage'
import { Textarea } from '@/shared/ui/Textarea'
import { cn } from '@/shared/lib/cn'
import { formatDateTimeRange, formatDuration, formatMoney } from '@/shared/lib/format'
import { usePackageQuery, useDefaultServiceQuery } from '@/features/packages/queries'
import { getPackageShortTitle } from '@/features/packages/lib'
import { useCarsQuery } from '@/features/garage/queries'
import { getCarTitle } from '@/features/garage/lib'
import { useCreateBookingMutation } from '@/features/bookings/queries'
import { parseApiError } from '@/features/auth/errors'
import { BranchStep } from '@/features/booking-wizard/BranchStep'
import { DateTimeStep } from '@/features/booking-wizard/DateTimeStep'
import { bookingConflict, slotToIso } from '@/features/booking-wizard/lib'
import { useAvailableSlotsQuery, useSlotsApiEnabled } from '@/features/booking-wizard/queries'
import type { SlotsService } from '@/features/booking-wizard/api'
import { buildGoogleCalendarUrl } from '@/shared/lib/calendar'
import type { ServiceStation } from '@/features/service-stations/types'
import type { ClientPackageItem } from '@/shared/api/types'

type Step = 'branch' | 'datetime' | 'confirm'
const STEP_ORDER: Step[] = ['branch', 'datetime', 'confirm']

export default function BookServiceScreen() {
  return (
    <RequireAuth>
      <Stack.Screen options={{ headerShown: true, title: 'Запись на сервис' }} />
      <BookServiceWizard />
    </RequireAuth>
  )
}

function BookServiceWizard() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string; type?: string; car_id?: string }>()
  const packageId = params.id ? Number(params.id) : undefined

  const isDefault = params.type === 'default'
  const packageQuery = usePackageQuery(isDefault ? undefined : packageId)
  const defaultQuery = useDefaultServiceQuery(isDefault ? packageId : undefined)
  const sourceQuery = isDefault ? defaultQuery : packageQuery
  const carsQuery = useCarsQuery()
  const createMut = useCreateBookingMutation()

  const [step, setStep] = useState<Step>('branch')
  const [selectedBranch, setSelectedBranch] = useState<ServiceStation | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // П.2 ТЗ: «понимаю, что возможна живая очередь». Только блокирует кнопку,
  // на бэк не уходит (так договорились с бэком).
  const [queueAck, setQueueAck] = useState(false)

  const slotsApi = useSlotsApiEnabled()
  const slotsService: SlotsService | null =
    slotsApi && packageId
      ? isDefault
        ? { default_service_page_id: packageId }
        : { service_package_id: packageId }
      : null
  // Тот же запрос, что внутри DateTimeStep (общий кэш, второго похода нет):
  // нужен для длительности на подтверждении и перезапроса после отказа.
  const slotsQuery = useAvailableSlotsQuery(
    slotsService && selectedBranch && selectedDate
      ? { ...slotsService, service_station_id: selectedBranch.id, date: selectedDate }
      : null,
  )
  const durationMin = slotsService ? slotsQuery.data?.duration_minutes ?? null : null
  const slotIso = selectedSlot ? slotToIso(selectedSlot) : null
  const slotEndIso =
    slotIso && durationMin ? new Date(new Date(slotIso).getTime() + durationMin * 60_000).toISOString() : null

  // Авто: из ?car_id=, иначе активное (is_default), иначе первое.
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null)
  const urlCarId = useMemo(() => {
    const v = Number(params.car_id)
    return Number.isFinite(v) && v > 0 ? v : undefined
  }, [params.car_id])

  useEffect(() => {
    if (!carsQuery.data || selectedCarId !== null) return
    const cars = carsQuery.data
    const byUrl = urlCarId ? cars.find((c) => c.id === urlCarId) : undefined
    const active = cars.find((c) => c.is_default)
    const target = byUrl || active || cars[0]
    if (target) setSelectedCarId(target.id)
  }, [carsQuery.data, urlCarId, selectedCarId])

  // === Загрузка ===
  if (sourceQuery.isLoading || carsQuery.isLoading || slotsApi === null) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight">
        <Spinner />
      </View>
    )
  }

  // === Услуга не найдена ===
  if (sourceQuery.isError || !sourceQuery.data) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight p-6">
        <Card className="w-full items-center p-6">
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-red-700">Услуга не найдена.</Text>
          <View className="mt-4">
            <Button variant="ghost" size="sm" onPress={() => router.replace('/services')}>
              К услугам
            </Button>
          </View>
        </Card>
      </View>
    )
  }

  // === Нет авто в гараже ===
  if (!carsQuery.data || carsQuery.data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight p-6">
        <Card className="w-full items-center border-2 border-dashed border-borderLight p-8">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-center text-2xl uppercase text-textPrimary">
            Сначала добавьте авто
          </Text>
          <Text className="mt-3 text-center text-sm text-textSecondary">
            Чтобы записаться на сервис, в гараже должна быть хотя бы одна машина.
          </Text>
          <View className="mt-8">
            <Button variant="dark" size="lg" onPress={() => router.push('/garage/add')}>
              Добавить авто
            </Button>
          </View>
        </Card>
      </View>
    )
  }

  const cars = carsQuery.data
  const selectedCar = cars.find((c) => c.id === selectedCarId) ?? null

  // Унифицированная вьюмодель: точный пакет ИЛИ дефолтная услуга.
  const pkgData = packageQuery.data
  const dsData = defaultQuery.data
  const shortTitle = isDefault ? dsData?.title ?? 'Услуга' : getPackageShortTitle(pkgData!)
  const price = isDefault
    ? dsData?.price_note || 'Цена рассчитывается индивидуально'
    : formatMoney(pkgData!.final_price, pkgData!.currency)
  // У дефолтной услуги картинки нет — пустая строка (PR #11), отсюда `||`.
  const imageUrl = isDefault ? dsData?.image_url || undefined : pkgData!.image_url
  const items = isDefault ? [] : pkgData!.package_items ?? []
  const carFallback = isDefault ? '' : pkgData!.car_title
  const carLine = selectedCar
    ? `${getCarTitle(selectedCar)}${selectedCar.license_plate ? ` (${selectedCar.license_plate})` : ''}`
    : carFallback

  const stepIdx = STEP_ORDER.indexOf(step)

  const onSubmit = async () => {
    if (!packageId || !selectedCar || !selectedBranch || !selectedSlot) return
    setServerError(null)
    try {
      await createMut.mutateAsync({
        client_car_id: selectedCar.id,
        ...(isDefault
          ? { default_service_page_id: packageId }
          : { service_package_id: packageId }),
        preferred_datetime: slotToIso(selectedSlot),
        service_station_id: selectedBranch.id,
        client_comment: comment.trim() || undefined,
      })
      setDone(true)
    } catch (err) {
      const parsed = parseApiError(err, 'Не удалось создать запись.')
      const conflict = bookingConflict(parsed)
      if (conflict) {
        setServerError(conflict.message)
        if (conflict.kind !== 'unavailable') {
          setSelectedSlot(null)
          if (conflict.kind === 'day_closed') setSelectedDate(null)
          setStep('datetime')
          if (conflict.kind === 'slot_taken') void slotsQuery.refetch()
        }
        return
      }
      // Ошибка могла прийти только по полю (а `general` тогда — общее
      // «Ошибка валидации.»), поэтому сначала смотрим поле времени.
      setServerError(parsed.fields.preferred_datetime ?? parsed.general)
    }
  }

  // === Экран успеха ===
  if (done) {
    return (
      <View className="flex-1 bg-surfaceLight">
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <ProgressBar current={STEP_ORDER.length} />
          <View className="items-center py-10">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-blue-50">
              <Ionicons name="checkmark" size={44} color="#1F5FAF" />
            </View>
            <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-6 text-center text-3xl uppercase text-textPrimary">
              Визит подтверждён!
            </Text>
            <Text className="mt-3 text-center text-sm text-textSecondary">
              Мы ждём вас и ваш{' '}
              <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-brandBlue">
                {selectedCar ? getCarTitle(selectedCar) : carFallback}
              </Text>{' '}
              на выбранном филиале{slotIso ? `, ${formatDateTimeRange(slotIso, slotEndIso)}` : ''}.
            </Text>
            <View className="mt-8 w-full gap-3">
              <Button variant="primary" size="lg" fullWidth onPress={() => router.replace('/service-book')}>
                К моим записям
              </Button>
              {selectedSlot ? (
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  leftIcon={<Ionicons name="calendar-outline" size={16} color="#18202A" />}
                  onPress={() =>
                    Linking.openURL(
                      buildGoogleCalendarUrl({
                        title: `SCT Service: ${shortTitle}`,
                        startIso: slotToIso(selectedSlot),
                        durationMin: durationMin ?? 60,
                        location: selectedBranch
                          ? [selectedBranch.name, selectedBranch.city, selectedBranch.address]
                              .filter(Boolean)
                              .join(', ')
                          : undefined,
                        details: `Запись на обслуживание. Авто: ${
                          selectedCar ? getCarTitle(selectedCar) : carFallback
                        }. Услуга: ${shortTitle}.`,
                      }),
                    )
                  }
                >
                  Добавить в календарь
                </Button>
              ) : null}
              <Button variant="secondary" size="lg" fullWidth onPress={() => router.replace('/')}>
                На главную
              </Button>
            </View>
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-surfaceLight">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Сводка-бар */}
        <View className="overflow-hidden rounded-sct-lg bg-navy p-4">
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white/10">
                <SafeImage
                  uri={imageUrl ?? undefined}
                  resizeMode="cover"
                  className="h-full w-full"
                  fallback={<Text className="text-base text-white/40">🛠️</Text>}
                />
              </View>
              <View className="flex-1">
                <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="text-sm text-white">
                  {shortTitle}
                </Text>
                <Text
                  style={{ fontFamily: 'Inter_700Bold' }}
                  numberOfLines={1}
                  className="mt-0.5 text-[10px] uppercase tracking-widest text-white/50"
                >
                  {carLine}
                </Text>
              </View>
            </View>
            <View className="items-end">
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[9px] uppercase tracking-widest text-white/50">
                К оплате
              </Text>
              <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="max-w-[120px] text-base text-brandYellow">
                {price}
              </Text>
            </View>
          </View>
        </View>

        <ProgressBar current={stepIdx} onJump={(i) => i < stepIdx && setStep(STEP_ORDER[i])} />

        <View className="mt-6">
          {step === 'branch' ? (
            <BranchStep
              selectedId={selectedBranch?.id ?? null}
              onSelect={(s) => {
                setSelectedBranch(s)
                setStep('datetime')
              }}
            />
          ) : null}
          {step === 'datetime' && selectedBranch ? (
            <DateTimeStep
              branchId={selectedBranch.id}
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              service={slotsService}
              onChange={(d, slot) => {
                setSelectedDate(d)
                setSelectedSlot(slot)
                if (slot) setServerError(null)
              }}
            />
          ) : null}
          {step === 'confirm' && selectedBranch && selectedSlot ? (
            <ConfirmStep
              items={items}
              branch={selectedBranch}
              slotIso={slotToIso(selectedSlot)}
              endIso={slotEndIso}
              durationMin={durationMin}
              comment={comment}
              onCommentChange={setComment}
              note={isDefault ? price : undefined}
              queueAck={queueAck}
              onQueueAckChange={setQueueAck}
            />
          ) : null}
        </View>

        {serverError ? (
          <View className="mt-4 rounded-sct border border-red-200 bg-red-50 p-3">
            <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-sm text-red-700">
              {serverError}
            </Text>
          </View>
        ) : null}

        {/* Основное действие шага */}
        {step === 'datetime' ? (
          <View className="mt-6">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={!selectedDate || !selectedSlot}
              onPress={() => setStep('confirm')}
            >
              Далее
            </Button>
          </View>
        ) : null}
        {step === 'confirm' ? (
          <View className="mt-6">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={createMut.isPending}
              disabled={!queueAck}
              onPress={onSubmit}
            >
              {createMut.isPending ? 'Создаём запись…' : 'Подтвердить запись'}
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

function ProgressBar({ current, onJump }: { current: number; onJump?: (i: number) => void }) {
  return (
    <View className="mt-5 flex-row gap-2">
      {STEP_ORDER.map((_, i) => {
        const reachable = Boolean(onJump) && i < current
        return (
          <Pressable
            key={i}
            disabled={!reachable}
            onPress={() => reachable && onJump?.(i)}
            className={cn('h-1.5 flex-1 rounded-full', i <= current ? 'bg-brandBlue' : 'bg-borderLight')}
          />
        )
      })}
    </View>
  )
}

function ConfirmStep({
  items,
  branch,
  slotIso,
  endIso,
  durationMin,
  comment,
  onCommentChange,
  note,
  queueAck,
  onQueueAckChange,
}: {
  items: ClientPackageItem[]
  branch: ServiceStation
  /** ISO начала (уже через slotToIso). */
  slotIso: string
  endIso: string | null
  durationMin: number | null
  comment: string
  onCommentChange: (v: string) => void
  note?: string
  queueAck: boolean
  onQueueAckChange: (v: boolean) => void
}) {
  return (
    <View>
      <Text style={{ fontFamily: 'Inter_900Black' }} className="mb-5 text-xl uppercase text-textPrimary">
        Проверьте детали записи
      </Text>

      {note ? (
        <View className="mb-4 rounded-sct border border-brandYellow/40 bg-brandYellow/10 p-4">
          <Text style={{ fontFamily: 'Inter_500Medium' }} className="text-sm text-textPrimary">
            {note}. Точную стоимость менеджер рассчитает после уточнения автомобиля.
          </Text>
        </View>
      ) : null}

      {items.length > 0 ? (
        <Card className="overflow-hidden">
          <View className="border-b border-borderLight bg-surfaceLight px-5 py-3">
            <Text
              style={{ fontFamily: 'Inter_900Black' }}
              className="text-[11px] uppercase tracking-widest text-textSecondary"
            >
              Состав пакета услуг
            </Text>
          </View>
          {items.map((item, idx) => (
            <View
              key={item.id}
              className={cn(
                'flex-row items-center justify-between gap-4 px-5 py-3.5',
                idx > 0 && 'border-t border-borderLight',
              )}
            >
              <View className="flex-1">
                <Text style={{ fontFamily: 'Inter_700Bold' }} numberOfLines={2} className="text-sm text-textPrimary">
                  {item.item_name}
                </Text>
                <Text
                  style={{ fontFamily: 'Inter_900Black' }}
                  className="mt-0.5 text-[10px] uppercase tracking-widest text-brandBlue"
                >
                  {item.item_type === 'SERVICE' ? 'Работа' : 'Товар'}
                </Text>
              </View>
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-sm text-textPrimary">
                {formatQty(item.quantity, item.item_type)}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card className="mt-4 p-0">
        <View className="flex-row items-center justify-between gap-3 px-5 py-4">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-textSecondary">
            Филиал
          </Text>
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="flex-1 text-right text-sm text-textPrimary">
            {branch.name}, {branch.address}
          </Text>
        </View>
        <View className="flex-row items-center justify-between gap-3 border-t border-borderLight px-5 py-4">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-textSecondary">
            Выбранное время
          </Text>
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-right text-sm text-brandBlue">
            {formatDateTimeRange(slotIso, endIso)}
          </Text>
        </View>
        {durationMin ? (
          <View className="flex-row items-center justify-between gap-3 border-t border-borderLight px-5 py-4">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-textSecondary">
              Длительность
            </Text>
            <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-right text-sm text-textPrimary">
              {formatDuration(durationMin)}
            </Text>
          </View>
        ) : null}
      </Card>

      <View className="mt-4">
        <Textarea
          rows={3}
          value={comment}
          onChangeText={onCommentChange}
          placeholder="Комментарий к вашему визиту (необязательно)…"
        />
      </View>

      <Pressable
        onPress={() => onQueueAckChange(!queueAck)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: queueAck }}
        className="mt-4 flex-row items-start gap-3 rounded-sct border border-borderLight bg-white p-4"
      >
        <Ionicons
          name={queueAck ? 'checkbox' : 'square-outline'}
          size={22}
          color={queueAck ? '#1F5FAF' : '#9AA4B2'}
        />
        <Text style={{ fontFamily: 'Inter_500Medium' }} className="flex-1 text-sm text-textPrimary">
          Понимаю, что на сервисе возможна живая очередь и время начала может немного сдвинуться.
        </Text>
      </Pressable>
    </View>
  )
}

function formatQty(quantity: string | number | null | undefined, itemType: string): string {
  if (quantity === null || quantity === undefined) return ''
  const num = typeof quantity === 'string' ? Number(quantity) : quantity
  if (!Number.isFinite(num)) return String(quantity)
  const unit = itemType === 'SERVICE' ? 'усл.' : 'шт.'
  const formatted = num % 1 === 0 ? String(num) : String(num).replace(/0+$/, '').replace(/\.$/, '')
  return `${formatted} ${unit}`
}
