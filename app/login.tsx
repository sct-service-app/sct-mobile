/**
 * Экран входа — РАБОЧИЙ порт features/auth/LoginModal.tsx.
 * Демонстрирует, что перенесённое ядро работает (http + endpoints + api + zod +
 * zustand + phone + errors) и собранный UI-кит (Input/PhoneInput/Button).
 * Отличия от веба: модалка → экран, DOM → RN, react-router → expo-router.
 */
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { PhoneInput } from '@/shared/ui/PhoneInput'
import { useAuthStore } from '@/features/auth/store'
import { loginClient } from '@/features/auth/api'
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas'
import { parseApiError } from '@/features/auth/errors'
import { unformatPhone } from '@/shared/lib/phone'
import { shouldOfferLockPrompt } from '@/features/app-lock/storage'

export default function LoginScreen() {
  const router = useRouter()
  const setSession = useAuthStore((s) => s.setSession)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null)
    try {
      const data = await loginClient({
        phone: unformatPhone(values.phone),
        password: values.password,
      })
      if (!data.user) {
        setServerError('Сервер не вернул профиль клиента.')
        return
      }
      setSession(data.access, data.refresh, data.user)
      if (await shouldOfferLockPrompt()) {
        router.replace('/app-lock/intro')
      } else if (router.canGoBack()) {
        router.back()
      } else {
        router.replace('/')
      }
    } catch (err) {
      const parsed = parseApiError(err, 'Неверный телефон или пароль.')
      for (const [field, message] of Object.entries(parsed.fields)) {
        if (field === 'phone' || field === 'password') {
          setError(field, { type: 'server', message })
        }
      }
      if (parsed.general) setServerError(parsed.general)
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center gap-1">
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl uppercase text-textPrimary">
          Вход в SCT Service
        </Text>
        <Text className="text-textSecondary">Введите свои данные для авторизации</Text>
      </View>

      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <PhoneInput
            label="Номер телефона"
            value={field.value}
            onChange={field.onChange}
            error={errors.phone?.message}
            textContentType="username"
            autoComplete="username"
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Input
            label="Пароль"
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            textContentType="password"
            autoComplete="current-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
            rightSlot={
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                <Text className="text-[11px] uppercase tracking-widest text-brandBlue">
                  {showPassword ? 'Скрыть' : 'Показать'}
                </Text>
              </Pressable>
            }
          />
        )}
      />

      <Pressable onPress={() => router.push('/forgot-password')} className="self-end">
        <Text className="text-[11px] uppercase tracking-widest text-brandBlue">Забыли пароль?</Text>
      </Pressable>

      {serverError ? (
        <View className="rounded-sct border border-red-200 bg-red-50 p-3">
          <Text className="text-red-700">{serverError}</Text>
        </View>
      ) : null}

      <Button fullWidth size="lg" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        Войти
      </Button>

      <View className="flex-row justify-center gap-1 pt-2">
        <Text className="text-textSecondary">Нет аккаунта?</Text>
        <Pressable onPress={() => router.replace('/register')}>
          <Text style={{ fontFamily: 'Inter_900Black' }} className="uppercase text-brandBlue">
            Зарегистрироваться
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
