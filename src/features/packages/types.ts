/**
 * Runtime-типы для дефолтных услуг (DefaultServicePage).
 *
 * Сгенерированный `ClientPackagesPage` (старая schema) не содержал
 * `default_services`, а `ClientDefaultServicePage` в re-export'ах нет вовсе.
 * Восстанавливаем по свежей схеме (Template.yaml → ClientDefaultServicePage)
 * и инструкции бэкендщика. Когда обновим `gen:api` — переедем на Schemas[...].
 */
import type { ClientPackageCategory, ClientPackagesPage } from '@/shared/api/types'

export interface DefaultServiceMoney {
  amount?: string | null
  currency?: string
  display?: string
}

export interface ClientDefaultServicePage {
  id: number
  /** Дискриминатор типа услуги: всегда 'default_service_page'. */
  service_source_type: string
  category?: ClientPackageCategory | null
  title: string
  slug?: string
  status?: string
  status_display?: string
  short_description?: string
  description?: string
  hero_eyebrow?: string
  availability_title?: string
  availability_message?: string
  /** У дефолтной услуги обычно null — точной цены нет. */
  price?: DefaultServiceMoney | null
  price_note?: string
  important_note?: string
  /** Список пунктов «что входит в услугу». */
  what_is_included?: string[]
  /** Список причин, почему цена зависит от авто (иногда бэк шлёт строкой). */
  why_price_depends?: string[] | string
  is_featured?: boolean
  sort_order?: number
  /** Картинка услуги (PR #11). Нет картинки — пустая строка, а не null. */
  image_url?: string
}

/**
 * Ответ GET /client_endpoints/packages/ по свежей схеме: к старому
 * `ClientPackagesPage` добавлен массив `default_services`.
 */
export type PackagesPageData = ClientPackagesPage & {
  default_services?: ClientDefaultServicePage[]
}
