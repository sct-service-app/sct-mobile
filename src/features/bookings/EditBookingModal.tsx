/**
 * Модалка редактирования записи (RN-порт web/features/bookings/EditBookingModal).
 *
 * Что можно менять (бэк подтвердил PATCH-ом):
 *   - service_station_id  — филиал
 *   - preferred_datetime  — желаемые дата/время
 *   - comment             — комментарий клиента
 *
 * Пере-использует RN-шаги wizard'а: BranchStep + DateTimeStep — тот же UX,
 * что и при создании записи. Услуга/машина/статус через эту форму не меняются.
 */
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Textarea'
import { toast } from '@/shared/ui/Toast'
import { BranchStep } from '@/features/booking-wizard/BranchStep'
import { DateTimeStep } from '@/features/booking-wizard/DateTimeStep'
import { localIsoToUtcIso } from '@/features/booking-wizard/lib'
import { useSlotsApiEnabled } from '@/features/booking-wizard/queries'
import { parseApiError } from '@/features/auth/errors'
import { formatDateTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { useUpdateBookingMutation } from './queries'
import type { Booking, UpdateBookingPayload } from './types'
import type { ServiceStation } from '@/features/service-stations/types'

type EditTab = 'branch' | 'datetime' | 'comment'

interface EditBookingModalProps {
  open: boolean
  onClose: () => void
  booking: Booking
}

export function EditBookingModal({ open, onClose, booking }: EditBookingModalProps) {
  // С бэк PR #11 перенос времени и смену филиала отключаем: клиентский PATCH
  // пока не перераспределяет бокс, и запись можно перенести туда, где все
  // боксы заняты. Остаётся комментарий. Вернуть, когда бэк это починит.
  const canReschedule = useSlotsApiEnabled() === false
  const [tab, setTab] = useState<EditTab>(canReschedule ? 'datetime' : 'comment')
  const [branch, setBranch] = useState<ServiceStation | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null) // localIso
  const [comment, setComment] = useState(booking.comment || '')
  const [serverError, setServerError] = useState<string | null>(null)

  const update = useUpdateBookingMutation(booking.id)

  // Сбрасываем форму при каждом открытии — поля показывают свежие данные
  // booking'а, а не последний черновик из предыдущего открытия.
  useEffect(() => {
    if (!open) return
    setTab(canReschedule ? 'datetime' : 'comment')
    setBranch(null)
    setDate(null)
    setSlot(null)
    setComment(booking.comment || '')
    setServerError(null)
  }, [open, booking.id, booking.comment, canReschedule])

  const hasChanges = Boolean(branch) || Boolean(slot) || comment !== (booking.comment || '')

  const onSubmit = async () => {
    setServerError(null)
    const payload: UpdateBookingPayload = {}
    if (branch) payload.service_station_id = branch.id
    if (slot) payload.preferred_datetime = localIsoToUtcIso(slot)
    if (comment !== (booking.comment || '')) payload.comment = comment.trim()

    if (Object.keys(payload).length === 0) {
      setServerError('Нет изменений для сохранения.')
      return
    }

    try {
      await update.mutateAsync(payload)
      toast.success('Изменения сохранены')
      onClose()
    } catch (err) {
      setServerError(parseApiError(err, 'Не удалось сохранить изменения.').general)
    }
  }

  const currentDateLabel = (() => {
    const dt = booking.final_datetime ?? booking.scheduled_datetime ?? booking.preferred_datetime
    return dt ? formatDateTime(dt) : '—'
  })()

  const currentStation = booking.service_station_data?.name || '—'

  const serviceTitle =
    booking.service_data?.title ||
    booking.service_package_data?.title ||
    booking.default_service_page_data?.title ||
    booking.service_package_title_snapshot ||
    '—'

  return (
    <Modal open={open} onClose={onClose} title="Изменить запись" disableOverlayClose>
      <Text className="-mt-1 mb-4 text-sm text-textSecondary">
        {canReschedule
          ? 'Можно изменить филиал, дату/время или комментарий. Поля, которые не трогаете, останутся как есть.'
          : 'Можно изменить комментарий к визиту. Чтобы перенести время или сменить филиал, отмените запись и создайте новую — так мы подберём свободный бокс.'}
      </Text>

      {/* Текущая запись (read-only) */}
      <View className="mb-4 gap-2 rounded-sct border border-borderLight bg-surfaceLight/60 p-4">
        <SummaryField label="Текущая дата" value={currentDateLabel} />
        <SummaryField label="Текущий филиал" value={currentStation} />
        <SummaryField label="Услуга" value={serviceTitle} />
      </View>

      {/* Вкладки */}
      <View className="mb-4 flex-row gap-4 border-b border-borderLight pb-3">
        {canReschedule ? (
          <>
            <TabButton current={tab} value="datetime" onPress={setTab}>
              Дата/время
            </TabButton>
            <TabButton current={tab} value="branch" onPress={setTab}>
              Филиал
            </TabButton>
          </>
        ) : null}
        <TabButton current={tab} value="comment" onPress={setTab}>
          Комментарий
        </TabButton>
      </View>

      {/* Содержимое вкладки */}
      <View className="min-h-[280px]">
        {tab === 'branch' ? (
          <BranchStep
            selectedId={branch?.id ?? null}
            onSelect={(s) => {
              setBranch(s)
              // Расписание у нового филиала другое — сбрасываем слот.
              setDate(null)
              setSlot(null)
            }}
          />
        ) : null}

        {tab === 'datetime' ? (
          branch ? (
            <DateTimeStep
              branchId={branch.id}
              selectedDate={date}
              selectedSlot={slot}
              onChange={(d, s) => {
                setDate(d)
                setSlot(s)
              }}
            />
          ) : (
            <NoBranchPicked onSwitchToBranch={() => setTab('branch')} />
          )
        ) : null}

        {tab === 'comment' ? (
          <Textarea
            label="Комментарий к визиту"
            rows={6}
            placeholder="Например: проверить шум подвески, подготовить расходники заранее."
            value={comment}
            onChangeText={setComment}
          />
        ) : null}
      </View>

      {/* Сводка изменений */}
      {hasChanges ? (
        <View className="mt-4 rounded-sct border border-blue-100 bg-blue-50/50 p-4">
          <Text
            style={{ fontFamily: 'Inter_900Black' }}
            className="text-[10px] uppercase tracking-widest text-brandBlue"
          >
            Будет изменено
          </Text>
          <View className="mt-2 gap-1">
            {branch ? <ChangeLine text={`Филиал → ${branch.name}`} /> : null}
            {slot ? <ChangeLine text={`Дата → ${formatDateTime(localIsoToUtcIso(slot))}`} /> : null}
            {comment !== (booking.comment || '') ? <ChangeLine text="Комментарий обновлён" /> : null}
          </View>
        </View>
      ) : null}

      {serverError ? (
        <View className="mt-4 rounded-sct border border-red-200 bg-red-50 p-3">
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-sm text-red-700">
            {serverError}
          </Text>
        </View>
      ) : null}

      <View className="mt-6 gap-3">
        <Button onPress={onSubmit} loading={update.isPending} disabled={!hasChanges} fullWidth>
          Сохранить изменения
        </Button>
        <Button variant="ghost" onPress={onClose} disabled={update.isPending} fullWidth>
          Отмена
        </Button>
      </View>
    </Modal>
  )
}

function TabButton({
  current,
  value,
  onPress,
  children,
}: {
  current: EditTab
  value: EditTab
  onPress: (v: EditTab) => void
  children: React.ReactNode
}) {
  const isActive = current === value
  return (
    <Pressable onPress={() => onPress(value)} className="pb-2">
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        className={cn(
          'text-[12px] uppercase tracking-widest',
          isActive ? 'text-brandBlue' : 'text-textSecondary',
        )}
      >
        {children}
      </Text>
      {isActive ? (
        <View className="absolute -bottom-[13px] left-0 h-[3px] w-full rounded-full bg-brandBlue" />
      ) : null}
    </Pressable>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        className="text-[9px] uppercase tracking-widest text-textSecondary"
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{ fontFamily: 'Inter_700Bold' }}
        className="flex-1 text-right text-sm text-textPrimary"
      >
        {value}
      </Text>
    </View>
  )
}

function ChangeLine({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-1.5 w-1.5 rounded-full bg-brandBlue" />
      <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-[12px] text-brandBlueDark">
        {text}
      </Text>
    </View>
  )
}

function NoBranchPicked({ onSwitchToBranch }: { onSwitchToBranch: () => void }) {
  return (
    <View className="rounded-sct border border-dashed border-borderLight bg-surfaceLight/50 p-6">
      <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-center text-sm text-textSecondary">
        Сначала выберите филиал во вкладке «Филиал»
      </Text>
      <Text className="mt-2 text-center text-xs text-textSecondary/70">
        После этого станут доступны даты и слоты — расписание зависит от часов
        работы конкретного филиала.
      </Text>
      <Button variant="secondary" size="sm" className="mt-4 self-center" onPress={onSwitchToBranch}>
        К выбору филиала
      </Button>
    </View>
  )
}
