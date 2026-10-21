import { useState } from 'react'

import { useSession } from '@/entities/session'
import { LogoutButton } from '@/features/auth'
import { ClaimGuest } from '@/features/claim-guest'
import { InstallApp } from '@/features/install-app'
import { NotificationSettings } from '@/features/notifications'
import { DeviceSettings } from '@/features/select-device'
import { AccountSettings, PrivacySettings, ProfileSettings } from '@/features/user-card'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { XIcon } from '@/shared/ui/icon'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

interface UserSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The section to show; the user panel opens «Профиль» when it points at the avatar. */
  tab?: string
  onTabChange?: (tab: string) => void
}

type LeaveAction = { kind: 'tab'; value: string } | { kind: 'close' }

/**
 * The one place for everything that belongs to the person: profile, devices,
 * notifications, the install offer, the account and signing out.
 *
 * The profile tab is a form with a live card, so switching away from unsaved
 * edits — or closing the dialog — asks first instead of throwing them away.
 */
export const UserSettings = ({
  open,
  onOpenChange,
  tab: controlledTab,
  onTabChange,
}: UserSettingsProps) => {
  const { user } = useSession()
  const [innerTab, setInnerTab] = useState('profile')
  const tab = controlledTab ?? innerTab
  const [profileDirty, setProfileDirty] = useState(false)
  const [pendingLeave, setPendingLeave] = useState<LeaveAction | null>(null)

  const selectTab = (next: string) => {
    if (controlledTab === undefined) {
      setInnerTab(next)
    }
    onTabChange?.(next)
  }

  const requestTab = (next: string) => {
    if (next === tab) {
      return
    }
    if (tab === 'profile' && profileDirty) {
      setPendingLeave({ kind: 'tab', value: next })
      return
    }
    selectTab(next)
  }

  const requestOpenChange = (next: boolean) => {
    if (!next && tab === 'profile' && profileDirty) {
      setPendingLeave({ kind: 'close' })
      return
    }
    onOpenChange(next)
  }

  const confirmLeave = () => {
    const action = pendingLeave
    setPendingLeave(null)
    setProfileDirty(false)
    if (!action) {
      return
    }
    if (action.kind === 'tab') {
      selectTab(action.value)
    } else {
      onOpenChange(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={requestOpenChange}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogTitle>Настройки пользователя</DialogTitle>
              <DialogDescription>
                {user ? user.nickname : 'Ваш аккаунт'} — профиль, звук, уведомления, приватность и
                приложение.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Закрыть"
                title="Закрыть"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <XIcon />
              </button>
            </DialogClose>
          </div>

          <Tabs value={tab} onValueChange={requestTab} className="flex min-h-0 flex-col gap-3">
            <TabsList aria-label="Разделы настроек">
              <TabsTrigger value="profile">Профиль</TabsTrigger>
              <TabsTrigger value="voice">Голос и видео</TabsTrigger>
              <TabsTrigger value="notifications">Уведомления</TabsTrigger>
              <TabsTrigger value="privacy">Приватность</TabsTrigger>
              <TabsTrigger value="app">Приложение</TabsTrigger>
              <TabsTrigger value="account">Аккаунт</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="min-h-0">
              {user && <ProfileSettings profile={user} onDirtyChange={setProfileDirty} />}
            </TabsContent>

            <TabsContent value="voice" className="max-h-[60vh] overflow-y-auto pr-1">
              <DeviceSettings />
            </TabsContent>

            <TabsContent value="notifications" className="flex flex-col gap-2">
              <NotificationSettings />
            </TabsContent>

            <TabsContent value="privacy" className="max-h-[60vh] overflow-y-auto pr-1">
              <PrivacySettings />
            </TabsContent>

            <TabsContent value="app" className="flex flex-col gap-2">
              <p className="text-sm text-fg-muted">
                Установите Orbit на рабочий стол — он откроется в своём окне и продолжит работать
                офлайн.
              </p>
              <InstallApp />
            </TabsContent>

            <TabsContent value="account" className="flex flex-col gap-4">
              {user && (
                <AccountSettings
                  profile={user}
                  claimGuest={
                    <ClaimGuest
                      onClaimed={() => {
                        // The account changed under the form: close it and let the
                        // one-time profile step take the screen.
                        onOpenChange(false)
                      }}
                    />
                  }
                />
              )}
              <div className="border-t border-border pt-4">
                <LogoutButton />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingLeave !== null}
        onOpenChange={(next) => {
          if (!next) {
            setPendingLeave(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle>Не сохранять изменения?</DialogTitle>
          <DialogDescription>
            {pendingLeave?.kind === 'close'
              ? 'Вы изменили профиль, но не сохранили его. Закрыть настройки?'
              : 'Вы изменили профиль, но не сохранили его. Перейти в другой раздел?'}
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPendingLeave(null)
              }}
            >
              Остаться
            </Button>
            <Button type="button" variant="danger" onClick={confirmLeave}>
              Уйти без сохранения
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
