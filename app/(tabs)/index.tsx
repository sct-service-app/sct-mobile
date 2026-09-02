/**
 * Главная — порт pages/HomePage.tsx. Два режима:
 *   гость → маркетинговый лендинг (Hero + Преимущества + Услуги + Промо);
 *   авторизованный → дашборд (Hero + Мой гараж + Активное авто + Промо +
 *   при наличии авто: Предстоящие визиты + История).
 */
import { ScrollView } from 'react-native'
import { useAuthStore } from '@/features/auth/store'
import { useCarsQuery } from '@/features/garage/queries'
import { HomeHero } from '@/features/home/HomeHero'
import { WhyUsSection } from '@/features/home/WhyUsSection'
import { MainServicesSection } from '@/features/home/MainServicesSection'
import { HomePromoBanner } from '@/features/home/HomePromoBanner'
import { MyGarageColumn } from '@/features/home/MyGarageColumn'
import { ActiveCarBlock } from '@/features/home/ActiveCarBlock'
import { UpcomingVisitsSection } from '@/features/home/UpcomingVisitsSection'
import { HistoryTable } from '@/features/home/HistoryTable'

export default function HomeScreen() {
  const isAuthed = useAuthStore((s) => s.phase === 'authed')
  const carsQuery = useCarsQuery()
  const hasCars = isAuthed && (carsQuery.data?.length ?? 0) > 0

  return (
    <ScrollView className="flex-1 bg-surfaceLight" contentContainerStyle={{ padding: 16, gap: 20 }}>
      {!isAuthed ? (
        <>
          <HomeHero hasCars={false} />
          <WhyUsSection />
          <MainServicesSection />
          <HomePromoBanner />
        </>
      ) : (
        <>
          <HomeHero hasCars={hasCars} />
          {/* Порядок по правке заказчика: приветствие → активное авто →
              мой гараж → история. Раньше гараж шёл раньше активного авто. */}
          <ActiveCarBlock />
          <MyGarageColumn />
          <HomePromoBanner />
          {hasCars ? (
            <>
              <UpcomingVisitsSection />
              <HistoryTable />
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  )
}
