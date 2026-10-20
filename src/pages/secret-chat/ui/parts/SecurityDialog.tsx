import qrcode from 'qrcode-generator'
import { useMemo, useState } from 'react'

import type { SecretChatView } from '@/entities/secret-session'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { CheckIcon } from '@/shared/ui/icon'

interface SecurityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: SecretChatView
  onVerified: (verified: boolean) => Promise<boolean>
}

/** The same code on both devices, rendered as modules instead of injected HTML. */
const SafetyQr = ({ payload }: { payload: string }) => {
  const matrix = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(payload)
    qr.make()
    const count = qr.getModuleCount()
    return Array.from({ length: count }, (_, row) =>
      Array.from({ length: count }, (_, col) => qr.isDark(row, col)),
    )
  }, [payload])

  return (
    <div
      role="img"
      aria-label="QR-код для сверки кода безопасности"
      className="grid w-52 bg-fg p-2"
      style={{ gridTemplateColumns: `repeat(${String(matrix.length)}, minmax(0, 1fr))` }}
    >
      {matrix.flatMap((row, rowIndex) =>
        row.map((dark, colIndex) => (
          <span
            key={`${String(rowIndex)}-${String(colIndex)}`}
            className={dark ? 'aspect-square bg-bg' : 'aspect-square bg-fg'}
          />
        )),
      )}
    </div>
  )
}

/**
 * The safety number: emoji, digits and a QR to compare in person. Marking it
 * verified is what clears a key change; there is no automatic trust.
 */
export const SecurityDialog = ({ open, onOpenChange, view, onVerified }: SecurityDialogProps) => {
  const [saving, setSaving] = useState(false)

  const toggleVerified = async () => {
    setSaving(true)
    await onVerified(!view.verified)
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogTitle>Шифрование</DialogTitle>
        <DialogDescription>
          Сравните код с собеседником по другому каналу — вслух, вживую или сканированием QR. Тогда
          сервер не сможет подменить ключ незаметно.
        </DialogDescription>

        {view.keyChanged && (
          <p
            role="alert"
            className="rounded-md border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            <strong className="block font-medium">Ключ шифрования собеседника изменился</strong>
            Сообщения заблокированы, пока вы не сверите код и не отметите его проверенным снова.
          </p>
        )}

        <section aria-label="Эмодзи для сверки" className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Эмодзи</h3>
          <ul className="grid grid-cols-5 gap-1 text-center text-2xl leading-none">
            {view.safetyNumber.emoji.map((emoji, index) => (
              <li key={`${emoji}-${String(index)}`}>{emoji}</li>
            ))}
          </ul>
        </section>

        <section aria-label="Цифры для сверки" className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Цифры</h3>
          <ol className="grid grid-cols-3 gap-2 font-mono text-sm tracking-wider">
            {view.safetyNumber.groups.map((group, index) => (
              <li key={`${group}-${String(index)}`}>{group}</li>
            ))}
          </ol>
        </section>

        <section aria-label="QR-код" className="flex flex-col items-center gap-2">
          <SafetyQr payload={view.safetyNumber.qr} />
        </section>

        <div className="flex flex-col gap-2">
          <Button
            variant={view.verified ? 'secondary' : 'primary'}
            aria-pressed={view.verified}
            disabled={saving}
            className="self-start"
            onClick={() => {
              void toggleVerified()
            }}
          >
            <CheckIcon />
            Проверено
          </Button>
          <p className="text-sm text-fg-muted">
            {view.verified
              ? 'Код отмечен как проверенный. Если ключ изменится, отправка снова заблокируется до сверки.'
              : 'Отметьте код проверенным, когда убедитесь, что он совпадает на обоих устройствах.'}
          </p>
        </div>

        <DialogClose asChild>
          <Button variant="secondary" className="self-end">
            Закрыть
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

interface EncryptionDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** What encryption does and does not protect against, in plain words. */
export const EncryptionDetailsDialog = ({ open, onOpenChange }: EncryptionDetailsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogTitle>Как устроено шифрование</DialogTitle>
        <DialogDescription>Что видит сервер и чего этот чат не может обещать.</DialogDescription>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-fg-muted">
          <li>
            Сервер Orbit видит, кто и когда пишет, кому и какого размера сообщение. Содержимое,
            имена файлов и ключи ему недоступны.
          </li>
          <li>
            Браузер не может запретить скриншоты: собеседник может сохранить снимок экрана с вашими
            сообщениями.
          </li>
          <li>
            Взломанное устройство сводит шифрование на нет: злоумышленник прочитает сообщения и
            ключи прямо на устройстве.
          </li>
          <li>
            Сообщения и ключи хранятся только в этом браузере. Очистка данных сайта удалит переписку
            безвозвратно.
          </li>
        </ul>
        <DialogClose asChild>
          <Button variant="secondary" className="self-end">
            Закрыть
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
