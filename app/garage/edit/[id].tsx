/**
 * Редактирование авто (RN-порт pages/EditCarPage.tsx).
 *
 * Редактируемые поля — ГОСНОМЕР и ФАКТИЧЕСКИЙ ГОД ВЫПУСКА.
 *
 * Год (`production_year`) — правка заказчика от 01.09: «вместо слова псевдоним
 * напишем фактический год автомобиля, чтобы просто была циферка». Псевдоним из
 * формы убран — им никто не пользовался, а поле занимало единственный слот.
 * Год выводится рядом с госномером в такой же чёрной рамке (см. PlateBadge).
 *
 * Госномер (`license_plate`) — правка от 05.09, шеф просил лично: «если я
 * завтра повешу на эту же машину другой номер, я должен мочь его тут
 * отредактировать». Проверка та же, что при добавлении авто (казахстанский
 * формат с регионом), значение нормализуется перед отправкой.
 *
 * Сверху — CarSummaryCard: тот же модуль, что на «Главной» (большое фото,
 * название, номер, год, пробег/замена масла/ближайший визит), но без кнопки
 * «Записаться на сервис» — тоже правка от 05.09.
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
import { parseApiError } from '@/features/auth/errors'
import {
  LICENSE_PLATE_ERROR,
  isValidLicensePlate,
  normalizeLicensePlate,
} from '@/shared/lib/license-plate'
import { getCarProductionYear } from '@/features/garage/lib'
import { CarSummaryCard } from '@/features/garage/CarSummaryCard'
import { toast } from '@/shared/ui/Toast'

const editSchema = z.object({
  // Формат госномера проверяем НЕ здесь, а в onSubmit и только если поле
  // трогали: у машин, заведённых до 29.08.2026, в базе лежат огрызки вроде
  // «577AXG» без региона, и строгая схема не давала бы такому владельцу
  // сохранить даже год, пока он не перепишет номер.
  license_plate: z.string().min(1, 'Введите госномер'),
  // Год необязателен: у большинства машин `production_year` пустой, и
  // требовать его ради правки одного госномера нельзя.
  production_year: z
    .number({ message: 'Введите год числом' })
    .int('Только целое число')
    .min(1900, 'Слишком ранний год')
    .max(new Date().getFullYear() + 1, 'Слишком поздний год')
    .optional(),
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
    defaultValues: { license_plate: '', production_year: undefined },
  })

  // Подставляем серверные значения, когда машина прогрузится.
  useEffect(() => {
    if (car) {
      reset({
        license_plate: car.license_plate ?? '',
        production_year: getCarProductionYear(car) ?? undefined,
      })
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

  const onSubmit = async (values: EditValues) => {
    setServerError(null)
    try {
      // Шлём ТОЛЬКО реально изменённые поля — не тревожим бэк лишними.
      // PatchedClientGarageCarWriteRequest в OpenAPI ошибочно требует is_default —
      // на бэке поля реально опциональны, поэтому кастуем (как в вебе).
      const payload: { production_year?: number; license_plate?: string } = {}
      if (dirtyFields.license_plate) {
        if (!isValidLicensePlate(values.license_plate)) {
          setError('license_plate', { type: 'validate', message: LICENSE_PLATE_ERROR })
          return
        }
        payload.license_plate = normalizeLicensePlate(values.license_plate)
      }
      if (dirtyFields.production_year && values.production_year != null) {
        payload.production_year = values.production_year
      }

      await updateMut.mutateAsync(payload as Parameters<typeof updateMut.mutateAsync>[0])
      // Обновляем defaultValues — форма становится «чистой» (Save задизейблится).
      reset({
        license_plate: normalizeLicensePlate(values.license_plate),
        production_year: values.production_year,
      })
      toast.success('Изменения сохранены')
    } catch (err) {
      const parsed = parseApiError(err, 'Не удалось сохранить изменения.')
      for (const [field, message] of Object.entries(parsed.fields)) {
        if (field === 'production_year' || field === 'license_plate') {
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
        {/* Сводка по авто — модуль с «Главной» без кнопки записи (правка 05.09). */}
        <CarSummaryCard car={car} />

        {/* Форма редактирования */}
        <Card className="gap-5 p-5">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-base uppercase text-textPrimary">
            Редактируемые поля
          </Text>

          <Controller
            control={control}
            name="license_plate"
            render={({ field }) => (
              <Input
                label="Госномер"
                placeholder="123ABC02"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.license_plate?.message}
              />
            )}
          />

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
