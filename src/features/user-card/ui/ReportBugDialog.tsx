import { useMutation } from '@tanstack/react-query'
import { useId, useRef, useState, type ClipboardEvent } from 'react'
import { useController, useForm, useWatch } from 'react-hook-form'
import { useLocation } from 'react-router'

import { createBugReportMutation } from '@/shared/api'
import { build } from '@/shared/config'
import { getPlatform } from '@/shared/platform'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useToast } from '@/shared/ui/toast'

import {
  describeBugReportError,
  MAX_BUG_DESCRIPTION,
  MAX_BUG_STEPS,
  reportRoute,
  reportUserAgent,
  SCREENSHOT_TYPES,
  screenshotProblem,
} from '../model/bug-report'

interface BugReportValues {
  description: string
  steps: string
  screenshot: File | null
}

interface ReportBugDialogProps {
  onClose: () => void
}

const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
    : `${String(Math.max(1, Math.round(bytes / 1024)))} КБ`

/**
 * «Сообщить о проблеме»: what happened, how to repeat it and, if the person
 * wants, a screenshot. The build, the browser and the page are attached by
 * the client and listed in the form, so nothing goes out unannounced; the
 * account comes from the session on the server. Messages, tokens and secret
 * chats never get here: the route keeps only its path, with invite codes and
 * secret chat ids masked.
 */
export const ReportBugDialog = ({ onClose }: ReportBugDialogProps) => {
  const toast = useToast()
  const location = useLocation()
  const descriptionId = useId()
  const stepsId = useId()
  const screenshotErrorId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const send = useMutation(createBugReportMutation())

  const { register, handleSubmit, formState, setError, clearErrors, control } =
    useForm<BugReportValues>({
      defaultValues: { description: '', steps: '', screenshot: null },
    })
  const { field: screenshotField } = useController({
    control,
    name: 'screenshot',
    rules: {
      validate: (file) => (file === null ? true : (screenshotProblem(file) ?? true)),
    },
  })
  const description = useWatch({ control, name: 'description' })
  const steps = useWatch({ control, name: 'steps' })
  const screenshot = screenshotField.value

  const route = reportRoute(location.pathname)
  const system = reportUserAgent(getPlatform().system.describe())

  const pickScreenshot = (file: File | undefined) => {
    if (file === undefined) {
      return
    }
    clearErrors('screenshot')
    screenshotField.onChange(file)
    const problem = screenshotProblem(file)
    if (problem !== undefined) {
      setError('screenshot', { message: problem })
    }
  }

  // A screenshot is usually in the clipboard already: Ctrl+V anywhere in the
  // form attaches it, and text pastes into the field as usual.
  const pasteScreenshot = (event: ClipboardEvent<HTMLFormElement>) => {
    const image = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith('image/'),
    )
    if (image !== undefined) {
      event.preventDefault()
      pickScreenshot(image)
    }
  }

  const submit = handleSubmit(async (values) => {
    setFailure(undefined)
    const trimmedSteps = values.steps.trim()
    try {
      const report = await send.mutateAsync({
        body: {
          description: values.description.trim(),
          ...(trimmedSteps === '' ? {} : { steps: trimmedSteps }),
          appVersion: build.version,
          userAgent: system,
          route,
          ...(values.screenshot === null ? {} : { screenshot: values.screenshot }),
        },
      })
      toast(`Спасибо! Отчёт № ${report.id.slice(0, 8)} отправлен команде.`, 'success')
      onClose()
    } catch (error) {
      const refusal = describeBugReportError(error)
      if (refusal.field === undefined) {
        setFailure(refusal.message)
      } else {
        setError(refusal.field, { message: refusal.message }, { shouldFocus: true })
      }
    }
  })

  const descriptionError = formState.errors.description?.message
  const stepsError = formState.errors.steps?.message
  const screenshotError = formState.errors.screenshot?.message
  const pending = send.isPending

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <div className="flex flex-col gap-1">
          <DialogTitle>Сообщить о проблеме</DialogTitle>
          <DialogDescription>
            Расскажите, что пошло не так, — отчёт уйдёт команде Orbit. Переписку и секретные чаты мы
            не прикладываем.
          </DialogDescription>
        </div>

        <form
          className="flex flex-col gap-4"
          noValidate
          onPaste={pasteScreenshot}
          onSubmit={(event) => {
            void submit(event)
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={descriptionId}>Что случилось</Label>
            <Textarea
              id={descriptionId}
              rows={4}
              maxLength={MAX_BUG_DESCRIPTION}
              placeholder="Например: после отправки сообщение пропадает из ленты"
              aria-invalid={descriptionError !== undefined}
              aria-describedby={`${descriptionId}-hint`}
              {...register('description', {
                validate: (value) =>
                  value.trim() !== '' || 'Опишите, что случилось, — без этого отчёт не отправить.',
                maxLength: {
                  value: MAX_BUG_DESCRIPTION,
                  message: `Не больше ${String(MAX_BUG_DESCRIPTION)} символов.`,
                },
              })}
            />
            <p id={`${descriptionId}-hint`} className="text-xs text-fg-muted">
              Обязательно. {description.length}/{MAX_BUG_DESCRIPTION}
            </p>
            {descriptionError !== undefined && (
              <p role="alert" className="text-sm text-danger">
                {descriptionError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={stepsId}>Как повторить</Label>
            <Textarea
              id={stepsId}
              rows={3}
              maxLength={MAX_BUG_STEPS}
              placeholder={'1. Открыть канал\n2. Отправить сообщение\n3. …'}
              aria-invalid={stepsError !== undefined}
              aria-describedby={`${stepsId}-hint`}
              {...register('steps', {
                maxLength: {
                  value: MAX_BUG_STEPS,
                  message: `Не больше ${String(MAX_BUG_STEPS)} символов.`,
                },
              })}
            />
            <p id={`${stepsId}-hint`} className="text-xs text-fg-muted">
              Необязательно. {steps.length}/{MAX_BUG_STEPS}
            </p>
            {stepsError !== undefined && (
              <p role="alert" className="text-sm text-danger">
                {stepsError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Скриншот</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-describedby={screenshotError === undefined ? undefined : screenshotErrorId}
                onClick={() => inputRef.current?.click()}
              >
                {screenshot === null ? 'Прикрепить скриншот' : 'Заменить скриншот'}
              </Button>
              {screenshot !== null && (
                <>
                  <span className="min-w-0 truncate text-sm">
                    {screenshot.name} · {formatSize(screenshot.size)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      clearErrors('screenshot')
                      screenshotField.onChange(null)
                    }}
                  >
                    Убрать скриншот
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-fg-muted">
              Необязательно. PNG, JPEG или WebP до 5 МБ; можно вставить из буфера (Ctrl+V).
            </p>
            {screenshotError !== undefined && (
              <p id={screenshotErrorId} role="alert" className="text-sm text-danger">
                {screenshotError}
              </p>
            )}
            <input
              ref={(element) => {
                inputRef.current = element
                screenshotField.ref(element)
              }}
              type="file"
              accept={SCREENSHOT_TYPES.join(',')}
              aria-label="Файл скриншота"
              tabIndex={-1}
              hidden
              onChange={(event) => {
                pickScreenshot(event.target.files?.[0])
                // The same file picked again must still fire a change.
                event.target.value = ''
              }}
            />
          </div>

          <div className="rounded-md bg-surface-hover p-3 text-xs text-fg-muted">
            <p className="mb-1 font-medium text-fg">Приложим автоматически</p>
            <ul className="flex flex-col gap-0.5">
              <li>Версия: {build.version}</li>
              <li className="break-all">Браузер и система: {system}</li>
              <li className="break-all">Страница: {route}</li>
              <li>Ваш аккаунт — чтобы мы могли уточнить детали</li>
            </ul>
          </div>

          {failure !== undefined && (
            <p role="alert" className="text-sm text-danger">
              {failure}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? 'Отправляем…' : 'Отправить'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
