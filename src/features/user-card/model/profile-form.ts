import { isApiError, type AccentColor, type ProfileUpdate, type UserProfile } from '@/shared/api'

/** The same limits the profile endpoint keeps. */
export const DISPLAY_NAME_MAX = 32
export const BIO_MAX = 190

/**
 * The largest picture one may pick. It is cropped and re-encoded to a small
 * square before upload, so a phone photo over the avatar limit still fits.
 */
export const AVATAR_SOURCE_MAX_BYTES = 8 * 1024 * 1024
/** Width and height of the uploaded avatar, in pixels. */
export const AVATAR_SIZE = 256

/** What happens to the avatar when the form is sent. */
export type AvatarChange =
  { kind: 'keep' } | { kind: 'set'; file: Blob; previewUrl: string } | { kind: 'remove' }

/** The profile fields the person can change; the nickname has its own form. */
export interface ProfileValues {
  displayName: string
  bio: string
  accentColor: AccentColor
  avatar: AvatarChange
}

/** One swatch of the accent palette; labels are the names a screen reader says. */
export interface AccentOption {
  value: AccentColor
  label: string
  /** A literal Tailwind class, so the token survives the build. */
  swatch: string
}

/** Builds the palette from the same tokens `UserAvatar` uses for initials. */
export const ACCENT_OPTIONS: readonly AccentOption[] = [
  { value: 'slate', label: 'Графит', swatch: 'bg-profile-slate' },
  { value: 'red', label: 'Красный', swatch: 'bg-profile-red' },
  { value: 'amber', label: 'Янтарный', swatch: 'bg-profile-amber' },
  { value: 'green', label: 'Зелёный', swatch: 'bg-profile-green' },
  { value: 'teal', label: 'Бирюзовый', swatch: 'bg-profile-teal' },
  { value: 'sky', label: 'Небесный', swatch: 'bg-profile-sky' },
  { value: 'indigo', label: 'Индиго', swatch: 'bg-profile-indigo' },
  { value: 'violet', label: 'Фиолетовый', swatch: 'bg-profile-violet' },
  { value: 'pink', label: 'Розовый', swatch: 'bg-profile-pink' },
]

/** A profile that may predate the full one, e.g. an old session payload. */
type ProfileDefaults = Pick<UserProfile, 'nickname'> &
  Partial<Pick<UserProfile, 'displayName' | 'bio' | 'accentColor'>>

/** The form as the server currently has it. */
export const profileValuesFrom = (profile: ProfileDefaults): ProfileValues => {
  return {
    displayName: profile.displayName ?? profile.nickname,
    bio: profile.bio ?? '',
    accentColor: profile.accentColor ?? 'slate',
    avatar: { kind: 'keep' },
  }
}

/** Only the fields that changed: the endpoint leaves the rest alone. */
export const profileUpdateFrom = (profile: UserProfile, values: ProfileValues): ProfileUpdate => {
  const displayName = values.displayName.trim()
  const bio = values.bio.trim()
  const body: ProfileUpdate = {}
  if (displayName !== profile.displayName) {
    body.displayName = displayName
  }
  if (bio !== profile.bio) {
    body.bio = bio
  }
  if (values.accentColor !== profile.accentColor) {
    body.accentColor = values.accentColor
  }
  return body
}

/** The picture the preview draws, including the one just picked and not saved yet. */
export const avatarPreviewUrl = (
  profile: Pick<UserProfile, 'avatarUrl'>,
  avatar: AvatarChange,
): string | undefined => {
  if (avatar.kind === 'set') {
    return avatar.previewUrl
  }
  if (avatar.kind === 'remove') {
    return undefined
  }
  return profile.avatarUrl
}

/** The field a refusal of the profile endpoint is about, when it names one. */
export type ProfileField = 'displayName' | 'bio'

export interface ProfileErrorText {
  field?: ProfileField
  message: string
}

/** Turns a refusal into words and the field they belong to. */
export function describeProfileError(error: unknown): ProfileErrorText {
  const fallback = 'Не получилось сохранить профиль. Попробуйте ещё раз.'
  if (!isApiError(error)) {
    return { message: fallback }
  }
  if (error.isNetworkError) {
    return { message: 'Нет соединения с сервером.' }
  }
  if (error.status === 413) {
    return { message: 'Запрос слишком большой. Сократите «О себе» и попробуйте снова.' }
  }
  if (error.status === 400) {
    if (error.message.includes('bio')) {
      return { field: 'bio', message: `«О себе» — не больше ${String(BIO_MAX)} символов.` }
    }
    if (error.message.includes('display')) {
      return {
        field: 'displayName',
        message: `Отображаемое имя — не больше ${String(DISPLAY_NAME_MAX)} символов.`,
      }
    }
    return { message: 'Проверьте имя и «О себе»: сервер их не принял.' }
  }
  return { message: fallback }
}

/** A refusal of the avatar upload, in words. */
export function describeAvatarError(error: unknown): string {
  if (!isApiError(error)) {
    return 'Не получилось загрузить аватар. Попробуйте ещё раз.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 413) {
    return 'Файл больше 8 МБ. Выберите изображение поменьше.'
  }
  if (error.status === 415) {
    return 'Подойдёт только изображение PNG, JPEG или WebP.'
  }
  if (error.status === 400) {
    return 'Не получилось прочитать изображение. Попробуйте другое.'
  }
  return 'Не получилось загрузить аватар. Попробуйте ещё раз.'
}
