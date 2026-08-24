import { http } from '@/shared/api/http'
import { endpoints } from '@/shared/api/endpoints'
import type { HomePromotion } from './types'

/**
 * Тянем текущую акцию месяца для промо-баннера. Ручка публичная; если активной
 * акции нет, бэк может вернуть promotion: null — тогда баннер просто не рисуем.
 * http-интерсептор уже развернул конверт { success, data } → { promotion }.
 */
export async function fetchHomePromotion(): Promise<HomePromotion | null> {
  const response = await http.get<{ promotion: HomePromotion | null }>(
    endpoints.homePromotion,
  )
  return response.data?.promotion ?? null
}
