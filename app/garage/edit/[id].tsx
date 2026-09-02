/**
 * Редактирование авто (RN-порт pages/EditCarPage.tsx).
 *
 * Единственное редактируемое поле — ФАКТИЧЕСКИЙ ГОД ВЫПУСКА (`production_year`).
 * Правка заказчика (2026-09-01): «вместо слова псевдоним напишем фактический
 * год автомобиля, чтобы просто была циферка». Псевдоним из формы убран — им
 * никто не пользовался, а поле занимало единственный слот. Год выводится
 * рядом с госномером в такой же чёрной рамке (см. CarHeroCompact).
 *
 * Бэк валидирует год по границам поколения: для BMW 02 (E10) примет только
 * 1966–1977, иначе вернёт 400 с текстом под полем. Это ожидаемо.
 *
 * Пробег из формы убран раньше (2026-08-29): его проставляет сервис при
 * обслуживании, и от него считаются рекомендации — клиент не должен его
 * трогать. Текущее значение показываем в шапке карточки только для чтения.
 * Госномер, VIN и модификация тоже readonly (чтобы сменить модификацию, авто
 * удаляют и добавляют заново через конфигуратор). Плюс действия: «сделать
 * активным» и «удалить» (через нативный Alert, как в детали записи).
 *
 * Переиспользует перенесённое ядро гаража: useCarQuery / useUpdateCarMutation /
 * useSetDefaultCarMutation / useDeleteCarMutation + helpers garage/lib.
 */
import { useEffect, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useCarQuery,
  useDeleteCarMutation,
  useSetDefaultCarMutation,
  useUpdateCarMutation,
} from '@/features/garage/queries'
import { RequireAuth } from '@/shared/ui/RequireAuth'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { SafeImage } from '@/shared/ui/SafeImage'
import { parseApiError } from '@/features/auth/errors'
import { formatMileage } from '@/shared/lib/format'
import { getCarPhoto, getCarProductionYear, getCarSubtitle, getCarTitle } from '@/features/garage/lib'
import { useCarPhoto } from '@/features/service-book/carPhoto'
import { PlateBadge } from '@/features/service-book/CarHeroCompact'
import { toast } from '@/shared/ui/Toast'

const editSchema = z.object({
  production_year: z
    .number({ message: 'Введите год числом' })
    .int('Только целое число')
    .min(1900, 'Слишком ранний год')
    .max(new Date().getFullYear() + 1, 'Слишком поздний год'),
})
type EditValues = z.infer<typeof editSchema>

export default function EditCarScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = params.id ? Number(params.id) : undefined
  return (
    <RequireAuth>
      <Stack.Screen options={{ headerShown: true, title: 'Редактировать авто' }} />
      <EditCarInner id={id} />
    </RequireAuth>
  )
}

function EditCarInner({ id }: { id?: number }) {
  const router = useRouter()
  const { data: car, isLoading, isError } = useCarQuery(id)
  // Фото берём из service-book: в /garage/cars/ снимка нет. Хук обязан
  // вызываться до ранних return'ов, поэтому берём id из роута, а не из
  // ответа — на момент загрузки `car` ещё undefined.
  const photoFromBook = useCarPhoto(id)
  const updateMut = useUpdateCarMutation(id ?? 0)
  const setDefaultMut = useSetDefaultCarMutation()
  const deleteMut = useDeleteCarMutation()

  const [serverError, setServerError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { production_year: undefined },
  })

  // Подставляем серверные значения, когда машина прогрузится.
  useEffect(() => {
    if (car) {
      reset({ production_year: getCarProductionYear(car) ?? undefined })
    }
  }, [car, reset])

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight">
        <Spinner />
      </View>
    )
  }

  if (isError || !car || !id) {
    return (
      <View className="flex-1 items-center justify-center bg-surfaceLight p-6">
        <Card className="w-full items-center p-6">
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-red-700">
            Не удалось загрузить автомобиль.
          </Text>
          <View className="mt-4">
            <Button variant="ghost" size="sm" onPress={() => router.replace('/garage')}>
              К гаражу
            </Button>
          </View>
        </Card>
      </View>
    )
  }

  // getCarPhoto — фолбэк на случай, если бэк однажды начнёт отдавать снимок
  // и в /garage/cars/ тоже.
  const photo = photoFromBook ?? getCarPhoto(car)
  const title = getCarTitle(car)
  const subtitle = getCarSubtitle(car)

  const onSubmit = async (values: EditValues) => {
    setServerError(null)
    try {
      // Шлём ТОЛЬКО реально изменённые поля — не тревожим бэк лишними.
      // PatchedClientGarageCarWriteRequest в OpenAPI ошибочно требует is_default —
      // на бэке поля реально опциональны, поэтому кастуем (как в вебе).
      const payload: { production_year?: number } = {}
      if (dirtyFields.production_year) payload.production_year = values.production_year

      await updateMut.mutateAsync(payload as Parameters<typeof updateMut.mutateAsync>[0])
      // Обновляем defaultValues — форма становится «чистой» (Save задизейблится).
      reset({ production_year: values.production_year })
      toast.success('Изменения сохранены')
    } catch (err) {
      const parsed = parseApiError(err, 'Не удалось сохранить изменения.')
      for (const [field, message] of Object.entries(parsed.fields)) {
        if (field === 'production_year') {
          setError(field, { type: 'server', message })
        }
      }
      setServerError(parsed.general)
    }
  }

  const onSetDefault = () => {
    if (car.is_default) return
    setServerError(null)
    setDefaultMut.mutate(id, {
      onSuccess: () => toast.success('Авто сделано активным'),
      onError: (err) =>
        setServerError(parseApiError(err, 'Не удалось сделать авто активным.').general),
    })
  }

  const onDelete = () => {
    Alert.alert(
      'Удалить автомобиль?',
      'Будут удалены история обслуживания, выполненные визиты и активные записи. Действие необратимо.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () =>
            deleteMut.mutate(id, {
              // После удаления — на вкладку «Авто»: там и оставшиеся машины, и
              // состояние «Гараж пуст», если удалили последнюю. Экран «Гараж»
              // не во вкладках, оставлять человека на нём некуда.
              onSuccess: () => router.replace('/service-book'),
              onError: (err) =>
                setServerError(parseApiError(err, 'Не удалось удалить авто.').general),
            }),
        },
      ],
    )
  }

  const saving = isSubmitting || updateMut.isPending

  return (
    <View className="flex-1 bg-surfaceLight">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {/* Hero авто */}
        <Card className="p-5">
          {car.is_default ? (
            <View className="mb-4 flex-row items-center gap-1.5 self-start rounded-lg bg-brandBlue px-2.5 py-1">
              <View className="h-1.5 w-1.5 rounded-full bg-brandYellow" />
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[10px] uppercase tracking-widest text-white">
                Активное авто
              </Text>
            </View>
          ) : null}
          <View className="flex-row items-center gap-5">
            <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-sct border border-borderLight bg-surfaceLight">
              <SafeImage
                uri={photo}
                resizeMode="cover"
                className="h-full w-full"
                fallback={
                  <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl uppercase text-borderLight">
                    {title.slice(0, 2)}
                  </Text>
                }
              />
            </View>
            <View className="flex-1">
              <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={2} className="text-2xl uppercase leading-none text-textPrimary">
                {title}
              </Text>
              {subtitle ? (
                <Text style={{ fontFamily: 'Inter_700Bold' }} numberOfLines={1} className="mt-1 text-[12px] uppercase text-textSecondary">
                  {subtitle}
                </Text>
              ) : null}
              <View className="mt-3 flex-row flex-wrap items-center gap-2">
                <PlateBadge>{car.license_plate || '—'}</PlateBadge>
                {/* Год в такой же рамке, как на «Авто», «Главной», в гараже и
                    «Услугах» — единый бейдж на всех экранах. */}
                {getCarProductionYear(car) ? (
                  <PlateBadge>{String(getCarProductionYear(car))}</PlateBadge>
                ) : null}
                {typeof car.latest_mileage_km === 'number' && car.latest_mileage_km > 0 ? (
                  <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-[10px] uppercase tracking-widest text-textSecondary">
                    Пробег: {formatMileage(car.latest_mileage_km)}
                  </Text>
                ) : null}
              </View>
              {car.vin_code ? (
                <Text className="mt-2 text-[10px] uppercase tracking-widest text-textSecondary">
                  VIN: {car.vin_code}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Форма редактирования */}
        <Card className="gap-5 p-5">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-base uppercase text-textPrimary">
            Редактируемые поля
          </Text>

          <Controller
            control={control}
            name="production_year"
            render={({ field }) => (
              <Input
                label="Фактический год автомобиля"
                placeholder="2019"
                keyboardType="number-pad"
                maxLength={4}
                value={field.value != null ? String(field.value) : ''}
                onChangeText={(t) => {
                  const digits = t.replace(/[^\d]/g, '')
                  field.onChange(digits ? Number(digits) : undefined)
                }}
                onBlur={field.onBlur}
                error={errors.production_year?.message}
              />
            )}
          />

          {serverError ? (
            <View className="rounded-sct border border-red-200 bg-red-50 p-3">
              <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-sm text-red-700">{serverError}</Text>
            </View>
          ) : null}

          <View className="flex-row gap-3">
            <View className="flex-1">
              {/* «Отмена» возвращает туда, откуда пришли (главная, «Авто»,
                  гараж), а не всегда в гараж: в редактирование попадают
                  нажатием на карточку авто с разных экранов. Экрана «Гараж»
                  нет во вкладках, и выкидывать в него — сбивать человека с
                  пути. Некуда возвращаться (прямой диплинк) — тогда гараж. */}
              <Button
                variant="ghost"
                fullWidth
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/garage'))}
              >
                Отмена
              </Button>
            </View>
            <View className="flex-1">
              <Button fullWidth loading={saving} disabled={!isDirty} onPress={handleSubmit(onSubmit)}>
                Сохранить
              </Button>
            </View>
          </View>
        </Card>

        {/* Действия */}
        <Card className="gap-4 p-5">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-base uppercase text-textPrimary">
            Действия
          </Text>

          {!car.is_default ? (
            <View className="gap-3 rounded-sct border border-borderLight bg-surfaceLight p-4">
              <View>
                <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-sm text-textPrimary">
                  Сделать авто активным
                </Text>
                <Text className="mt-0.5 text-xs text-textSecondary">
                  Услуги и сервисная книжка будут подбираться под эту машину.
                </Text>
              </View>
              <Button variant="secondary" size="sm" loading={setDefaultMut.isPending} onPress={onSetDefault}>
                Сделать активной
              </Button>
            </View>
          ) : null}

          <View className="gap-3 rounded-sct border border-red-100 bg-red-50/40 p-4">
            <View>
              <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-sm text-red-700">
                Удалить автомобиль
              </Text>
              <Text className="mt-0.5 text-xs text-textSecondary">
                История обслуживания и записи будут удалены безвозвратно.
              </Text>
            </View>
            <Button variant="danger" size="sm" loading={deleteMut.isPending} onPress={onDelete}>
              Удалить
            </Button>
          </View>
        </Card>
      </ScrollView>
    </View>
  )
}
