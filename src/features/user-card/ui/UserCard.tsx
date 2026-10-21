import { useEffect, useRef, useState, type ReactNode } from 'react'

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
  /** The way to a full account shown on a guest's own card. */
  guestAction?: ReactNode
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
 * "Открыть профиль" leads to the same content as a dialog. The full profile
 * also follows a person from «Общие друзья»: the dialog shows that profile
 * next, without opening a second window over the first. Every trigger is a
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
  guestAction,
  children,
}: UserCardProps) => {
  const [open, setOpen] = useState(false)
  // The id of the profile the dialog shows. It can differ from `userId` after
  // a click in «Общие друзья»; undefined means the dialog is closed.
  const [viewedProfileId, setViewedProfileId] = useState<string | undefined>(undefined)
  const [editOpen, setEditOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const { user } = useSession()
  // Nothing is asked for until the card is opened: a feed must not fetch every
  // author just because the avatars are clickable.
  const { data: profile, isPending, error } = useUserProfile(open ? userId : undefined)
  const { data: dialogProfile } = useUserProfile(viewedProfileId)
  const { data: members } = useWorkspaceMembers(open ? workspaceId : undefined)

  const member = members?.find((item) => item.user.id === userId)
  const dialogMember = members?.find((item) => item.user.id === dialogProfile?.id)
  const isMe = user?.id === userId
  const dialogIsMe = user?.id === dialogProfile?.id
  const showsOriginal = viewedProfileId === userId
  const name = profile ? userDisplayName(profile) : (label ?? 'Профиль')
  const dialogName = dialogProfile ? userDisplayName(dialogProfile) : (label ?? 'Профиль')
  const editableProfile = dialogProfile ?? profile

  // A new person in the same window starts at the top: the scroll position of
  // the previous profile would hide the avatar and leave the actions at hand.
  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.scrollTop = 0
    }
  }, [viewedProfileId])

  const closeCard = () => {
    setOpen(false)
  }

  const closeProfile = () => {
    setViewedProfileId(undefined)
    setOpen(false)
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          // A dialog opened from the card portals outside the popover; moving
          // into it must not close the card and lose the focus it returns to.
          if (!next && (viewedProfileId !== undefined || editOpen)) {
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
              {...(guestAction === undefined ? {} : { guestAction })}
              mode="popover"
              onEdit={() => {
                setEditOpen(true)
              }}
              onOpenProfile={() => {
                setViewedProfileId(userId)
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

      {dialogProfile && (
        <>
          <Dialog
            open
            onOpenChange={(next) => {
              if (!next) {
                setViewedProfileId(undefined)
              }
            }}
          >
            <DialogContent
              ref={dialogRef}
              className="max-h-[85vh] max-w-md gap-0 overflow-y-auto p-0"
            >
              <DialogTitle className="sr-only">Профиль {dialogName}</DialogTitle>
              <DialogDescription className="sr-only">
                Полный профиль {dialogName}: о себе, роль на сервере и дата регистрации.
              </DialogDescription>
              <UserCardDetails
                profile={dialogProfile}
                {...(dialogMember === undefined ? {} : { member: dialogMember })}
                {...(showsOriginal && status !== undefined ? { status } : {})}
                isMe={dialogIsMe}
                {...(workspaceId === undefined ? {} : { workspaceId })}
                {...(showsOriginal && extra !== undefined ? { extra } : {})}
                {...(showsOriginal && guestAction !== undefined ? { guestAction } : {})}
                mode="dialog"
                onEdit={() => {
                  setEditOpen(true)
                }}
                onOpenPerson={(nextUserId) => {
                  setViewedProfileId(nextUserId)
                }}
                onDone={closeProfile}
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      {editOpen && editableProfile && (
        <EditProfileDialog
          profile={editableProfile}
          onClose={() => {
            setEditOpen(false)
          }}
        />
      )}
    </>
  )
}
