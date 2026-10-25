import { useState, type ReactNode } from 'react'

import { useSession } from '@/entities/session'
import { UserAvatar, userDisplayName } from '@/entities/user'
import { LogoutButton } from '@/features/auth'
import { ClaimGuest } from '@/features/claim-guest'
import { InstallApp } from '@/features/install-app'
import { forgetPushOnThisDevice, NotificationSettings } from '@/features/notifications'
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

/** A section's heading inside the content pane, under the tall sidebar. */
const SectionHeading = ({ title, hint }: { title: string; hint: string }) => {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-sm text-fg-muted">{hint}</p>
    </div>
  )
}

/** A section in the left rail: the same trigger, only its section differs. */
const SettingsTab = ({ value, children }: { value: string; children: ReactNode }) => {
  return (
    <TabsTrigger
      value={value}
      className="flex-none justify-start px-3 py-2 text-left text-sm whitespace-nowrap md:w-full"
    >
      {children}
    </TabsTrigger>
  )
}

/**
 * The one place for everything that belongs to the person: profile, devices,
 * notifications, the install offer, the account and signing out.
 *
 * It takes the whole window, so switching sections never moves or resizes it:
 * the sections only fill the scrolling pane on the right. The profile tab is a
 * form with a live card, so switching away from unsaved edits — or closing the
 * dialog — asks first instead of throwing them away.
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
        <DialogContent className="inset-0 top-0 left-0 h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 p-0">
          <Tabs
            value={tab}
            onValueChange={requestTab}
            orientation="vertical"
            className="flex min-h-0 flex-1 flex-col md:flex-row"
          >
            <aside className="flex shrink-0 flex-col gap-4 border-b border-border bg-bg p-4 md:min-h-0 md:w-72 md:overflow-y-auto md:border-r md:border-b-0 md:p-5">
              <div className="flex min-w-0 flex-col gap-1 pr-12 md:pr-0">
                <DialogTitle>Настройки пользователя</DialogTitle>
                <DialogDescription className="text-xs">
                  {user ? user.nickname : 'Ваш аккаунт'} — профиль, звук, уведомления, приватность и
                  приложение.
                </DialogDescription>
              </div>

              <TabsList
                aria-label="Разделы настроек"
                className="w-full flex-row flex-wrap rounded-none bg-transparent p-0 md:flex-col md:flex-nowrap"
              >
                <SettingsTab value="profile">Профиль</SettingsTab>
                <SettingsTab value="voice">Голос и видео</SettingsTab>
                <SettingsTab value="notifications">Уведомления</SettingsTab>
                <SettingsTab value="privacy">Приватность</SettingsTab>
                <SettingsTab value="app">Приложение</SettingsTab>
                <SettingsTab value="account">Аккаунт</SettingsTab>
              </TabsList>

              {user && (
                <div className="mt-auto hidden items-center gap-2.5 rounded-md border border-border bg-surface p-2.5 md:flex">
                  <UserAvatar profile={user} size={32} decorative />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{userDisplayName(user)}</p>
                    <p className="truncate text-xs text-fg-muted">@{user.nickname}</p>
                  </div>
                </div>
              )}
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* A new key per section puts the pane back at the top. */}
                <div key={tab} className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
                  <TabsContent value="profile" className="flex flex-col gap-5">
                    <SectionHeading
                      title="Профиль"
                      hint="Так вас видят другие. Изменения сохраняются кнопкой."
                    />
                    {user && <ProfileSettings profile={user} onDirtyChange={setProfileDirty} />}
                  </TabsContent>

                  <TabsContent value="voice" className="flex flex-col gap-5">
                    <SectionHeading
                      title="Голос и видео"
                      hint="Микрофон, динамики и обработка звука."
                    />
                    <DeviceSettings />
                  </TabsContent>

                  <TabsContent value="notifications" className="flex flex-col gap-5">
                    <SectionHeading title="Уведомления" hint="Что и когда присылает уведомления." />
                    <NotificationSettings />
                  </TabsContent>

                  <TabsContent value="privacy" className="flex flex-col gap-5">
                    <SectionHeading
                      title="Приватность"
                      hint="Кто может писать и кто видит ваш профиль."
                    />
                    <PrivacySettings />
                  </TabsContent>

                  <TabsContent value="app" className="flex flex-col gap-5">
                    <SectionHeading title="Приложение" hint="Установка и офлайн-режим." />
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-fg-muted">
                        Установите Orbit на рабочий стол — он откроется в своём окне и продолжит
                        работать офлайн.
                      </p>
                      <InstallApp />
                      <a
                        href="/beta"
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-accent underline underline-offset-2"
                      >
                        О закрытой бете
                      </a>
                    </div>
                  </TabsContent>

                  <TabsContent value="account" className="flex flex-col gap-5">
                    <SectionHeading title="Аккаунт" hint="Ник, почта и пароль." />
                    {user && (
                      <>
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
                        <div className="border-t border-border pt-4">
                          <LogoutButton beforeSignOut={forgetPushOnThisDevice} />
                        </div>
                      </>
                    )}
                  </TabsContent>
                </div>
              </div>
            </div>

            <DialogClose asChild>
              <button
                type="button"
                aria-label="Закрыть"
                title="Закрыть"
                className="absolute top-3 right-3 z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors duration-150 hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none md:top-4 md:right-4"
              >
                <XIcon />
              </button>
            </DialogClose>
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
