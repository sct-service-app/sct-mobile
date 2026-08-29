/**
 * Гараж клиента — API-вызовы. Тонкая обёртка над http.
 */
import { http } from '@/shared/api/http'
import { endpoints } from '@/shared/api/endpoints'
import type { ClientGarageCar, ClientGarageFormPageData } from '@/shared/api/types'

/**
 * Тело создания/обновления авто. Локальный тип: бэк перешёл на
 * `modification_trim_source_id` (составной «модификация__комплектация»),
 * autogen-схема ещё старая (см. Template (4).yaml).
 */
export interface CarWritePayload {
  modification_trim_source_id: string
  license_plate: string
  nickname?: string
  vin_code?: string
  is_default?: boolean
  mileage_km?: number | null
  /**
   * Год выпуска конкретной машины — его пользователь выбирает на шаге
   * «Поколение» мастера. Бэк отдаёт поле во всех ручках гаража, но на запись
   * пока игнорирует (PATCH возвращает 200, значение остаётся null) — как
   * только сделает writable, год поедет сам.
   */
  production_year?: number | null
}

/**
 * GET /garage/cars/.
 *
 * Расхождение с OpenAPI: schema говорит `ClientGarageCar[]`, реальный ответ
 * — DRF-пагинация `{count, results}`. Нормализуем оба формата, в обоих
 * случаях возвращаем массив. Бэкенду уже отписали — пусть синхронизируют.
 */
type PaginatedCars = { results?: ClientGarageCar[] }

export async function fetchCars(): Promise<ClientGarageCar[]> {
  const response = await http.get<ClientGarageCar[] | PaginatedCars>(endpoints.garageCars)
  const data = response.data
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && Array.isArray((data as PaginatedCars).results)) {
    return (data as PaginatedCars).results!
  }
  return []
}

export async function fetchCar(id: number) {
  const response = await http.get<ClientGarageCar>(endpoints.garageCar(id))
  return response.data
}

export async function createCar(payload: CarWritePayload) {
  const response = await http.post<ClientGarageCar>(endpoints.garageCars, payload)
  return response.data
}

export async function updateCar(id: number, payload: Partial<CarWritePayload>) {
  const response = await http.patch<ClientGarageCar>(endpoints.garageCar(id), payload)
  return response.data
}

export async function setDefaultCar(id: number) {
  const response = await http.post<ClientGarageCar>(endpoints.garageCarSetDefault(id))
  return response.data
}

export async function deleteCar(id: number) {
  await http.delete(endpoints.garageCar(id))
}

export async function fetchGarageFormPageData(
  mode: 'add' | 'edit' | 'change',
  carId?: number,
) {
  const response = await http.get<ClientGarageFormPageData>(
    endpoints.garageFormPageData,
    { params: { mode, ...(carId !== undefined ? { car_id: carId } : {}) } },
  )
  return response.data
}
