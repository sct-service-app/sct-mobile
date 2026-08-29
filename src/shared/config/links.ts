/**
 * Внешние ссылки на публичные страницы сайта.
 *
 * Живут на sct-service.kz как статика (см. sct-web/public/). Отдельного
 * «пользовательского соглашения» пока нет — есть только политика
 * конфиденциальности и страница удаления аккаунта.
 */
export const links = {
  privacy: 'https://sct-service.kz/privacy/',
  accountDeletion: 'https://sct-service.kz/account-deletion/',
} as const
