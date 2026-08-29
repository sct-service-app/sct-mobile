/**
 * Экран «Авто» (бывшая «Сервисная книжка») — порт pages/ServiceBookPage.tsx (одна колонка).
 * Источник — useServiceBookQuery. Состояния: loading/error/NO_CARS/data.
 * Защищён RequireAuth (таб виден только авторизованному, но на всякий случай).
 */
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useServiceBookQuery } from '@/features/service-book/queries'
import { useBookingsQuery } from '@/features/bookings/queries'
import { splitBookings } from '@/features/bookings/lib'
import { CarHeroCompact } from '@/features/service-book/CarHeroCompact'
import { RecommendationStrip } from '@/features/service-book/RecommendationStrip'
import { BookServiceCTA } from '@/features/service-book/BookServiceCTA'
import { AppointmentRow } from '@/features/service-book/AppointmentRow'
import { HistorySection } from '@/features/service-book/HistorySection'
import { MyGarageColumn } from '@/features/home/MyGarageColumn'
import { RequireAuth } from '@/shared/ui/RequireAuth'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'

export default function ServiceBookScreen() {
  return (
    <RequireAuth>
      <ServiceBookInner />
    </RequireAuth>
  )
}

function ServiceBookInner() {
  const router = useRouter()
  // `page-data` больше не отдаёт рабочий `appointments` (всегда пустой) и не
  // поддерживает status/period — список визитов берём из /bookings/.
  const { data, isLoading, isError, refetch } = useServiceBookQuery({})
  const carId = data?.selected_car?.id
  const bookingsQuery = useBookingsQuery(
    { car_id: carId, status: 'all', period: 'all', limit: 20, offset: 0 },
    Boolean(carId),
  )

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-surfaceLight" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Skeleton.Card className="h-32" />
        <Skeleton.Box className="h-16" />
        <Skeleton.Card className="h-40" />
      </ScrollView>
    )
  }

  if (isError || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight p-6">
        <Card className="w-full items-center p-6">
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-center text-red-700">
            Не удалось загрузить сервисную книжку.
          </Text>
          <View className="mt-4">
            <Button variant="secondary" size="sm" onPress={() => refetch()}>
              Повторить
            </Button>
          </View>
        </Card>
      </View>
    )
  }

  if (data.page_state === 'NO_CARS' || !data.selected_car) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight p-6">
        <Card className="w-full items-center border-2 border-dashed border-borderLight p-10">
          <View className="mb-2 h-16 w-16 items-center justify-center rounded-2xl bg-surfaceLight">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-3xl text-brandBlue">+</Text>
          </View>
          <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-4 text-2xl uppercase text-textPrimary">
            Гараж пуст
          </Text>
          <Text className="mt-3 text-center text-sm text-textSecondary">
            Добавьте автомобиль, чтобы SCT Service сохранял историю обслуживания и рекомендовал следующие работы.
          </Text>
          <View className="mt-8">
            <Button variant="dark" size="lg" onPress={() => router.push('/garage/add')}>
              Добавить автомобиль
            </Button>
          </View>
        </Card>
      </View>
    )
  }

  const { next, upcoming, history } = splitBookings(bookingsQuery.data ?? [])

  return (
    <ScrollView className="flex-1 bg-surfaceLight" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <CarHeroCompact car={data.selected_car} />
      <RecommendationStrip recommendations={data.service_recommendations} />
      <BookServiceCTA />
      <MyGarageColumn />

      {next ? (
        <View className="gap-3">
          <SectionLabel>Ближайшие визиты</SectionLabel>
          <AppointmentRow appointment={next} highlighted />
        </View>
      ) : null}

      {upcoming.length > 0 ? (
        <View className="gap-3">
          <SectionLabel>Запланированные визиты</SectionLabel>
          {upcoming.map((a) => (
            <AppointmentRow key={a.id} appointment={a} />
          ))}
        </View>
      ) : null}

      <HistorySection history={history} />
    </ScrollView>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-textSecondary">
      {children}
    </Text>
  )
}
