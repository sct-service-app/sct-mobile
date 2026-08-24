/**
 * Экран регистрации — теперь в ДВА шага (SMS-подтверждение), порт
 * features/auth/RegisterModal.tsx из веба.
 *
 *   Шаг 1 (form)   — Имя / телефон / пароль. POST /register/ создаёт
 *                    пользователя и шлёт SMS, но JWT НЕ возвращает.
 *   Шаг 2 (verify) — Ввод кода из SMS → POST /register/verify/ возвращает
 *                    access/refresh/user. Только тут логиним пользователя.
 *
 * На демо реальные SMS не шлются — код всегда 8888 (см. инструкцию бэка).
 */
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { PhoneInput } from '@/shared/ui/PhoneInput'
import { toast } from '@/shared/ui/Toast'
import { useAuthStore } from '@/features/auth/store'
import { registerClient, resendRegistrationCode, verifyRegistration } from '@/features/auth/api'
import {
  registerSchema,
  splitFullName,
  verifyCodeSchema,
  type RegisterFormValues,
  type VerifyCodeValues,
} from '@/features/auth/schemas'
import { parseApiError } from '@/features/auth/errors'
import { formatPhoneInput, unformatPhone } from '@/shared/lib/phone'
import { shouldOfferLockPrompt } from '@/features/app-lock/storage'

const KNOWN_FIELDS = ['first_name', 'last_name', 'full_name', 'phone', 'password', 'password_confirm']

export default function RegisterScreen() {
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [phone, setPhone] = useState('')
  const [resendIn, setResendIn] = useState(60)

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center gap-1">
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl uppercase text-textPrimary">
          {step === 'form' ? 'Регистрация' : 'Подтверждение номера'}
        </Text>
        <Text className="text-center text-textSecondary">
          {step === 'form'
            ? 'Регистрация строго по номеру телефона'
            : 'Введите код из SMS, чтобы завершить регистрацию'}
        </Text>
      </View>

      {step === 'form' ? (
        <RegisterFormStep
          onRegistered={(normalizedPhone, resendAvailableIn) => {
            setPhone(normalizedPhone)
            setResendIn(resendAvailableIn)
            setStep('verify')
          }}
        />
      ) : (
        <PhoneVerifyStep phone={phone} initialResendIn={resendIn} />
      )}
    </ScrollView>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <View className="rounded-sct border border-red-200 bg-red-50 p-3">
      <Text className="text-red-700">{text}</Text>
    </View>
  )
}

// === Шаг 1: форма регистрации ===
function RegisterFormStep({
  onRegistered,
}: {
  onRegistered: (phone: string, resendAvailableIn: number) => void
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: '', phone: '', password: '', password_confirm: '' },
  })

  // Общая кнопка «показать/скрыть» для обоих полей пароля (как на экране входа).
  const passwordToggle = (
    <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
      <Text className="text-[11px] uppercase tracking-widest text-brandBlue">
        {showPassword ? 'Скрыть' : 'Показать'}
      </Text>
    </Pressable>
  )

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null)
    try {
      const { first_name, last_name } = splitFullName(values.full_name)
      const data = await registerClient({
        first_name,
        last_name,
        phone: unformatPhone(values.phone),
        password: values.password,
      })
      // Пользователь создан, SMS отправлена — НЕ логиним, идём на ввод кода.
      onRegistered(data.phone || unformatPhone(values.phone), data.resend_available_in ?? 60)
    } catch (err) {
      const parsed = parseApiError(err, 'Не удалось зарегистрироваться.')
      for (const [field, message] of Object.entries(parsed.fields)) {
        if (field === 'first_name' || field === 'last_name' || field === 'full_name') {
          setError('full_name', { type: 'server', message })
        } else if (field === 'phone' || field === 'password' || field === 'password_confirm') {
          setError(field, { type: 'server', message })
        }
      }
      const allMapped = Object.keys(parsed.fields).every((f) => KNOWN_FIELDS.includes(f))
      if (parsed.general || !allMapped) setServerError(parsed.general)
    }
  }

  return (
    <>
      <Controller
        control={control}
        name="full_name"
        render={({ field }) => (
          <Input
            label="Имя"
            placeholder="Иван"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.full_name?.message}
          />
        )}
      />

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
            placeholder="Минимум 8 символов"
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
            rightSlot={passwordToggle}
          />
        )}
      />

      <Controller
        control={control}
        name="password_confirm"
        render={({ field }) => (
          <Input
            label="Подтвердите пароль"
            placeholder="Повторите пароль"
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password_confirm?.message}
            rightSlot={passwordToggle}
          />
        )}
      />

      {serverError ? <ErrorBox text={serverError} /> : null}

      <Button fullWidth size="lg" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        Зарегистрироваться
      </Button>

      <View className="flex-row justify-center gap-1 pt-2">
        <Text className="text-textSecondary">Уже зарегистрированы?</Text>
        <Pressable onPress={() => router.replace('/login')}>
          <Text style={{ fontFamily: 'Inter_900Black' }} className="uppercase text-brandBlue">
            Войти
          </Text>
        </Pressable>
      </View>
    </>
  )
}

// === Шаг 2: подтверждение телефона кодом из SMS ===
function PhoneVerifyStep({ phone, initialResendIn }: { phone: string; initialResendIn: number }) {
  const router = useRouter()
  const setSession = useAuthStore((s) => s.setSession)
  const [serverError, setServerError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(initialResendIn)
  const [resending, setResending] = useState(false)

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VerifyCodeValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: '' },
  })

  // Таймер обратного отсчёта до повторной отправки SMS.
  useEffect(() => {
    if (resendIn <= 0) return
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  const onSubmit = async (values: VerifyCodeValues) => {
    setServerError(null)
    try {
      const data = await verifyRegistration({ phone, code: values.code })
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
      const parsed = parseApiError(err, 'Неверный код подтверждения.')
      if (parsed.fields.code) {
        setError('code', { type: 'server', message: parsed.fields.code })
      } else {
        setServerError(parsed.general ?? 'Неверный код подтверждения.')
      }
    }
  }

  const onResend = async () => {
    if (resendIn > 0 || resending) return
    setServerError(null)
    setResending(true)
    try {
      const data = await resendRegistrationCode({ phone })
      setResendIn(data.resend_available_in ?? 60)
      toast.success('SMS отправлена повторно.')
    } catch (err) {
      const parsed = parseApiError(err, 'Не удалось отправить код повторно.')
      setServerError(
        parsed.general ?? Object.values(parsed.fields)[0] ?? 'Не удалось отправить код повторно.',
      )
    } finally {
      setResending(false)
    }
  }

  return (
    <>
      <Text className="text-center text-textSecondary">
        Мы отправили SMS с кодом на{' '}
        <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-textPrimary">
          {formatPhoneInput(phone)}
        </Text>
      </Text>

      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <Input
            label="Код из SMS"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={8}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.code?.message}
          />
        )}
      />

      {serverError ? <ErrorBox text={serverError} /> : null}

      <Button fullWidth size="lg" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        Подтвердить
      </Button>

      <View className="flex-row flex-wrap items-center justify-center gap-1 pt-2">
        <Text className="text-textSecondary">Не пришёл код?</Text>
        {resendIn > 0 ? (
          <Text className="text-textSecondary">Отправить повторно через {resendIn}</Text>
        ) : (
          <Pressable onPress={onResend} disabled={resending}>
            <Text
              style={{ fontFamily: 'Inter_900Black' }}
              className={resending ? 'uppercase text-textSecondary' : 'uppercase text-brandBlue'}
            >
              Отправить повторно
            </Text>
          </Pressable>
        )}
      </View>
    </>
  )
}
