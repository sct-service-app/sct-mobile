/**
 * Шаг «Дата и время» (RN-порт features/booking-wizard/DateTimeStep.tsx).
 *
 * Сверху — горизонтальная лента дней из расписания выбранного филиала
 * (14 дней). Выходные/закрытые — disabled. Под ней — слоты с разделением
 * «Утро / День / Вечер».
 *
 * Откуда время:
 *  - передан `service` (бэк с PR #11) — GET available-slots на выбранную
 *    дату, показываем только то, что вернул бэк: занятое и прошедшее он уже
 *    отсёк, длительность услуги учёл;
 *  - нет `service` — старая нарезка часов работы по 30 минут, для сегодня
 *    прошедшие слоты заблокированы. Уберём после деплоя PR #11.
 */
import { useEffect, useMemo } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useServiceStationQuery } from '@/features/service-stations/queries'
import { Spinner } from '@/shared/ui/Spinner'
import { Card } from '@/shared/ui/Card'
import { cn } from '@/shared/lib/cn'
import { formatDuration } from '@/shared/lib/format'
import { buildTimeSlots, dayShortLabel, groupSlotsByPeriod, slotsFromApi, type TimeSlot } from './lib'
import { useAvailableSlotsQuery } from './queries'
import type { AvailableSlotsParams, SlotsService } from './api'
import type { StationScheduleDay } from '@/features/service-stations/types'

interface DateTimeStepProps {
  branchId: number
  selectedDate: string | null
  selectedSlot: string | null
  onChange: (date: string | null, slot: string | null) => void
  /** Услуга для available-slots. Не передана — старая нарезка часов работы. */
  service?: SlotsService | null
}

export function DateTimeStep({ branchId, selectedDate, selectedSlot, onChange, service }: DateTimeStepProps) {
  const { data, isLoading, isError } = useServiceStationQuery(branchId, 14)

  // Минимальное допустимое время для is_today — сейчас + 30 минут.
  const firstAllowed = useMemo(() => new Date(Date.now() + 30 * 60_000), [])

  const slotsParams: AvailableSlotsParams | null =
    service && selectedDate ? { ...service, service_station_id: branchId, date: selectedDate } : null
  const slotsQuery = useAvailableSlotsQuery(slotsParams)
  const apiData = slotsQuery.data

  // Выбранное время пропало из свежего ответа (его заняли, пока человек
  // думал, или после отказа create_booking) — снимаем выбор, чтобы «Далее»
  // не пропустил дальше с несуществующим слотом.
  useEffect(() => {
    if (!service || !selectedSlot || !apiData) return
    if (!apiData.slots.some((s) => s.datetime === selectedSlot)) onChange(selectedDate, null)
  }, [service, selectedSlot, selectedDate, apiData, onChange])

  if (isLoading) {
    return (
      <View className="min-h-[260px] items-center justify-center">
        <Spinner />
      </View>
    )
  }

  if (isError || !data) {
    return (
      <View className="rounded-sct border border-red-200 bg-red-50 p-4">
        <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-sm text-red-700">
          Не удалось загрузить расписание филиала.
        </Text>
      </View>
    )
  }

  const selectedDay = data.schedule.find((d) => d.date === selectedDate) ?? null
  // Страховка на первый деплой PR #11: ручка слотов упала или ответила не той
  // формой — не блокируем запись, а режем часы работы, как раньше. Время всё
  // равно перепроверит create_booking (и ответит BOOKING_SLOT_UNAVAILABLE).
  const slotsFallback = Boolean(service) && !apiData && slotsQuery.isError
  const slots: TimeSlot[] = !selectedDay
    ? []
    : service && !slotsFallback
    ? apiData
      ? slotsFromApi(apiData)
      : []
    : buildTimeSlots(selectedDay, selectedDay.is_today ? firstAllowed : undefined)
  const { morning, day, evening } = groupSlotsByPeriod(slots)
  const duration = formatDuration(apiData?.duration_minutes)

  return (
    <View className="gap-7">
      <View>
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-xl uppercase text-textPrimary">
          Выберите дату и время
        </Text>
        <Text className="mt-1 text-sm text-textSecondary">
          В{' '}
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-textPrimary">
            {data.name}
          </Text>
          {service && !slotsFallback
            ? `. Показываем только свободное время${duration ? ` · услуга занимает ${duration}` : ''}.`
            : '. Слоты по 30 минут.'}
        </Text>
      </View>

      {/* Дни */}
      <View>
        <Text
          style={{ fontFamily: 'Inter_900Black' }}
          className="mb-3 text-[11px] uppercase tracking-widest text-textSecondary"
        >
          Дата визита
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        >
          {data.schedule.map((d) => (
            <DayChip
              key={d.date}
              day={d}
              isSelected={d.date === selectedDate}
              onSelect={() => onChange(d.date, null)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Слоты */}
      {selectedDay ? (
        // isPending, а не isLoading: запрос в паузе (нет сети) — это «ещё не
        // знаем», а не «времени нет».
        service && !slotsFallback && slotsQuery.isPending ? (
          <View className="min-h-[120px] items-center justify-center">
            <Spinner />
          </View>
        ) : slots.length === 0 ? (
          <Card className="p-4">
            <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-center text-sm text-textSecondary">
              {selectedDay.is_closed
                ? 'В этот день филиал закрыт.'
                : service
                ? 'На выбранную дату свободного времени нет. Попробуйте другую дату.'
                : 'На этот день нет доступных слотов.'}
            </Text>
          </Card>
        ) : (
          <View className="gap-5">
            {slotsFallback ? (
              <Text className="text-xs text-textSecondary">
                Не удалось проверить занятость — показываем часы работы филиала. Свободно ли
                время, проверим при подтверждении.
              </Text>
            ) : null}
            <SlotGroup
              title="Утро"
              hint="до 12:00"
              slots={morning}
              selected={selectedSlot}
              onSelect={(slot) => onChange(selectedDate, slot)}
            />
            <SlotGroup
              title="День"
              hint="12:00 – 18:00"
              slots={day}
              selected={selectedSlot}
              onSelect={(slot) => onChange(selectedDate, slot)}
            />
            <SlotGroup
              title="Вечер"
              hint="после 18:00"
              slots={evening}
              selected={selectedSlot}
              onSelect={(slot) => onChange(selectedDate, slot)}
            />
          </View>
        )
      ) : (
        <Text className="text-sm text-textSecondary">
          Выберите день — мы покажем доступные слоты.
        </Text>
      )}
    </View>
  )
}

function DayChip({
  day,
  isSelected,
  onSelect,
}: {
  day: StationScheduleDay
  isSelected: boolean
  onSelect: () => void
}) {
  const { weekday, date } = dayShortLabel(day)
  const disabled = day.is_closed || !day.available
  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      className={cn(
        'min-w-[84px] items-center rounded-sct border px-3 py-3',
        disabled
          ? 'border-borderLight bg-surfaceLight opacity-40'
          : isSelected
          ? 'border-brandBlue bg-brandBlue'
          : 'border-borderLight bg-white',
      )}
    >
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        className={cn('text-[10px] uppercase tracking-widest', isSelected ? 'text-white/80' : 'text-textSecondary')}
      >
        {weekday}
      </Text>
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        className={cn('mt-1 text-base', isSelected ? 'text-white' : 'text-textPrimary')}
      >
        {date}
      </Text>
      {disabled ? (
        <Text
          style={{ fontFamily: 'Inter_700Bold' }}
          className="mt-1 text-[9px] uppercase tracking-widest text-textSecondary"
        >
          Выходной
        </Text>
      ) : null}
    </Pressable>
  )
}

function SlotGroup({
  title,
  hint,
  slots,
  selected,
  onSelect,
}: {
  title: string
  hint: string
  slots: TimeSlot[]
  selected: string | null
  onSelect: (slot: string) => void
}) {
  if (slots.length === 0) return null
  return (
    <View>
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        className="mb-2 text-[10px] uppercase tracking-widest text-textSecondary"
      >
        {title} <Text className="text-textSecondary/50">· {hint}</Text>
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {slots.map((slot) => {
          const isSelected = selected === slot.value
          return (
            <Pressable
              key={slot.value}
              disabled={slot.inPast}
              onPress={() => onSelect(slot.value)}
              className={cn(
                'w-[31%] items-center rounded-sct border px-2 py-3',
                slot.inPast
                  ? 'border-borderLight bg-surfaceLight opacity-40'
                  : isSelected
                  ? 'border-brandBlue bg-brandBlue'
                  : 'border-borderLight bg-white',
              )}
            >
              <Text
                style={{ fontFamily: 'Inter_900Black' }}
                className={cn(
                  'text-sm',
                  slot.inPast
                    ? 'text-textSecondary line-through'
                    : isSelected
                    ? 'text-white'
                    : 'text-textPrimary',
                )}
              >
                {slot.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
