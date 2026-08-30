/**
 * Детальная пакета услуги — порт pages/PackageDetailPage.tsx (одна колонка под
 * телефон). Данные через перенесённый usePackageQuery. Состояния: гость/loading/
 * error/data. Внизу — закреплённый бар «Оформить запись» → /services/[id]/book.
 *
 * Упрощения: градиент-бар → сплошной accent; липкий сайдбар → обычный поток +
 * нижний бар. Пиксель-парити не цель.
 */
import { useMemo, type ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { usePackageQuery } from '@/features/packages/queries'
import { useAuthStore } from '@/features/auth/store'
import { GuestPrompt } from '@/features/auth/GuestPrompt'
import { Spinner } from '@/shared/ui/Spinner'
import { Card } from '@/shared/ui/Card'
import { SafeImage } from '@/shared/ui/SafeImage'
import { Button } from '@/shared/ui/Button'
import { BottomBar } from '@/shared/ui/BottomBar'
import { formatMoney } from '@/shared/lib/format'
import { getPackageShortTitle } from '@/features/packages/lib'

export default function PackageDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()
  const id = params.id ? Number(params.id) : undefined
  const isAuthed = useAuthStore((s) => s.phase === 'authed')
  const { data, isLoading, isError, refetch } = usePackageQuery(id)

  const derived = useMemo(() => {
    if (!data) return null
    const hasDiscount = data.discount_type !== 'NONE'
    const economy = Number(data.base_total) - Number(data.final_price)
    return {
      shortTitle: getPackageShortTitle(data),
      hasDiscount,
      price: formatMoney(data.final_price, data.currency),
      showEconomy: hasDiscount && Number.isFinite(economy) && economy > 0,
      economy,
      items: data.package_items ?? [],
      accent: data.category?.color || '#1F5FAF',
    }
  }, [data])

  if (!isAuthed) {
    return (
      <View className="flex-1">
        <Stack.Screen options={{ headerShown: true, title: 'Пакет' }} />
        <GuestPrompt
          title="Услуга доступна после регистрации"
          description="Чтобы увидеть состав пакета, цену и записаться на сервис, зарегистрируйтесь или войдите."
        />
      </View>
    )
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight">
        <Stack.Screen options={{ headerShown: true, title: 'Пакет' }} />
        <Spinner />
      </View>
    )
  }

  if (isError || !data || !derived) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight p-6">
        <Stack.Screen options={{ headerShown: true, title: 'Пакет' }} />
        <Card className="w-full items-center p-6">
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-red-700">
            Пакет не найден или недоступен.
          </Text>
          <View className="mt-4 flex-row gap-3">
            <Button variant="secondary" size="sm" onPress={() => refetch()}>
              Повторить
            </Button>
            <Button variant="ghost" size="sm" onPress={() => router.replace('/services')}>
              К услугам
            </Button>
          </View>
        </Card>
      </View>
    )
  }

  const { shortTitle, hasDiscount, price, showEconomy, economy, items, accent } = derived
  const goBook = () => router.push(`/services/${data.id}/book`)

  return (
    <View className="flex-1 bg-surfaceLight">
      <Stack.Screen options={{ headerShown: true, title: 'Пакет' }} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Фото пакета. На вебе оно давно есть в сайдбаре карточки, а в
            приложении блока не было вовсе — заказчик прислал скрин «в пакете
            нету фото». Если картинки нет, ничего не рисуем: пустая серая
            плашка выглядела бы хуже, чем её отсутствие. */}
        {data.image_url ? (
          <Card className="overflow-hidden p-0">
            <View className="h-44 w-full bg-surfaceLight">
              <SafeImage uri={data.image_url} resizeMode="cover" className="h-full w-full" />
            </View>
          </Card>
        ) : null}

        {/* Hero */}
        <Card className="overflow-hidden p-5">
          <View style={{ backgroundColor: accent }} className="absolute inset-x-0 top-0 h-1.5" />
          <View className="mb-4 flex-row flex-wrap gap-2">
            <Pill className="bg-blue-50" textClassName="text-brandBlue">Пакет под ваш авто</Pill>
            {data.category?.name ? (
              <Pill className="bg-green-50" textClassName="text-green-700">{data.category.name}</Pill>
            ) : null}
            {data.has_promotion ? (
              <Pill className="bg-orange-50" textClassName="text-orange-700">Акция активна</Pill>
            ) : null}
          </View>

          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl uppercase leading-tight text-textPrimary">
            {shortTitle} <Text className="text-brandBlue">{data.car_title}</Text>
          </Text>

          {data.description ? (
            <Text numberOfLines={3} className="mt-4 text-base leading-relaxed text-textSecondary">
              {data.description}
            </Text>
          ) : null}

          <View className="mt-5 gap-3">
            <MiniCard label="Категория" value={data.category?.name || 'Сервис'} />
            <MiniCard label="Автомобиль" value={data.car_title} />
            <MiniCard label="Стоимость" value={price} accent />
          </View>
        </Card>

        {/* Промо */}
        {data.has_promotion && (data.promotion_title || hasDiscount) ? (
          <View className="rounded-sct-lg border border-l-4 border-borderLight bg-brandYellow/10 p-5" style={{ borderLeftColor: '#F2C94C' }}>
            <Text className="text-[10px] uppercase tracking-widest text-textSecondary">Спецпредложение</Text>
            <View className="mt-2 flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <Text style={{ fontFamily: 'Inter_900Black' }} className="text-base uppercase text-textPrimary">
                  {data.promotion_title || 'Скидка на пакет обслуживания'}
                </Text>
                {data.promotion_terms ? (
                  <Text className="mt-2 text-sm leading-relaxed text-textSecondary">{data.promotion_terms}</Text>
                ) : null}
              </View>
              {hasDiscount && data.discount_type === 'PERCENT' ? (
                <View className="rounded-sct bg-brandYellow px-3 py-2">
                  <Text style={{ fontFamily: 'Inter_900Black' }} className="text-lg text-textPrimary">
                    −{Number(data.discount_percent)}%
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Состав пакета */}
        {items.length > 0 ? (
          <Card className="overflow-hidden">
            <View className="flex-row items-center justify-between border-b border-borderLight bg-surfaceLight px-5 py-4">
              <Text className="text-[11px] uppercase tracking-widest text-textSecondary">Состав пакета</Text>
              <Text className="text-[11px] uppercase tracking-widest text-textSecondary">{items.length} поз.</Text>
            </View>
            {items.map((item) => (
              <View key={item.id} className="flex-row items-center justify-between gap-4 border-b border-borderLight px-5 py-3.5">
                <View className="flex-1">
                  <Text style={{ fontFamily: 'Inter_700Bold' }} numberOfLines={1} className="text-sm text-textPrimary">
                    {item.item_name}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-0.5 text-[10px] uppercase tracking-widest text-brandBlue">
                    {item.item_type === 'SERVICE' ? 'Работа' : 'Товар'}
                  </Text>
                </View>
                <Text style={{ fontFamily: 'Inter_900Black' }} className="text-sm text-textPrimary">
                  {formatQty(item.quantity, item.item_type)}
                </Text>
              </View>
            ))}
            <View className="flex-row items-center justify-between bg-surfaceLight px-5 py-4">
              <Text className="text-[11px] uppercase tracking-widest text-textSecondary">Итого</Text>
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-lg text-brandBlue">{price}</Text>
            </View>
          </Card>
        ) : null}

        {/* Описание */}
        {data.description ? (
          <Card className="p-5">
            <Text className="text-[11px] uppercase tracking-widest text-brandBlue">Описание</Text>
            <Text style={{ fontFamily: 'Inter_900Black' }} className="mb-3 mt-1 text-xl uppercase text-textPrimary">
              Описание пакета
            </Text>
            <Text className="text-sm leading-relaxed text-textPrimary">{data.description}</Text>
          </Card>
        ) : null}

        {showEconomy ? (
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-center text-[12px] uppercase tracking-widest text-green-600">
            Экономия {formatMoney(economy, data.currency)}
          </Text>
        ) : null}
      </ScrollView>

      {/* Нижний бар с ценой и CTA */}
      <BottomBar className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-[10px] uppercase tracking-widest text-textSecondary">К оплате</Text>
          <View className="flex-row items-baseline gap-2">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-base text-brandBlue">{price}</Text>
            {showEconomy ? (
              <Text className="text-xs text-textSecondary line-through">
                {formatMoney(data.base_total, data.currency)}
              </Text>
            ) : null}
          </View>
        </View>
        <Button size="md" onPress={goBook}>
          Оформить запись
        </Button>
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

function formatQty(quantity: string | number | null | undefined, itemType: string): string {
  if (quantity === null || quantity === undefined) return ''
  const num = typeof quantity === 'string' ? Number(quantity) : quantity
  if (!Number.isFinite(num)) return String(quantity)
  const unit = itemType === 'SERVICE' ? 'усл.' : 'шт.'
  const formatted = num % 1 === 0 ? String(num) : String(num).replace(/0+$/, '').replace(/\.$/, '')
  return `${formatted} ${unit}`
}
