/**
 * Редактирование авто (RN-порт pages/EditCarPage.tsx).
 *
 * PATCH /garage/cars/{id}/ меняет только `nickname` и `mileage_km` (бэк):
 * госномер, VIN и модификация — readonly (чтобы сменить модификацию, авто
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
import { getCarPhoto, getCarSubtitle, getCarTitle } from '@/features/garage/lib'
import { toast } from '@/shared/ui/Toast'

const editSchema = z.object({
  nickname: z.string().trim().max(255, 'Не больше 255 символов'),
  mileage_km: z
    .number()
    .int('Целое число')
    .min(0, 'Пробег не может быть отрицательным')
    .max(9_999_999, 'Слишком большое значение'),
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
    defaultValues: { nickname: '', mileage_km: 0 },
  })

  // Подставляем серверные значения, когда машина прогрузится.
  useEffect(() => {
    if (car) {
      reset({
        nickname: car.nickname ?? '',
        mileage_km: car.latest_mileage_km ?? 0,
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

  const photo = getCarPhoto(car)
  const title = getCarTitle(car)
  const subtitle = getCarSubtitle(car)

  const onSubmit = async (values: EditValues) => {
    setServerError(null)
    try {
      // Шлём ТОЛЬКО реально изменённые поля. Иначе на каждом сохранении летел
      // весь набор, и это ломалось в двух случаях:
      //   1) у авто ещё нет пробега → в форме 0 → бэк отвечает 400
      //      «Ensure this value is greater than or equal to 1», и переименовать
      //      машину становится невозможно в принципе;
      //   2) повторная отправка того же пробега без изменений.
      // PatchedClientGarageCarWriteRequest в OpenAPI ошибочно требует is_default —
      // на бэке поля реально опциональны, поэтому кастуем (как в вебе).
      const payload: { nickname?: string; mileage_km?: number } = {}
      if (dirtyFields.nickname) payload.nickname = values.nickname
      if (dirtyFields.mileage_km) payload.mileage_km = values.mileage_km

      await updateMut.mutateAsync(payload as Parameters<typeof updateMut.mutateAsync>[0])
      // Обновляем defaultValues — форма становится «чистой» (Save задизейблится).
      reset({ nickname: values.nickname, mileage_km: values.mileage_km })
      toast.success('Изменения сохранены')
    } catch (err) {
      const parsed = parseApiError(err, 'Не удалось сохранить изменения.')
      for (const [field, message] of Object.entries(parsed.fields)) {
        if (field === 'nickname' || field === 'mileage_km') {
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
              onSuccess: () => router.replace('/garage'),
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
                <View className="rounded-md bg-textPrimary px-3 py-1">
                  <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[12px] uppercase tracking-widest text-white">
                    {car.license_plate || '—'}
                  </Text>
                </View>
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
            name="nickname"
            render={({ field }) => (
              <Input
                label="Псевдоним"
                placeholder="Например: моя машина"
                hint="Удобное имя для гаража. Не обязательно."
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.nickname?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="mileage_km"
            render={({ field }) => (
              <Input
                label="Текущий пробег, км *"
                placeholder="84200"
                keyboardType="number-pad"
                hint="Сохраняется в историю пробега — на его основе считаются рекомендации сервиса."
                value={field.value ? String(field.value) : ''}
                onChangeText={(t) => {
                  const digits = t.replace(/[^0-9]/g, '')
                  field.onChange(digits === '' ? 0 : Number(digits))
                }}
                onBlur={field.onBlur}
                error={errors.mileage_km?.message}
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
              <Button variant="ghost" fullWidth onPress={() => router.replace('/garage')}>
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
