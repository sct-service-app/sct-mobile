import { useQuery } from '@tanstack/react-query'
import { useServiceBookQuery } from '@/features/service-book/queries'
import { fetchAvailableSlots, type AvailableSlotsParams } from './api'

export const availableSlotsKeys = {
  all: ['booking-available-slots'] as const,
  one: (p: AvailableSlotsParams) =>
    [
      ...availableSlotsKeys.all,
      p.service_station_id,
      p.service_package_id ?? null,
      p.default_service_page_id ?? null,
      p.date,
    ] as const,
}

/**
 * Свободное время на дату. Занятость меняется каждую минуту (другой клиент
 * может забрать последний бокс), поэтому кэш короткий: экран записи живёт в
 * navigation stack, и вернувшись на него, человек получит свежий список.
 * `params = null` — запрос выключен.
 */
export function useAvailableSlotsQuery(params: AvailableSlotsParams | null) {
  return useQuery({
    queryKey: params ? availableSlotsKeys.one(params) : [...availableSlotsKeys.all, 'none'],
    queryFn: () => fetchAvailableSlots(params!),
    enabled: params !== null,
    staleTime: 15_000,
    // Не ждём три ретрая: при сбое быстрее откатиться на часы работы.
    retry: 1,
    gcTime: 60_000,
  })
}

/**
 * Включена ли запись по реальной занятости боксов: бэк с PR #11 кладёт
 * `available_slots_api` в `page-data → actions`. Нет поля — старый бэк, режем
 * часы работы на фронте, как раньше. Запрос page-data уже в кэше (им живут
 * главная, «Авто», год выпуска) — лишнего похода в сеть нет.
 *
 * `null` — page-data ещё грузится; экран записи в это время ждёт, чтобы не
 * показать на долю секунды старую нарезку и не переключиться посреди выбора.
 */
export function useSlotsApiEnabled(): boolean | null {
  const { data, isError } = useServiceBookQuery({})
  if (isError) return false
  if (!data) return null
  return Boolean(data.actions?.available_slots_api)
}
