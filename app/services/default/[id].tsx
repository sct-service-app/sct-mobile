/**
 * Детальная дефолтной услуги (RN-порт pages/DefaultServiceDetailPage.tsx).
 *
 * Источник: useDefaultServiceQuery (требует JWT → за RequireAuth). Реальные
 * поля: title / hero_eyebrow / short_description / description / price(_note) /
 * availability_* / important_note / what_is_included[] / why_price_depends /
 * category. «Как проходит обслуживание» — нейтральная статика (в API нет).
 *
 * CTA «Записаться» → /services/[id]/book?type=default — ветка дефолтной услуги
 * в booking-wizard (шлёт default_service_page_id вместо service_package_id).
 */
import { type ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useDefaultServiceQuery } from '@/features/packages/queries'
import { RequireAuth } from '@/shared/ui/RequireAuth'
import { Spinner } from '@/shared/ui/Spinner'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { SafeImage } from '@/shared/ui/SafeImage'
import { BottomBar } from '@/shared/ui/BottomBar'

/** Нейтральные шаги процесса — в API их нет, одинаковы для любой услуги. */
const PROCESS_STEPS = [
  { n: '01', title: 'Заявка', text: 'Оставляете заявку на услугу с выбором филиала и удобного времени.' },
  { n: '02', title: 'Осмотр авто', text: 'Мастер проверяет автомобиль и подбирает подходящие материалы.' },
  { n: '03', title: 'Расчёт стоимости', text: 'Согласовываем точную цену именно под ваш автомобиль.' },
  { n: '04', title: 'Выполнение работ', text: 'Выполняем услугу и контролируем результат перед выдачей.' },
]

export default function DefaultServiceDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = params.id ? Number(params.id) : undefined
  return (
    <RequireAuth>
      <Stack.Screen options={{ headerShown: true, title: 'Услуга' }} />
      <DefaultServiceInner id={id} />
    </RequireAuth>
  )
}

function DefaultServiceInner({ id }: { id?: number }) {
  const router = useRouter()
  const { data, isLoading, isError } = useDefaultServiceQuery(id)

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight">
        <Spinner />
      </View>
    )
  }

  if (isError || !data || !id) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight p-6">
        <Card className="w-full items-center p-6">
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-red-700">Услуга не найдена.</Text>
          <View className="mt-4">
            <Button variant="ghost" size="sm" onPress={() => router.replace('/services')}>К услугам</Button>
          </View>
        </Card>
      </View>
    )
  }

  const priceText = data.price?.display || data.price_note || 'Цена рассчитывается индивидуально'
  const included = Array.isArray(data.what_is_included) ? data.what_is_included.filter(Boolean) : []
  const why = normalizeList(data.why_price_depends)
  const accent = data.category?.color || '#1F5FAF'
  const goBook = () => router.push(`/services/${id}/book?type=default`)

  return (
    <View className="flex-1 bg-surfaceLight">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {/* Hero */}
        <Card className="overflow-hidden p-5">
          <View style={{ backgroundColor: accent }} className="absolute inset-x-0 top-0 h-1.5" />
          {/* Картинка услуги (бэк PR #11). Пустая строка — картинки нет. */}
          {data.image_url ? (
            <View
              style={{ aspectRatio: 2 }}
              className="mb-4 w-full items-center justify-center overflow-hidden rounded-xl bg-blue-50"
            >
              <SafeImage uri={data.image_url} resizeMode="contain" className="h-full w-full" />
            </View>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            <Pill className="bg-blue-50" textClassName="text-brandBlue">Услуга для вашего авто</Pill>
            {data.category?.name ? (
              <Pill className="bg-green-50" textClassName="text-green-700">{data.category.name}</Pill>
            ) : null}
            <Pill className="bg-orange-50" textClassName="text-orange-700">{priceText}</Pill>
          </View>
          <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-4 text-[11px] uppercase tracking-widest text-brandBlue">
            {data.hero_eyebrow || 'Детальная информация об услуге'}
          </Text>
          <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-1 text-3xl uppercase leading-none text-textPrimary">
            {data.title}
          </Text>
          {data.short_description || data.description ? (
            <Text className="mt-4 text-base leading-relaxed text-textSecondary">
              {data.short_description || data.description}
            </Text>
          ) : null}
          <View className="mt-5 gap-3">
            <MiniCard label="Тип услуги" value={data.category?.name || 'Сервис'} />
            <MiniCard label="Расчёт цены" value="После заявки и осмотра" />
            <MiniCard label="Стоимость" value={priceText} accent />
          </View>
        </Card>

        {/* Почему индивидуально */}
        {data.availability_title || data.availability_message ? (
          <Card className="p-5">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-brandBlue">
              Почему индивидуально
            </Text>
            {data.availability_title ? (
              <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-2 text-2xl uppercase tracking-tight text-textPrimary">
                {data.availability_title}
              </Text>
            ) : null}
            {data.availability_message ? (
              <Text className="mt-2 text-sm leading-relaxed text-textSecondary">{data.availability_message}</Text>
            ) : null}
          </Card>
        ) : null}

        {/* Важный момент */}
        {data.important_note ? (
          <View className="rounded-sct-lg border border-blue-100 bg-blue-50 p-5">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-textSecondary">
              Важный момент
            </Text>
            <Text style={{ fontFamily: 'Inter_700Bold' }} className="mt-2 text-sm leading-relaxed text-textPrimary">
              {data.important_note}
            </Text>
          </View>
        ) : null}

        {/* Что входит */}
        {included.length > 0 ? (
          <Card className="p-5">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-brandBlue">Что входит</Text>
            <Text style={{ fontFamily: 'Inter_900Black' }} className="mb-4 mt-1 text-2xl uppercase tracking-tight text-textPrimary">
              Состав услуги
            </Text>
            <View className="gap-3">
              {included.map((it, i) => (
                <View key={i} className="flex-row items-start gap-3 rounded-sct border border-borderLight bg-surfaceLight p-4">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-brandBlue/10">
                    <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] text-brandBlue">{i + 1}</Text>
                  </View>
                  <Text style={{ fontFamily: 'Inter_700Bold' }} className="flex-1 text-sm text-textPrimary">{it}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Почему цена индивидуально */}
        {why.length > 0 ? (
          <Card className="p-5">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-brandBlue">Стоимость</Text>
            <Text style={{ fontFamily: 'Inter_900Black' }} className="mb-4 mt-1 text-2xl uppercase tracking-tight text-textPrimary">
              Почему цена рассчитывается индивидуально
            </Text>
            <View className="gap-3">
              {why.map((it, i) => (
                <View key={i} className="rounded-sct border border-borderLight bg-surfaceLight p-4">
                  <Text className="text-sm leading-relaxed text-textSecondary">{it}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Как проходит обслуживание (статика) */}
        <Card className="p-5">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase tracking-widest text-brandBlue">Процесс</Text>
          <Text style={{ fontFamily: 'Inter_900Black' }} className="mb-4 mt-1 text-2xl uppercase tracking-tight text-textPrimary">
            Как проходит обслуживание
          </Text>
          <View className="gap-3">
            {PROCESS_STEPS.map((s) => (
              <View key={s.n} className="rounded-sct border border-borderLight bg-surfaceLight p-4">
                <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-brandBlue">Шаг {s.n}</Text>
                <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-1 text-base text-textPrimary">{s.title}</Text>
                <Text className="mt-1 text-sm leading-relaxed text-textSecondary">{s.text}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Button variant="secondary" size="lg" fullWidth onPress={() => router.push('/contacts')}>
          Уточнить стоимость
        </Button>
      </ScrollView>

      {/* Sticky: цена + Записаться */}
      <BottomBar className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-[10px] uppercase tracking-widest text-textSecondary">Стоимость</Text>
          <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="text-sm text-brandBlue">{priceText}</Text>
        </View>
        <Button size="md" onPress={goBook}>Записаться</Button>
      </BottomBar>
    </View>
  )
}

function Pill({
  children,
  className = '',
  textClassName = '',
}: {
  children: ReactNode
  className?: string
  textClassName?: string
}) {
  return (
    <View className={`rounded-full px-3.5 py-2 ${className}`}>
      <Text style={{ fontFamily: 'Inter_900Black' }} className={`text-[11px] uppercase tracking-widest ${textClassName}`}>
        {children}
      </Text>
    </View>
  )
}

function MiniCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="rounded-sct border border-borderLight bg-surfaceLight p-4">
      <Text className="mb-2 text-[10px] uppercase tracking-widest text-textSecondary">{label}</Text>
      <Text style={{ fontFamily: 'Inter_900Black' }} className={`text-base ${accent ? 'text-brandBlue' : 'text-textPrimary'}`}>
        {value}
      </Text>
    </View>
  )
}

function normalizeList(v: string[] | string | undefined): string[] {
  if (Array.isArray(v)) return v.filter(Boolean)
  if (typeof v === 'string' && v.trim()) return [v.trim()]
  return []
}
