/**
 * Фактический год выпуска авто — один источник на все экраны.
 *
 * Год живёт в двух ручках и по-разному:
 *   - `/garage/cars/` — отдаёт `production_year`, то самое число, которое
 *     человек вводит в «Редактировать авто» (бэк принимает его с 09.2026);
 *   - `service-book/page-data` — поле в ответе есть, но приходит `null`, то
 *     есть введённый год туда не попадает.
 *
 * Плашки с годом рядом с госномером живут как раз на экранах, которые кормит
 * page-data (главная, «Авто», «Услуги», «Мой гараж»), — и показывали
 * `generation.year_from`, год начала ПОКОЛЕНИЯ. Получалось, что человек
 * сохранил 2025, а рядом с номером у него 2024. Поэтому сначала спрашиваем
 * гараж и только потом падаем на книжку.
 *
 * Когда бэк начнёт отдавать `production_year` в page-data (пункт для
 * Нурсултана), хук можно упростить до одной строки, ничего не переписывая.
 */
import { useCarsQuery } from './queries'
import { getCarProductionYear } from './lib'
import { useServiceBookQuery } from '@/features/service-book/queries'

export function useCarYear(carId: number | undefined): number | null {
  const { data: cars } = useCarsQuery()
  const { data: book } = useServiceBookQuery({})

  if (carId == null) return null

  const fromGarage = (cars ?? []).find((c) => c.id === carId)
  const entered = fromGarage ? getCarProductionYear(fromGarage) : null
  if (entered != null) return entered

  const fromBook = (book?.cars ?? []).find((c) => c.id === carId)
  return fromBook?.production_year ?? fromBook?.generation?.year_from ?? null
}
