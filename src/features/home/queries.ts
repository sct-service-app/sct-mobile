import { useQuery } from '@tanstack/react-query'
import { fetchHomePromotion } from './api'

export const homeKeys = {
  all: ['home'] as const,
  promotion: () => [...homeKeys.all, 'promotion'] as const,
}

export function useHomePromotionQuery() {
  return useQuery({
    queryKey: homeKeys.promotion(),
    queryFn: fetchHomePromotion,
    staleTime: 5 * 60_000,
  })
}
