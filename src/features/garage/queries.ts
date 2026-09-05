/**
 * React Query хуки для гаража. Один файл — одна точка правды по ключам кэша.
 * Все мутации инвалидируют список авто, чтобы UI обновлялся мгновенно.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCar,
  deleteCar,
  fetchCar,
  fetchCars,
  fetchGarageFormPageData,
  setDefaultCar,
  updateCar,
  type CarWritePayload,
} from './api'
import { useAuthStore } from '@/features/auth/store'

export const garageKeys = {
  all: ['garage'] as const,
  cars: () => [...garageKeys.all, 'cars'] as const,
  car: (id: number) => [...garageKeys.all, 'cars', id] as const,
  form: (mode: string, carId?: number) =>
    [...garageKeys.all, 'form', mode, carId ?? null] as const,
}

export function useCarsQuery() {
  // Эндпоинт требует JWT — для гостя гарантированно вернёт 401, поэтому
  // запрос не делаем. Когда юзер залогинится — query автоматически
  // запустится (TanStack Query следит за `enabled`).
  const isAuthed = useAuthStore((s) => s.phase === 'authed')
  return useQuery({
    queryKey: garageKeys.cars(),
    queryFn: fetchCars,
    enabled: isAuthed,
  })
}

export function useCarQuery(id: number | undefined) {
  return useQuery({
    queryKey: id !== undefined ? garageKeys.car(id) : ['garage', 'cars', 'none'],
    queryFn: () => fetchCar(id!),
    enabled: id !== undefined,
  })
}

export function useGarageFormPageData(mode: 'add' | 'edit' | 'change', carId?: number) {
  return useQuery({
    queryKey: garageKeys.form(mode, carId),
    queryFn: () => fetchGarageFormPageData(mode, carId),
  })
}

export function useSetDefaultCarMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => setDefaultCar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: garageKeys.cars() })
      // Активное авто влияет на список пакетов и сервисную книжку — тоже
      // помечаем устаревшим.
      qc.invalidateQueries({ queryKey: ['packages'] })
      qc.invalidateQueries({ queryKey: ['service-book'] })
    },
  })
}

export function useDeleteCarMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteCar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: garageKeys.cars() })
      qc.invalidateQueries({ queryKey: ['packages'] })
      qc.invalidateQueries({ queryKey: ['service-book'] })
    },
  })
}

export function useCreateCarMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CarWritePayload) => createCar(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: garageKeys.cars() })
      qc.invalidateQueries({ queryKey: ['packages'] })
      qc.invalidateQueries({ queryKey: ['service-book'] })
    },
  })
}

export function useUpdateCarMutation(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<CarWritePayload>) => updateCar(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: garageKeys.cars() })
      qc.invalidateQueries({ queryKey: garageKeys.car(id) })
      // Госномер и год выводятся на «Главной», «Авто», «Услугах» и в «Моём
      // гараже», а их кормит service-book/page-data. Пока в форме правили
      // только псевдоним и пробег, этого никто не замечал; с 05.09 правится
      // госномер — без этих двух строк он менялся ТОЛЬКО на экране
      // редактирования, а везде оставался старый до перезапуска приложения.
      qc.invalidateQueries({ queryKey: ['service-book'] })
      qc.invalidateQueries({ queryKey: ['packages'] })
    },
  })
}
