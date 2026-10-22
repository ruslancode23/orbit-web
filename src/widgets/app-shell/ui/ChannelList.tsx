import { useState } from 'react'
import { NavLink } from 'react-router'

import { channelAllows, useChannels, type Channel } from '@/entities/channel'
import { describeUnread, UnreadBadge, useWorkspaceUnread } from '@/entities/unread'
import { useVoicePresence } from '@/entities/voice-presence'
import { useVoiceRoom } from '@/entities/voice-room'
import { EditChannel } from '@/features/edit-channel'
import {
  membersFromPresence,
  membersFromRoom,
  VoiceChannelButton,
} from '@/features/join-voice-channel'
import { ManageInvites } from '@/features/manage-invites'
import { cn } from '@/shared/lib/cn'
import { ChevronDownIcon, HashIcon, LinkIcon, SettingsIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Skeleton } from '@/shared/ui/skeleton'

import { setChannelSidebarOpen } from '../model/channel-sidebar'

interface ChannelListProps {
  workspaceId: string
  /** The text channel the reader is in; its own count would only flicker. */
  activeChannelId: string | undefined
  /** Channel settings on each row: manageChannels. */
  canManage: boolean
  /** The list of invite links: manageServer. */
  canManageInvites: boolean
  canInvite: boolean
}

const TEXT_GROUP_KEY = 'orbit.channels.text-open'
const VOICE_GROUP_KEY = 'orbit.channels.voice-open'

const readGroupOpen = (key: string): boolean => {
  try {
    return localStorage.getItem(key) !== 'false'
  } catch {
    return true
  }
}

const writeGroupOpen = (key: string, open: boolean): void => {
  try {
    localStorage.setItem(key, String(open))
  } catch {
    // The group still opens; it just is not remembered.
  }
}

/**
 * The channels of the server, grouped as in Discord: text first, then voice.
 * Each group folds away and keeps its state, the list scrolls on its own, and
 * the actions of a row appear on hover or focus.
 */
export const ChannelList = ({
  workspaceId,
  activeChannelId,
  canManage,
  canManageInvites,
  canInvite,
}: ChannelListProps) => {
  const { data: channels } = useChannels(workspaceId)
  const { data: unread } = useWorkspaceUnread(workspaceId, { watched: true })
  const { data: voicePresence } = useVoicePresence(workspaceId)
  const { activeChannel, participants, screenShares, isSharingScreen, room } = useVoiceRoom()
  const [textOpen, setTextOpen] = useState(() => readGroupOpen(TEXT_GROUP_KEY))
  const [voiceOpen, setVoiceOpen] = useState(() => readGroupOpen(VOICE_GROUP_KEY))
  const [editing, setEditing] = useState<Channel | undefined>(undefined)
  const [invitesOpen, setInvitesOpen] = useState(false)
  // A channel may be managed by an override even when the server says no.
  const managesChannel = (channel: Channel) => channelAllows(channel, 'manageChannels', canManage)

  const textChannels = channels?.filter((channel) => channel.kind === 'text') ?? []
  const voiceChannels = channels?.filter((channel) => channel.kind === 'voice') ?? []
  const screenSharers = screenShares.map((share) => share.participantIdentity)
  if (activeChannel && isSharingScreen && room) {
    screenSharers.push(room.localParticipant.identity)
  }

  const toggleGroup = (key: string, open: boolean, setOpen: (open: boolean) => void) => {
    setOpen(!open)
    writeGroupOpen(key, !open)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 py-1">
      {channels === undefined ? (
        <div role="status" aria-label="Загружаем каналы" className="flex flex-col gap-2 p-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="mt-2 h-3 w-28" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : (
        <>
          {channels.length === 0 && <p className="px-1 text-xs text-fg-muted">Пока нет каналов</p>}

          <section aria-label="Текстовые каналы">
            <button
              type="button"
              aria-expanded={textOpen}
              className="flex w-full items-center gap-1 rounded px-1 py-1 text-xs font-semibold tracking-wide text-fg-muted uppercase hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              onClick={() => {
                toggleGroup(TEXT_GROUP_KEY, textOpen, setTextOpen)
              }}
            >
              <ChevronDownIcon
                className={cn('size-3 transition-transform', !textOpen && '-rotate-90')}
              />
              Текстовые
            </button>
            {textOpen && (
              <ul className="flex flex-col gap-0.5">
                {textChannels.map((channel) => {
                  const counts = unread?.find((item) => item.channelId === channel.id)
                  const shown =
                    counts && channel.id !== activeChannelId
                      ? { unread: counts.unread, mentions: counts.mentions }
                      : { unread: 0, mentions: 0 }
                  const description = describeUnread(shown)
                  return (
                    <li key={channel.id} className="group/row relative">
                      <NavLink
                        to={`/s/${workspaceId}/${channel.id}`}
                        onClick={() => {
                          setChannelSidebarOpen(false)
                        }}
                        aria-label={
                          description ? `# ${channel.name}, ${description}` : `# ${channel.name}`
                        }
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-1.5 rounded-md py-1 pr-14 pl-2 text-sm transition-colors',
                            isActive
                              ? 'bg-surface-hover text-fg'
                              : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
                            shown.unread > 0 && 'font-semibold text-fg',
                          )
                        }
                      >
                        <HashIcon className="size-4 shrink-0 text-fg-muted" />
                        <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                        <UnreadBadge unread={shown.unread} mentions={shown.mentions} />
                      </NavLink>
                      {(canInvite || managesChannel(channel)) && (
                        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 rounded bg-surface-hover opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100">
                          {canInvite && (
                            <IconButton
                              label="Пригласить людей"
                              size="sm"
                              className="size-6"
                              onClick={() => {
                                setInvitesOpen(true)
                              }}
                            >
                              <LinkIcon className="size-3.5" />
                            </IconButton>
                          )}
                          {managesChannel(channel) && (
                            <IconButton
                              label={`Настройки канала ${channel.name}`}
                              size="sm"
                              className="size-6"
                              onClick={() => {
                                setEditing(channel)
                              }}
                            >
                              <SettingsIcon className="size-3.5" />
                            </IconButton>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section aria-label="Голосовые каналы">
            <button
              type="button"
              aria-expanded={voiceOpen}
              className="flex w-full items-center gap-1 rounded px-1 py-1 text-xs font-semibold tracking-wide text-fg-muted uppercase hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              onClick={() => {
                toggleGroup(VOICE_GROUP_KEY, voiceOpen, setVoiceOpen)
              }}
            >
              <ChevronDownIcon
                className={cn('size-3 transition-transform', !voiceOpen && '-rotate-90')}
              />
              Голосовые
            </button>
            {voiceOpen && (
              <ul className="flex flex-col gap-1">
                {voiceChannels.map((channel) => {
                  const current = activeChannel?.id === channel.id
                  const members = current
                    ? membersFromRoom(participants, screenSharers)
                    : membersFromPresence(
                        voicePresence?.find((presence) => presence.channelId === channel.id),
                      )
                  return (
                    <li key={channel.id} className="group/row relative">
                      <VoiceChannelButton channel={channel} members={members} />
                      {managesChannel(channel) && (
                        <div className="absolute top-0.5 right-1 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100">
                          <IconButton
                            label={`Настройки канала ${channel.name}`}
                            size="sm"
                            className="size-6 bg-surface"
                            onClick={() => {
                              setEditing(channel)
                            }}
                          >
                            <SettingsIcon className="size-3.5" />
                          </IconButton>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {editing && (
        <EditChannel
          workspaceId={workspaceId}
          channel={editing}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(undefined)
            }
          }}
        />
      )}
      <ManageInvites
        workspaceId={workspaceId}
        canInvite={canInvite}
        canManage={canManageInvites}
        open={invitesOpen}
        onOpenChange={setInvitesOpen}
      />
    </div>
  )
}
