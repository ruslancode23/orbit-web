import { useEffect, useId, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Link } from 'react-router'

import {
  DEFAULT_MEMBER_PERMISSIONS,
  describeWorkspaceError,
  MemberPermissionsFields,
  WorkspaceProfileFields,
} from '@/entities/workspace'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'

import { StarterRolesFields } from './StarterRolesFields'
import { ADMIN_ROLE, MODERATOR_ROLE } from '../config/starter-roles'
import { CHANNEL_TEMPLATES } from '../config/templates'
import {
  useCreateWorkspaceFlow,
  type CreateWorkspaceValues,
  type CreationStage,
} from '../model/useCreateWorkspaceFlow'

import type { FieldPath } from 'react-hook-form'

const STEPS = [
  { title: 'Профиль', heading: 'Как назовём сервер?' },
  { title: 'Каналы', heading: 'С каких каналов начать?' },
  { title: 'Роли', heading: 'Кто что может?' },
] as const

/**
 * The fields each step owns. «Далее» checks only these: a field from another
 * step must not hold a step back with an error the person cannot see.
 */
const STEP_FIELDS: readonly (readonly FieldPath<CreateWorkspaceValues>[])[] = [
  ['name', 'description', 'icon'],
  ['template'],
  ['canInvite', 'canCreateChannels', 'canAttachFiles', 'roles'],
]

const LAST_STEP = STEPS.length - 1

const STAGE_TEXT: Record<Exclude<CreationStage, 'idle'>, string> = {
  workspace: 'Создаём сервер…',
  icon: 'Загружаем аватар…',
  channels: 'Создаём каналы…',
  roles: 'Создаём роли…',
}

/**
 * Creating a server in three steps: profile, starting channels, then what
 * everyone may do and the starter roles. One form holds all of them, so going
 * back loses nothing, and every step is a plain form: Enter goes on, Tab
 * reaches every control. Each step is checked by the server's rules before the
 * next one, so nothing is refused only at the very end.
 */
export const CreateWorkspaceWizard = () => {
  const headingId = useId()
  const everyoneId = useId()
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const firstStepShownRef = useRef(false)
  const [step, setStep] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const { run, stage } = useCreateWorkspaceFlow()
  const form = useForm<CreateWorkspaceValues>({
    defaultValues: {
      name: '',
      description: '',
      icon: { kind: 'keep' },
      template: 'team',
      ...DEFAULT_MEMBER_PERMISSIONS,
      roles: {
        admin: { enabled: true, name: ADMIN_ROLE.name },
        moderator: { enabled: true, name: MODERATOR_ROLE.name },
      },
    },
  })
  const { handleSubmit, register, setError, setFocus, trigger } = form
  const busy = stage !== 'idle'
  const current = STEPS[step] ?? STEPS[0]

  // The name first; after that each step starts at its heading, so a screen
  // reader says where the person is and Tab goes on from the top.
  useEffect(() => {
    if (!firstStepShownRef.current) {
      firstStepShownRef.current = true
      setFocus('name')
      return
    }
    headingRef.current?.focus()
  }, [step, setFocus])

  const create = handleSubmit(async (values) => {
    setFormError(null)
    await run(values).catch((error: unknown) => {
      const { field, message } = describeWorkspaceError(error, 'Не получилось создать сервер.')
      // Back to the field the server refused, with the reason next to it.
      if (field === 'name' || field === 'description') {
        setError(field, { type: 'server', message })
        setStep(0)
        return
      }
      setFormError(message)
    })
  })

  const submit = async () => {
    if (step < LAST_STEP) {
      // Only this step's fields: the person fixes what they can see.
      if (await trigger(STEP_FIELDS[step], { shouldFocus: true })) {
        setStep(step + 1)
      }
      return
    }
    await create()
  }

  return (
    <FormProvider {...form}>
      <form
        aria-labelledby={headingId}
        noValidate
        className="flex w-full max-w-lg flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <ol aria-label="Шаги" className="flex gap-2 text-sm">
          {STEPS.map((item, index) => (
            <li
              key={item.title}
              aria-current={index === step ? 'step' : undefined}
              className={cn(
                'flex flex-1 flex-col gap-1 border-t-2 pt-2',
                index <= step ? 'border-accent text-fg' : 'border-border text-fg-muted',
              )}
            >
              <span className="text-xs">Шаг {index + 1}</span>
              <span className="font-medium">{item.title}</span>
            </li>
          ))}
        </ol>

        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold focus-visible:outline-none"
        >
          {current.heading}
        </h2>

        {step === 0 && <WorkspaceProfileFields />}

        {step === 1 && (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Шаблон каналов</legend>
            {CHANNEL_TEMPLATES.map((template) => (
              <label
                key={template.id}
                className="flex cursor-pointer gap-3 rounded-lg border border-border p-4 hover:bg-surface has-checked:border-accent has-checked:bg-surface has-focus-visible:ring-2 has-focus-visible:ring-accent"
              >
                <input
                  type="radio"
                  value={template.id}
                  className="mt-1 accent-accent"
                  {...register('template')}
                />
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{template.title}</span>
                  <span className="text-sm text-fg-muted">{template.description}</span>
                  {template.channels.length > 0 && (
                    <span className="text-sm text-fg-muted">
                      {template.channels.map((channel) => `#${channel.name}`).join(', ')}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <section aria-labelledby={everyoneId} className="flex flex-col gap-3">
              <h3 id={everyoneId} className="text-sm font-semibold text-fg">
                Все участники
              </h3>
              <MemberPermissionsFields />
            </section>
            <StarterRolesFields />
          </div>
        )}

        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
        <p role="status" className="text-sm text-fg-muted">
          {stage !== 'idle' ? STAGE_TEXT[stage] : null}
        </p>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/">Отмена</Link>
          </Button>
          <span className="flex-1" />
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setStep(step - 1)
              }}
            >
              Назад
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {step < LAST_STEP ? 'Далее' : 'Создать сервер'}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
