/**
 * Контакты и филиалы — порт pages/ContactsPage.tsx. Источник —
 * useServiceStationsQuery. Гость → GuestPrompt (бэк требует JWT даже для
 * филиалов). Веб-карта (Leaflet/BranchesMap) опущена — на телефоне список
 * филиалов; при необходимости позже добавить react-native-maps.
 */
import { type ReactNode } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useServiceStationsQuery } from '@/features/service-stations/queries'
import { GuestPrompt } from '@/features/auth/GuestPrompt'
import { useAuthStore } from '@/features/auth/store'
import { Card } from '@/shared/ui/Card'
import { Spinner } from '@/shared/ui/Spinner'
import { Button } from '@/shared/ui/Button'
import { SafeImage } from '@/shared/ui/SafeImage'
import type { ServiceStation } from '@/features/service-stations/types'

function stationHours(station: ServiceStation): string | null {
  const days = station.schedule ?? []
  const open = days.filter((d) => !d.is_closed)
  if (open.length === 0) return null
  const labels = new Set(open.map((d) => d.label))
  if (labels.size === 1) return `Ежедневно ${open[0].label}`
  const today = days.find((d) => d.is_today)
  if (today) return today.is_closed ? 'Сегодня выходной' : `Сегодня ${today.label}`
  return open[0].label
}

export default function ContactsScreen() {
  const isAuthed = useAuthStore((s) => s.phase === 'authed')
  const { data, isLoading, isError, refetch } = useServiceStationsQuery({ days: 7 })

  if (!isAuthed) {
    return (
      <GuestPrompt
        title="Сеть филиалов SCT Service"
        description="Чтобы посмотреть адреса, расписание и записаться в ближайший филиал — войдите или зарегистрируйтесь."
      />
    )
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight">
        <Spinner />
      </View>
    )
  }

  if (isError || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight p-6">
        <Card className="w-full items-center p-6">
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-red-700">
            Не удалось загрузить филиалы.
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

  return (
    <ScrollView className="flex-1 bg-surfaceLight" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-3xl uppercase text-textPrimary">
          Наши филиалы
        </Text>
        <Text className="mt-2 text-sm text-textSecondary">
          Выберите филиал для получения подробной информации, контактов и записи.
        </Text>
      </View>

      {data.results.map((station) => (
        <StationCard key={station.id} station={station} />
      ))}
    </ScrollView>
  )
}

function StationCard({ station }: { station: ServiceStation }) {
  const router = useRouter()
  const hours = stationHours(station)

  return (
    <Card className="p-5">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-brandBlue">
            Сервис-центр
          </Text>
          <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-1 text-lg uppercase text-textPrimary">
            {station.name}
          </Text>
        </View>
        {station.photo ? (
          <View className="h-14 w-20 overflow-hidden rounded-lg border border-borderLight bg-surfaceLight">
            <SafeImage uri={station.photo} resizeMode="cover" className="h-full w-full" />
          </View>
        ) : null}
      </View>

      <View className="mt-4 gap-2.5">
        <Row icon="location-outline">
          <Text style={{ fontFamily: 'Inter_500Medium' }} className="flex-1 text-sm text-textPrimary">
            {station.city}, {station.address}
          </Text>
        </Row>
        {station.phone ? (
          <Row icon="call-outline">
            <Pressable onPress={() => Linking.openURL(`tel:${station.phone!.replace(/[^+\d]/g, '')}`)}>
              <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-sm text-brandBlue">{station.phone}</Text>
            </Pressable>
          </Row>
        ) : null}
        {station.two_gis_url ? (
          <Row icon="navigate-outline">
            <Pressable onPress={() => Linking.openURL(station.two_gis_url!)}>
              <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-sm text-brandBlue">Открыть в 2ГИС</Text>
            </Pressable>
          </Row>
        ) : null}
        {hours ? (
          <Row icon="time-outline">
            <Text className="flex-1 text-sm text-textSecondary">{hours}</Text>
          </Row>
        ) : null}
      </View>

      <View className="mt-4 flex-row items-center justify-end border-t border-borderLight pt-4">
        <Button variant="primary" size="sm" onPress={() => router.push('/services')}>
          Записаться на сервис
        </Button>
      </View>
    </Card>
  )
}

function Row({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  return (
    <View className="flex-row items-start gap-3">
      <Ionicons name={icon} size={16} color="#7A8694" style={{ marginTop: 2 }} />
      {children}
    </View>
  )
}
