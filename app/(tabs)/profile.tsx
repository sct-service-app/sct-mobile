/**
 * Профиль (телефон, одна колонка).
 *
 * Показываем только рабочее:
 *   - карточка профиля (аватар-инициалы, имя, телефон, статус);
 *   - личные данные read-only (имя/фамилия/телефон/email);
 *   - защита входа (код-пароль + биометрия) — локальный app-lock, работает;
 *   - выход.
 *
 * Убрано как нерабочее/моки: редактирование профиля и смена пароля (бэк
 * отвечает 405 на PATCH /auth/profile/, BACKEND_NOTES §4.3), выбор языка
 * (приложение пока только RU) и тумблеры уведомлений (push не подключён).
 * Вернём, когда бэк подключит ручки.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { RequireAuth } from '@/shared/ui/RequireAuth'
import { Card } from '@/shared/ui/Card'
import { Toggle } from '@/shared/ui/Toggle'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { toast } from '@/shared/ui/Toast'
import { useAuthStore } from '@/features/auth/store'
import { deleteClientAccount } from '@/features/auth/api'
import { parseApiError } from '@/features/auth/errors'
import { useAppLockStore } from '@/features/app-lock/store'
import { isBiometricAvailable } from '@/features/app-lock/biometrics'
import * as appLockStorage from '@/features/app-lock/storage'
import type { ClientProfile } from '@/shared/api/types'

const STATUS_LABEL: Record<string, { text: string; ok: boolean }> = {
  ACTIVE: { text: 'Подтверждён по СМС', ok: true },
  INACTIVE: { text: 'Не подтверждён', ok: false },
  BLOCKED: { text: 'Заблокирован', ok: false },
  ARCHIVED: { text: 'В архиве', ok: false },
}

function initials(p: ClientProfile | null): string {
  if (!p) return '—'
  const f = p.first_name?.charAt(0) ?? ''
  const l = p.last_name?.charAt(0) ?? ''
  return (f + l).toUpperCase() || (p.phone?.slice(-2) ?? '—')
}

export default function ProfileScreen() {
  return (
    <RequireAuth>
      <Profile />
    </RequireAuth>
  )
}

function Profile() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const logout = useAuthStore((s) => s.logout)

  const lockEnabled = useAppLockStore((s) => s.enabled)
  const biometricEnabled = useAppLockStore((s) => s.biometricEnabled)
  const [bioAvailable, setBioAvailable] = useState(false)

  // Удаление аккаунта (требование сторов).
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Введите пароль для подтверждения')
      return
    }
    setDeleteError(null)
    setDeleting(true)
    try {
      await deleteClientAccount(deletePassword)
      setDeleteOpen(false)
      logout()
      toast.success('Аккаунт удалён')
      router.replace('/')
    } catch (err) {
      setDeleteError(parseApiError(err, 'Не удалось удалить аккаунт. Проверьте пароль.').general)
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    void isBiometricAvailable().then(setBioAvailable)
  }, [])

  const onToggleLock = (next: boolean) => {
    if (next) {
      router.push('/app-lock/setup')
    } else {
      Alert.alert('Выключить код-пароль?', 'Вход без кода и Face ID.', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выключить',
          style: 'destructive',
          onPress: async () => {
            await appLockStorage.clear()
            await useAppLockStore.getState().reloadConfig()
          },
        },
      ])
    }
  }

  const onToggleBiometric = async (next: boolean) => {
    if (next && !(await isBiometricAvailable())) return
    await appLockStorage.setBiometric(next)
    await useAppLockStore.getState().reloadConfig()
  }

  const handleLogout = () => {
    logout()
    router.replace('/')
  }

  if (!profile) return null

  const status = STATUS_LABEL[profile.status] ?? { text: profile.status, ok: false }
  const displayName =
    profile.full_name ||
    `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() ||
    'Клиент'

  return (
    <ScrollView className="flex-1 bg-surfaceLight" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
      {/* Карточка профиля */}
      <Card className="items-center p-6">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-brandBlue">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl text-white">
            {initials(profile)}
          </Text>
        </View>
        <Text style={{ fontFamily: 'Inter_900Black' }} className="mt-4 text-lg uppercase text-textPrimary">
          {displayName}
        </Text>
        {profile.phone ? <Text className="mt-1 text-sm text-textSecondary">{profile.phone}</Text> : null}

        <View className="mt-6 w-full rounded-sct border border-borderLight bg-surfaceLight p-4">
          <Text className="text-[10px] uppercase tracking-widest text-textSecondary">Статус профиля</Text>
          <View className="mt-1 flex-row items-center gap-2">
            <View className={`h-2 w-2 rounded-full ${status.ok ? 'bg-green-500' : 'bg-slate-400'}`} />
            <Text style={{ fontFamily: 'Inter_700Bold' }} className="uppercase text-textPrimary">
              {status.text}
            </Text>
          </View>
        </View>
      </Card>

      {/* Личные данные (read-only) */}
      <Card className="gap-3 p-6">
        <SectionTitle>Личные данные</SectionTitle>
        <InfoRow label="Имя" value={profile.first_name} />
        <InfoRow label="Фамилия" value={profile.last_name} />
        <InfoRow label="Телефон" value={profile.phone} />
        <InfoRow label="Email" value={profile.email} />
      </Card>

      {/* Защита входа */}
      <Card className="gap-3 p-6">
        <SectionTitle>Защита входа</SectionTitle>
        <View className="rounded-sct border border-borderLight bg-surfaceLight p-4">
          <Toggle
            checked={lockEnabled}
            onChange={onToggleLock}
            label="Код-пароль"
            description="Запрашивать 4-значный код при открытии приложения"
          />
        </View>
        {lockEnabled && bioAvailable ? (
          <View className="rounded-sct border border-borderLight bg-surfaceLight p-4">
            <Toggle
              checked={biometricEnabled}
              onChange={onToggleBiometric}
              label="Face ID / Touch ID"
              description="Быстрый вход по биометрии вместо кода"
            />
          </View>
        ) : null}
        {lockEnabled ? (
          <Button variant="secondary" fullWidth onPress={() => router.push('/app-lock/setup')}>
            Сменить код
          </Button>
        ) : null}
      </Card>

      <Button variant="danger" fullWidth size="lg" onPress={handleLogout}>
        Выйти из системы
      </Button>

      <Button
        variant="ghost"
        fullWidth
        onPress={() => {
          setDeleteError(null)
          setDeletePassword('')
          setDeleteOpen(true)
        }}
      >
        Удалить аккаунт
      </Button>

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false)
        }}
        title="Удалить аккаунт"
      >
        <Text className="text-sm text-textSecondary">
          Это действие необратимо. Активные записи будут отменены, автомобили —
          заархивированы, а персональные данные удалены. Войти в этот аккаунт больше
          нельзя.
        </Text>
        <View className="mt-4 gap-3">
          <Input
            label="Введите пароль для подтверждения"
            secureTextEntry
            value={deletePassword}
            onChangeText={setDeletePassword}
            error={deleteError ?? undefined}
          />
          <Button variant="danger" fullWidth loading={deleting} onPress={handleDeleteAccount}>
            Удалить аккаунт
          </Button>
          <Button variant="ghost" fullWidth onPress={() => setDeleteOpen(false)}>
            Отмена
          </Button>
        </View>
      </Modal>
    </ScrollView>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontFamily: 'Inter_900Black' }} className="text-xs uppercase tracking-widest text-textSecondary">
      {children}
    </Text>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="flex-row items-center justify-between gap-3 border-b border-borderLight pb-3">
      <Text className="text-sm text-textSecondary">{label}</Text>
      <Text style={{ fontFamily: 'Inter_700Bold' }} className="flex-1 text-right text-sm text-textPrimary">
        {value?.trim() ? value : '—'}
      </Text>
    </View>
  )
}
