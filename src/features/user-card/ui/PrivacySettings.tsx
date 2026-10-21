import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { BlockedUsersList } from '@/entities/friend'
import {
  getDmPolicyOptions,
  getDmPolicyQueryKey,
  getFriendRequestPolicyOptions,
  getFriendRequestPolicyQueryKey,
  setDmPolicyMutation,
  setFriendRequestPolicyMutation,
  type DmPolicy,
  type FriendshipPolicy,
} from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { useToast } from '@/shared/ui/toast'

import {
  describePrivacyError,
  DM_POLICY_OPTIONS,
  FRIEND_REQUEST_POLICY_OPTIONS,
  type PolicyOption,
} from '../model/privacy'

interface PolicyFieldsetProps<T extends string> {
  legend: string
  hint: string
  name: string
  value: T | undefined
  options: readonly PolicyOption<T>[]
  loading: boolean
  loadError: boolean
  error: string | undefined
  pending: boolean
  onRetry: () => void
  onChange: (value: T) => void
}

const PolicyFieldset = <T extends string>({
  legend,
  hint,
  name,
  value,
  options,
  loading,
  loadError,
  error,
  pending,
  onRetry,
  onChange,
}: PolicyFieldsetProps<T>) => {
  const hintId = useId()
  const disabled = pending || loading || (value === undefined && !loadError)

  return (
    <fieldset
      disabled={disabled}
      aria-busy={loading || pending}
      aria-describedby={hintId}
      className="flex min-w-0 flex-col gap-2 rounded-panel border border-border p-3"
    >
      <legend className="px-1 text-sm font-semibold text-fg">{legend}</legend>
      <p id={hintId} className="text-xs text-fg-muted">
        {hint}
      </p>

      {loading ? (
        <p role="status" className="px-1 py-2 text-sm text-fg-muted">
          Загружаем настройку…
        </p>
      ) : loadError ? (
        <div className="flex flex-wrap items-center gap-2 px-1 py-2">
          <p role="alert" className="text-sm text-danger">
            Не удалось загрузить настройку.
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
            Повторить
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {options.map((option) => {
            const optionId = `${name}-${option.value}`
            const optionHintId = `${optionId}-hint`
            return (
              <div
                key={option.value}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover"
              >
                <input
                  id={optionId}
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={value === option.value}
                  aria-describedby={optionHintId}
                  onChange={() => {
                    onChange(option.value)
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                />
                <label htmlFor={optionId} className="flex min-w-0 cursor-pointer flex-col">
                  <span className="text-sm text-fg">{option.label}</span>
                  <span id={optionHintId} className="text-xs text-fg-muted">
                    {option.description}
                  </span>
                </label>
              </div>
            )
          })}
        </div>
      )}

      {pending && (
        <p role="status" className="px-1 text-xs text-fg-muted">
          Сохраняем…
        </p>
      )}
      {error !== undefined && (
        <p role="alert" className="px-1 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}

/**
 * «Приватность» in the user settings: who may start a dialogue, who may ask
 * for friendship, and the accounts this person blocked. Both policies save the
 * moment a choice changes; a refusal leaves the previous answer selected and
 * says so under the fieldset.
 */
export const PrivacySettings = () => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const dmPolicy = useQuery(getDmPolicyOptions())
  const friendPolicy = useQuery(getFriendRequestPolicyOptions())
  const [dmError, setDmError] = useState<string | undefined>(undefined)
  const [friendError, setFriendError] = useState<string | undefined>(undefined)

  const saveDm = useMutation({
    ...setDmPolicyMutation(),
    onSuccess: (setting) => {
      queryClient.setQueryData(getDmPolicyQueryKey(), setting)
      setDmError(undefined)
      toast('Кто может мне писать: сохранено', 'success')
    },
    onError: (error) => {
      setDmError(describePrivacyError(error))
    },
  })

  const saveFriend = useMutation({
    ...setFriendRequestPolicyMutation(),
    onSuccess: (setting) => {
      queryClient.setQueryData(getFriendRequestPolicyQueryKey(), setting)
      setFriendError(undefined)
      toast('Кто может добавлять меня в друзья: сохранено', 'success')
    },
    onError: (error) => {
      setFriendError(describePrivacyError(error))
    },
  })

  // While the server is answering, the radio shows the choice just made; when
  // it refuses, the value falls back to the last answer the server gave.
  const dmValue: DmPolicy | undefined = saveDm.isPending
    ? saveDm.variables.body.dmPolicy
    : dmPolicy.data?.dmPolicy
  const friendValue: FriendshipPolicy | undefined = saveFriend.isPending
    ? saveFriend.variables.body.friendRequestPolicy
    : friendPolicy.data?.friendRequestPolicy

  const chooseDm = (value: DmPolicy) => {
    if (value === dmValue || saveDm.isPending) {
      return
    }
    setDmError(undefined)
    saveDm.mutate({ body: { dmPolicy: value } })
  }

  const chooseFriend = (value: FriendshipPolicy) => {
    if (value === friendValue || saveFriend.isPending) {
      return
    }
    setFriendError(undefined)
    saveFriend.mutate({ body: { friendRequestPolicy: value } })
  }

  return (
    <div className="flex flex-col gap-5">
      <PolicyFieldset
        legend="Кто может мне писать"
        hint="Это правило для новых личных диалогов. В уже начатой переписке блокировка решает отдельно."
        name="dm-policy"
        value={dmValue}
        options={DM_POLICY_OPTIONS}
        loading={dmPolicy.isPending}
        loadError={dmPolicy.isError}
        error={dmError}
        pending={saveDm.isPending}
        onRetry={() => {
          void dmPolicy.refetch()
        }}
        onChange={chooseDm}
      />

      <PolicyFieldset
        legend="Кто может добавлять меня в друзья"
        hint="Заявка от остальных выглядит так же, как заявка несуществующему аккаунту: отказ не выдаёт ваш выбор."
        name="friend-request-policy"
        value={friendValue}
        options={FRIEND_REQUEST_POLICY_OPTIONS}
        loading={friendPolicy.isPending}
        loadError={friendPolicy.isError}
        error={friendError}
        pending={saveFriend.isPending}
        onRetry={() => {
          void friendPolicy.refetch()
        }}
        onChange={chooseFriend}
      />

      <section aria-labelledby="blocked-settings-title" className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 id="blocked-settings-title" className="text-sm font-semibold text-fg">
            Заблокированные
          </h3>
          <p className="text-xs text-fg-muted">
            Они не могут писать вам, а их сообщения в общих группах свёрнуты. Разблокировать можно
            здесь или в разделе «Друзья».
          </p>
        </div>
        <BlockedUsersList
          label="Заблокированные пользователи"
          className="flex max-h-64 flex-col gap-0.5 overflow-y-auto"
        />
      </section>
    </div>
  )
}
