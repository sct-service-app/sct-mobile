import { http } from '@/shared/api/http'
import { endpoints } from '@/shared/api/endpoints'

/**
 * Услуга для запроса слотов — РОВНО одна из двух, как и в create_booking.
 * Тип не даёт передать обе сразу (бэк на это отвечает 400).
 */
export type SlotsService =
  | { service_package_id: number; default_service_page_id?: never }
  | { default_service_page_id: number; service_package_id?: never }

export type AvailableSlotsParams = SlotsService & {
  service_station_id: number
  /** YYYY-MM-DD */
  date: string
}

export interface AvailableSlotsData {
  service_station_id: number
  service_package_id: number | null
  default_service_page_id: number | null
  date: string
  /** Сколько длится услуга: масло ДВС 30, АКПП 120. */
  duration_minutes: number
  /** Шаг между возможными стартами (30). Это НЕ длительность. */
  slot_step_minutes: number
  /** Только реально свободные старты. Пустой массив — не ошибка. */
  slots: { datetime: string }[]
}

/**
 * GET available-slots. Конверт `{success, data}` снимает interceptor http.
 * Ответ не той формы считаем ошибкой: тогда шаг времени откатится на часы
 * работы филиала (см. DateTimeStep), а не упадёт на `undefined.slots`.
 */
export async function fetchAvailableSlots(params: AvailableSlotsParams): Promise<AvailableSlotsData> {
  const response = await http.get<AvailableSlotsData>(endpoints.availableSlots, { params })
  const data = response.data as Partial<AvailableSlotsData> | null
  if (!data || !Array.isArray(data.slots)) {
    throw new Error('available-slots: неожиданная форма ответа')
  }
  return data as AvailableSlotsData
}
