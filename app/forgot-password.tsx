/**
 * Восстановление пароля по SMS — порт features/auth/ForgotPasswordModal.tsx.
 *
 *   Шаг 1 (phone) — телефон → POST /password-reset/request/ (бэк всегда
 *                   отвечает одинаково, поэтому просто идём дальше).
 *   Шаг 2 (reset) — код из SMS + новый пароль → POST /password-reset/confirm/.
 *   Шаг 3 (done)  — «Пароль изменён» и автопереход на /login. Автовход НЕ
 *                   выполняем (по требованию бэка).
 *
 * На демо реальные SMS не шлются — код всегда 8888.
 */
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { PhoneInput } from '@/shared/ui/PhoneInput'
import { parseApiError } from '@/features/auth/errors'
import { confirmPasswordReset, requestPasswordReset } from '@/features/auth/password-reset-api'
import { codeRules, passwordRules } from '@/features/auth/schemas'
import { formatPhoneInput, unformatPhone } from '@/shared/lib/phone'

type Step = 'phone' | 'reset' | 'done'

const phoneRegex = /^\+?[0-9\s\-()]{7,32}$/
const phoneSchema = z.object({
  phone: z.string().min(1, 'Введите номер телефона').regex(phoneRegex, 'Неверный формат телефона'),
})
type PhoneValues = z.infer<typeof phoneSchema>

const resetSchema = z
  .object({
    code: codeRules,
    password: passwordRules,
    password_confirm: z.string().min(1, 'Подтвердите пароль'),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'Пароли не совпадают',
    path: ['password_confirm'],
  })
type ResetValues = z.infer<typeof resetSchema>

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('') // нормализованный (+7XXXXXXXXXX)

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center gap-1">
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl uppercase text-textPrimary">
          Восстановление пароля
        </Text>
      </View>

      {step === 'phone' && (
        <PhoneStep
          onSuccess={(normalizedPhone) => {
            setPhone(normalizedPhone)
            setStep('reset')
          }}
        />
      )}
      {step === 'reset' && <ResetStep phone={phone} onSuccess={() => setStep('done')} />}
      {step === 'done' && <DoneStep />}
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

function BackToLogin() {
  const router = useRouter()
  return (
    <Pressable onPress={() => router.replace('/login')} className="items-center pt-1">
      <Text
        style={{ fontFamily: 'Inter_900Black' }}
        className="text-[11px] uppercase tracking-widest text-brandBlue"
      >
        Вернуться на вход
      </Text>
    </Pressable>
  )
}

// === Шаг 1: телефон ===
function PhoneStep({ onSuccess }: { onSuccess: (normalizedPhone: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PhoneValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  })

  const onSubmit = async (values: PhoneValues) => {
    setServerError(null)
    const normalized = unformatPhone(values.phone)
    try {
      await requestPasswordReset({ phone: normalized })
      // Бэк отвечает одинаково независимо от существования номера — идём дальше.
      onSuccess(normalized)
    } catch (err) {
      const parsed = parseApiError(err, 'Не удалось отправить код. Попробуйте позже.')
      if (parsed.fields.phone) setError('phone', { type: 'server', message: parsed.fields.phone })
      else setServerError(parsed.general ?? 'Не удалось отправить код. Попробуйте позже.')
    }
  }

  return (
    <>
      <Text className="text-center text-textSecondary">
        Введите ваш номер телефона — отправим на него проверочный SMS-код.
      </Text>
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <PhoneInput
            label="Номер телефона"
            value={field.value}
            onChange={field.onChange}
            error={errors.phone?.message}
          />
        )}
      />
      {serverError ? <ErrorBox text={serverError} /> : null}
      <Button fullWidth size="lg" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        Получить код
      </Button>
      <BackToLogin />
    </>
  )
}

// === Шаг 2: код + новый пароль ===
function ResetStep({ phone, onSuccess }: { phone: string; onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const passwordToggle = (
    <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
      <Text className="text-[11px] uppercase tracking-widest text-brandBlue">
        {showPassword ? 'Скрыть' : 'Показать'}
      </Text>
    </Pressable>
  )
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: '', password: '', password_confirm: '' },
  })

  const onSubmit = async (values: ResetValues) => {
    setServerError(null)
    try {
      await confirmPasswordReset({ phone, code: values.code, new_password: values.password })
      onSuccess()
    } catch (err) {
      const parsed = parseApiError(err, 'Не удалось изменить пароль.')
      if (parsed.fields.code) setError('code', { type: 'server', message: parsed.fields.code })
      if (parsed.fields.new_password)
        setError('password', { type: 'server', message: parsed.fields.new_password })
      if (parsed.fields.password)
        setError('password', { type: 'server', message: parsed.fields.password })
      const mapped = parsed.fields.code || parsed.fields.new_password || parsed.fields.password
      if (parsed.general || !mapped) setServerError(parsed.general ?? 'Не удалось изменить пароль.')
    }
  }

  return (
    <>
      <Text className="text-center text-textSecondary">
        Если такой номер существует, мы отправили SMS на{' '}
        <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-textPrimary">
          {formatPhoneInput(phone)}
        </Text>
        . Введите код и новый пароль.
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
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Input
            label="Новый пароль"
            secureTextEntry={!showPassword}
            hint="Минимум 8 символов, буква и цифра"
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
            label="Повторите новый пароль"
            secureTextEntry={!showPassword}
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
        Сменить пароль
      </Button>
      <BackToLogin />
    </>
  )
}

// === Шаг 3: успех ===
function DoneStep() {
  const router = useRouter()
  // Автоматически переходим на экран входа (вход НЕ выполняем — по требованию бэка).
  useEffect(() => {
    const id = setTimeout(() => router.replace('/login'), 2200)
    return () => clearTimeout(id)
  }, [router])

  return (
    <View className="items-center gap-4 pt-2">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-successBg">
        <Text style={{ color: '#15803D' }} className="text-3xl leading-none">
          ✓
        </Text>
      </View>
      <View className="items-center gap-1">
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-lg uppercase text-textPrimary">
          Пароль успешно изменён
        </Text>
        <Text className="text-textSecondary">Сейчас откроется экран входа…</Text>
      </View>
      <Button fullWidth size="lg" onPress={() => router.replace('/login')}>
        Перейти ко входу
      </Button>
    </View>
  )
}
