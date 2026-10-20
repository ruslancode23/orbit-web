import { useSession } from '@/entities/session'
import { LogoutButton } from '@/features/auth'
import { ClaimGuest } from '@/features/claim-guest'
import { InstallApp } from '@/features/install-app'
import { NotificationSettings } from '@/features/notifications'
import { DeviceSettings } from '@/features/select-device'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

interface UserSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The one place for everything that used to be a button in the sidebar:
 * devices, notifications, the install offer, the guest account and signing out.
 */
export const UserSettings = ({ open, onOpenChange }: UserSettingsProps) => {
  const { user } = useSession()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <div className="flex flex-col gap-1">
          <DialogTitle>Настройки пользователя</DialogTitle>
          <DialogDescription>
            {user ? user.nickname : 'Ваш аккаунт'} — звук, уведомления и приложение.
          </DialogDescription>
        </div>

        <Tabs defaultValue="voice" className="flex min-h-0 flex-col gap-3">
          <TabsList aria-label="Разделы настроек">
            <TabsTrigger value="voice">Голос и видео</TabsTrigger>
            <TabsTrigger value="notifications">Уведомления</TabsTrigger>
            <TabsTrigger value="app">Приложение</TabsTrigger>
            <TabsTrigger value="account">Аккаунт</TabsTrigger>
          </TabsList>

          <TabsContent value="voice" className="max-h-[50vh] overflow-y-auto pr-1">
            <DeviceSettings />
          </TabsContent>

          <TabsContent value="notifications" className="flex flex-col gap-2">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="app" className="flex flex-col gap-2">
            <p className="text-sm text-fg-muted">
              Установите Orbit на рабочий стол — он откроется в своём окне и продолжит работать
              офлайн.
            </p>
            <InstallApp />
          </TabsContent>

          <TabsContent value="account" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{user?.nickname}</span>
              <span className="text-fg-muted">
                {user?.isGuest === true
                  ? 'Вы вошли как гость: серверы и история останутся, если создать аккаунт.'
                  : 'Полный аккаунт'}
              </span>
            </div>
            <ClaimGuest />
            <LogoutButton />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
