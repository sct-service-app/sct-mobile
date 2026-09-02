/**
 * Тёмный hero главной — RN-порт features/home/HomeHero.tsx.
 * Гость: маркетинг + Регистрация/Вход. Авторизованный: приветствие по имени +
 * CTA (записаться/добавить авто/услуги в зависимости от hasCars).
 *
 * Фон-фото (как в макете screens/main): когда придут брендовые фото — положи
 * файлы в `assets/` и подставь `require` в HERO_GUEST / HERO_ADVISOR ниже.
 * Пока source пуст — рисуем декоративную заглушку (navy + водяной знак SCT).
 * Если фото будет доступно по URL, а не файлом — можно отдать строку в
 * `source={{ uri }}` вместо require.
 */
import type { ReactNode } from 'react'
import {
  ImageBackground,
  Pressable,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/features/auth/store'

// Брендовые фото hero (лежат в assets/). Гость — авто на сервисе,
// авторизованный — мастер SCT. Заменить файлы → обновятся автоматически.
const HERO_GUEST: ImageSourcePropType = require('../../../assets/hero-guest.jpg')
const HERO_ADVISOR: ImageSourcePropType = require('../../../assets/hero-advisor.jpg')

export function HomeHero({ hasCars }: { hasCars: boolean }) {
  const router = useRouter()
  const phase = useAuthStore((s) => s.phase)
  const profile = useAuthStore((s) => s.profile)
  const isAuthed = phase === 'authed'

  if (!isAuthed) {
    return (
      <HeroShell variant="guest" source={HERO_GUEST}>
        <View className="self-start rounded-full bg-white/10 px-4 py-1.5">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-white/80">
            Официальный автосервис
          </Text>
        </View>
        <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-5 text-3xl uppercase leading-tight text-white">
          Премиальное обслуживание вашего автомобиля
        </Text>
        <Text className="mt-4 text-sm leading-relaxed text-white/70">
          Прозрачные цены, гарантия на все виды работ и персональный подход. Зарегистрируйтесь, добавьте авто и получите доступ к акциям и онлайн-записи.
        </Text>
        <View className="mt-8 gap-3">
          <HeroButton label="Зарегистрироваться" tone="yellow" onPress={() => router.push('/register')} />
          <HeroButton label="Войти по номеру" tone="translucent" onPress={() => router.push('/login')} />
        </View>
      </HeroShell>
    )
  }

  const firstName = profile?.first_name?.trim()
  const title = firstName
    ? `${firstName.toUpperCase()}, ВАШ АВТОМОБИЛЬ ГОТОВ К СЕРВИСУ`
    : 'ВАШ АВТОМОБИЛЬ ГОТОВ К СЕРВИСУ'

  return (
    <HeroShell variant="authed" source={HERO_ADVISOR}>
      <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl uppercase leading-tight text-white">
        {title}
      </Text>
      <Text className="mt-3 text-sm leading-relaxed text-white/70">
        Мы подобрали актуальные пакеты, акции и ближайшие слоты обслуживания для вашего автомобиля.
      </Text>
      {/* Кнопка «Добавить авто» убрана по правке заказчика: «с главной
          добавлять авто не нужно, для этого есть вкладка Авто». Блок заодно
          стал ниже — просили ужать его до кнопки «Записаться на сервис».
          У клиента без машин вторая кнопка остаётся: иначе добавить первое
          авто с главной будет нечем. */}
      <View className="mt-5 flex-row flex-wrap gap-3">
        {hasCars ? (
          <HeroButton label="Записаться на сервис" tone="light" onPress={() => router.push('/services')} />
        ) : (
          <>
            <HeroButton label="Добавить авто" tone="light" onPress={() => router.push('/garage/add')} />
            <HeroButton label="Все услуги" tone="translucent" onPress={() => router.push('/services')} />
          </>
        )}
      </View>
    </HeroShell>
  )
}

/**
 * Обёртка hero с фоновым фото.
 *   guest  — фото авто (субъект справа кадра) ровно по центру (ImageBackground);
 *   authed — мастер по центру кадра → якорим фото к левому краю, чтобы он ушёл
 *            вправо, а слева (под текстом) затемняем сильнее.
 * Без source — navy с водяным знаком SCT (заглушка).
 */
function HeroShell({
  variant,
  source,
  children,
}: {
  variant: 'guest' | 'authed'
  source?: ImageSourcePropType
  children: ReactNode
}) {
  if (!source) {
    return (
      <View className="overflow-hidden rounded-sct-lg bg-navy p-6">
        <Text
          style={{ fontFamily: 'Inter_900Black' }}
          className="absolute right-3 top-1 text-6xl text-white/5"
          pointerEvents="none"
        >
          SCT
        </Text>
        {children}
      </View>
    )
  }

  if (variant === 'authed') {
    // ImageBackground с cover всегда заполняет карточку (раньше абсолютный
    // Image с aspectRatio без ширины «съезжал» вправо). Слева усиливаем
    // затемнение под текст.
    return (
      <ImageBackground source={source} resizeMode="cover" className="overflow-hidden rounded-sct-lg bg-navy">
        <View className="absolute inset-0 bg-navy/45" />
        <View className="absolute inset-y-0 left-0 w-3/5 bg-navy/40" />
        <View className="p-6">{children}</View>
      </ImageBackground>
    )
  }

  return (
    <ImageBackground source={source} resizeMode="cover" className="overflow-hidden rounded-sct-lg bg-navy">
      <View className="absolute inset-0 bg-navy/70" />
      <View className="p-6">{children}</View>
    </ImageBackground>
  )
}

function HeroButton({
  label,
  tone,
  onPress,
}: {
  label: string
  tone: 'light' | 'translucent' | 'yellow'
  onPress: () => void
}) {
  const box =
    tone === 'light'
      ? 'bg-white'
      : tone === 'yellow'
        ? 'bg-brandYellow'
        : 'border border-white/20 bg-white/10'
  const text = tone === 'translucent' ? 'text-white' : 'text-textPrimary'
  return (
    <Pressable onPress={onPress} className={`items-center rounded-sct px-5 py-3 active:opacity-90 ${box}`}>
      <Text style={{ fontFamily: 'Inter_900Black' }} className={`text-[11px] uppercase tracking-widest ${text}`}>
        {label}
      </Text>
    </Pressable>
  )
}
