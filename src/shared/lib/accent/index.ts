/** The accent tokens of the product, the same for a profile and a role. */
export type Accent =
  'slate' | 'red' | 'amber' | 'green' | 'teal' | 'sky' | 'indigo' | 'violet' | 'pink'

export interface AccentOption {
  value: Accent
  label: string
  /** A literal Tailwind background class, so the token survives the build. */
  swatch: string
  /** The same colour for text, e.g. a member's name in their role's colour. */
  text: string
}

export const ACCENTS: readonly AccentOption[] = [
  { value: 'slate', label: 'Графит', swatch: 'bg-profile-slate', text: 'text-profile-slate' },
  { value: 'red', label: 'Красный', swatch: 'bg-profile-red', text: 'text-profile-red' },
  { value: 'amber', label: 'Янтарный', swatch: 'bg-profile-amber', text: 'text-profile-amber' },
  { value: 'green', label: 'Зелёный', swatch: 'bg-profile-green', text: 'text-profile-green' },
  { value: 'teal', label: 'Бирюзовый', swatch: 'bg-profile-teal', text: 'text-profile-teal' },
  { value: 'sky', label: 'Небесный', swatch: 'bg-profile-sky', text: 'text-profile-sky' },
  { value: 'indigo', label: 'Индиго', swatch: 'bg-profile-indigo', text: 'text-profile-indigo' },
  {
    value: 'violet',
    label: 'Фиолетовый',
    swatch: 'bg-profile-violet',
    text: 'text-profile-violet',
  },
  { value: 'pink', label: 'Розовый', swatch: 'bg-profile-pink', text: 'text-profile-pink' },
]

/** The option of a token, or undefined for none or an unknown one. */
export const accentOf = (value: string | null | undefined): AccentOption | undefined =>
  ACCENTS.find((option) => option.value === value)
