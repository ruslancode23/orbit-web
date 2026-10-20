import { useState, type ReactNode } from 'react'

import { useSession } from '@/entities/session'
import { userDisplayName, useUserProfile } from '@/entities/user'
import { useWorkspaceMembers } from '@/entities/workspace'
import { cn } from '@/shared/lib/cn'
import { Avatar, type AvatarStatus } from '@/shared/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Skeleton } from '@/shared/ui/skeleton'

import { EditProfileDialog } from './EditProfileDialog'
import { StartDirectChat } from './StartDirectChat'
import { UserCardDetails } from './UserCardDetails'

export interface UserCardProps {
  userId: string
  /** The open server: its member list gives the role, presence and moderation. */
  workspaceId?: string
  /** The accessible name of the trigger when the trigger is only a picture. */
  label?: string
  /** Presence, when the place the trigger sits in already knows it. */
  status?: AvatarStatus
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  triggerClassName?: string
  /** Extra card content, such as the voice state and volume in the member list. */
  extra?: ReactNode
  /** What the trigger draws; the card around it is the same everywhere. */
  children: ReactNode
}

const CardSkeleton = () => {
  return (
    <div role="status" aria-label="Загружаем профиль" className="flex flex-col gap-3 p-4">
      <div className="flex items-end gap-2">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-full" />
    </div>
  )
}

/**
 * One person's card, wherever a person is shown: a popover with the profile,
 * its actions and — for the current server — the moderation an admin may do.
 * "Открыть профиль" leads to the same content as a dialog. Every trigger is a
 * real button, so Enter and Space open it; Radix closes it on Esc and returns
 * the focus to that trigger.
 */
export const UserCard = ({
  userId,
  workspaceId,
  label,
  status,
  side = 'bottom',
  align = 'center',
  triggerClassName,
  extra,
  children,
}: UserCardProps) => {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const { user } = useSession()
  // Nothing is asked for until the card is opened: a feed must not fetch every
  // author just because the avatars are clickable.
  const { data: profile, isPending, error } = useUserProfile(open ? userId : undefined)
  const { data: members } = useWorkspaceMembers(open ? workspaceId : undefined)

  const member = members?.find((item) => item.user.id === userId)
  const isMe = user?.id === userId
  const name = profile ? userDisplayName(profile) : (label ?? 'Профиль')

  const closeCard = () => {
    setOpen(false)
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          // A dialog opened from the card portals outside the popover; moving
          // into it must not close the card and lose the focus it returns to.
          if (!next && (profileOpen || editOpen)) {
            return
          }
          setOpen(next)
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            aria-haspopup="dialog"
            className={cn(
              'min-w-0 rounded-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none',
              triggerClassName,
            )}
          >
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={side}
          align={align}
          aria-label={`Карточка ${name}`}
          className="w-80 overflow-hidden p-0"
        >
          {isPending ? (
            <CardSkeleton />
          ) : profile ? (
            <UserCardDetails
              profile={profile}
              {...(member === undefined ? {} : { member })}
              {...(status === undefined ? {} : { status })}
              isMe={isMe}
              {...(workspaceId === undefined ? {} : { workspaceId })}
              {...(extra === undefined ? {} : { extra })}
              mode="popover"
              onEdit={() => {
                setEditOpen(true)
              }}
              onOpenProfile={() => {
                setProfileOpen(true)
              }}
              onDone={closeCard}
            />
          ) : (
            <div className="flex flex-col gap-3 p-4">
              <Avatar name={name} size={80} />
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold">{name}</p>
                <p className="text-sm text-fg-muted">
                  {error ? 'Не удалось загрузить профиль.' : 'Профиля нет.'}
                </p>
              </div>
              {!isMe && <StartDirectChat userId={userId} onDone={closeCard} />}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {profile && (
        <>
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent className="max-h-[85vh] max-w-md gap-0 overflow-y-auto p-0">
              <DialogTitle className="sr-only">Профиль {name}</DialogTitle>
              <DialogDescription className="sr-only">
                Полный профиль {name}: о себе, роль на сервере и дата регистрации.
              </DialogDescription>
              <UserCardDetails
                profile={profile}
                {...(member === undefined ? {} : { member })}
                {...(status === undefined ? {} : { status })}
                isMe={isMe}
                {...(workspaceId === undefined ? {} : { workspaceId })}
                {...(extra === undefined ? {} : { extra })}
                mode="dialog"
                onEdit={() => {
                  setEditOpen(true)
                }}
                onDone={() => {
                  setProfileOpen(false)
                }}
              />
            </DialogContent>
          </Dialog>

          {editOpen && (
            <EditProfileDialog
              profile={profile}
              onClose={() => {
                setEditOpen(false)
              }}
            />
          )}
        </>
      )}
    </>
  )
}
