/**
 * Нижние табы — перенос app/MobileTabBar.tsx из веба:
 *   Главная / Авто(authOnly) / Услуги / Контакты / Профиль(authOnly).
 * «Авто» и «Профиль» требуют авторизации → для гостя табы скрыты (href: null).
 */
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'
import { useAuthStore } from '@/features/auth/store'
import { Logo } from '@/shared/ui/Logo'

export default function TabsLayout() {
  const isAuthed = useAuthStore((s) => s.phase === 'authed')

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1F5FAF',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: { fontFamily: 'Inter_700Bold', fontSize: 10, textTransform: 'uppercase' },
        // Navy-шапка как в мобильной версии веба: логотип слева, название
        // экрана по центру белым.
        headerStyle: { backgroundColor: '#0A1B3D' },
        headerTintColor: '#FFFFFF',
        headerTitleAlign: 'center',
        headerTitleStyle: { fontFamily: 'Inter_900Black', color: '#FFFFFF' },
        headerLeft: () => (
          <View style={{ paddingLeft: 16 }}>
            <Logo width={54} />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="service-book"
        options={{
          title: 'Авто',
          href: isAuthed ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Услуги',
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Контакты',
          tabBarIcon: ({ color, size }) => <Ionicons name="mail-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          href: isAuthed ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
