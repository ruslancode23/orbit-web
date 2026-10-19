import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { useVoiceRoom } from '@/entities/voice-room'
import { createVoiceTokenMutation, isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

const MAX_NAME_LENGTH = 32

interface JoinRoomProps {
  room: string
}

export const JoinRoom = ({ room }: JoinRoomProps) => {
  const nameId = useId()
  const errorId = useId()
  const [displayName, setDisplayName] = useState('')
  const { status, error: voiceError, join, leave } = useVoiceRoom()
  const tokenMutation = useMutation(createVoiceTokenMutation())

  const busy = tokenMutation.isPending || status === 'connecting'
  const inRoom = status === 'connected' || status === 'reconnecting'
  const error = tokenMutation.error ? describeTokenError(tokenMutation.error) : voiceError

  const handleSubmit = async () => {
    const name = displayName.trim()
    if (!name || busy) return
    const token = await tokenMutation
      .mutateAsync({ body: { room, displayName: name } })
      .catch(() => null)
    if (token) await join({ url: token.url, token: token.token })
  }

  return (
    <section className="flex w-full max-w-sm flex-col gap-4" aria-labelledby={`${nameId}-title`}>
      <h1 id={`${nameId}-title`} className="text-2xl font-semibold">
        Комната <span className="text-fg-muted">{room}</span>
      </h1>

      {inRoom ? (
        <>
          <p role="status" className="text-sm text-fg-muted">
            {status === 'reconnecting' ? 'Переподключаемся…' : 'Вы в комнате'}
          </p>
          <Button variant="danger" onClick={() => void leave()}>
            Выйти
          </Button>
        </>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
          noValidate
        >
          <Label htmlFor={nameId}>Ваше имя</Label>
          <Input
            id={nameId}
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value)
            }}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {error && (
            <p id={errorId} role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !displayName.trim()}>
            {busy ? 'Подключаемся…' : 'Войти в комнату'}
          </Button>
        </form>
      )}
    </section>
  )
}

const describeTokenError = (error: unknown): string => {
  if (isApiError(error)) {
    if (error.isNetworkError) return 'Нет соединения с сервером.'
    if (error.isClientError) return error.message
  }
  return 'Сервер не смог выдать доступ в комнату. Попробуйте ещё раз.'
}
