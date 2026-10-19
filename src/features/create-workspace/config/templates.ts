export interface TemplateChannel {
  name: string
  topic?: string
  isReadOnly?: boolean
}

export interface ChannelTemplate {
  id: 'empty' | 'team' | 'community'
  title: string
  description: string
  channels: TemplateChannel[]
}

/**
 * Starting channels for a new server, created right after it with the usual
 * channel endpoint. Text only: voice channels come with stage 3 of the API.
 */
export const CHANNEL_TEMPLATES: ChannelTemplate[] = [
  {
    id: 'team',
    title: 'Для команды',
    description: 'Рабочие вопросы и разговоры обо всём остальном.',
    channels: [
      { name: 'общий', topic: 'Новости и вопросы команды' },
      { name: 'оффтоп', topic: 'Всё, что не про работу' },
    ],
  },
  {
    id: 'community',
    title: 'Для сообщества',
    description: 'Правила, которые пишут только администраторы, и место для общения.',
    channels: [
      { name: 'правила', topic: 'Как у нас принято', isReadOnly: true },
      { name: 'общий', topic: 'Разговоры участников' },
      { name: 'знакомства', topic: 'Расскажите о себе' },
    ],
  },
  {
    id: 'empty',
    title: 'Пустой',
    description: 'Без каналов: добавите их сами.',
    channels: [],
  },
]

export type TemplateId = ChannelTemplate['id']
