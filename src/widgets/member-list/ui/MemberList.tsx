import { useEffect } from 'react'

import { useChannels } from '@/entities/channel'
import { initials } from '@/entities/participant'
import { useSession } from '@/entities/session'
import { useVoicePresence } from '@/entities/voice-presence'
import { useVoiceRoom } from '@/entities/voice-room'
import {
  useWorkspace,
  useWorkspaceMembers,
  type WorkspaceMember,
  type WorkspaceRole,
} from '@/entities/workspace'
import { membersFromPresence, membersFromRoom } from '@/features/join-voice-channel'
import {
  describeMemberActionError,
  mayChangeRole,
  mayModerate,
  ROLE_NAME,
  useMemberModeration,
} from '@/features/manage-members'
import { StartDirectChat } from '@/features/start-direct-chat'
import { StartSecretChat } from '@/features/start-secret-chat'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import {
  HeadphonesOffIcon,
  MicOffIcon,
  ScreenIcon,
  SpeakerIcon,
  VolumeIcon,
  XIcon,
} from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Skeleton } from '@/shared/ui/skeleton'
import { Slider } from '@/shared/ui/slider'

import { setMemberPanelOpen, useMemberPanelOpen } from '../model/member-panel'

/** Where a member is in voice and what they are doing there. */
interface VoiceState {
  channelId: string
  channelName: string
  name: string
  identity: string
  muted: boolean
  deafened: boolean
  screenSharing: boolean
  speaking: boolean
}

const ROLE_GROUPS: { role: WorkspaceRole; title: string }[] = [
  { role: 'owner', title: 'Владелец' },
  { role: 'admin', title: 'Администраторы' },
  { role: 'member', title: 'Участники' },
]

type Moderation = ReturnType<typeof useMemberModeration>

/**
 * The people of the server, on the right where Discord keeps them: who is in
 * voice, then everyone by role. A click opens a card with the person's voice
 * state, their volume here, and the moderation an admin may do.
 */
export const MemberList = ({ workspaceId }: { workspaceId: string }) => {
  const open = useMemberPanelOpen()
  const { user } = useSession()
  const { membership } = useWorkspace(workspaceId)
  const { data: members } = useWorkspaceMembers(workspaceId)
  const { data: channels } = useChannels(workspaceId)
  const { data: presence } = useVoicePresence(workspaceId)
  const { activeChannel, participants, screenShares, setParticipantVolume } = useVoiceRoom()
  const moderation = useMemberModeration(workspaceId)

  // On a narrow screen the column is a drawer over the chat: Esc or the X closes it.
  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !window.matchMedia('(max-width: 1023px)').matches) {
        return
      }
      setMemberPanelOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!open) {
    return null
  }

  const channelName = (id: string): string => {
    return channels?.find((channel) => channel.id === id)?.name ?? 'голосовой канал'
  }

  // Everyone in the voice channels of the server, the room this client is in
  // being the freshest source for its own channel.
  const voiceRooms: { channelId: string; channelName: string; states: VoiceState[] }[] = []
  for (const room of presence ?? []) {
    const states = membersFromPresence(room).map((member) => ({
      channelId: room.channelId,
      channelName: channelName(room.channelId),
      name: member.name,
      identity: member.id,
      muted: member.muted,
      deafened: member.deafened,
      screenSharing: member.screenSharing,
      speaking: false,
    }))
    if (states.length > 0) {
      voiceRooms.push({
        channelId: room.channelId,
        channelName: channelName(room.channelId),
        states,
      })
    }
  }
  if (activeChannel) {
    const screenSharers = screenShares.map((share) => share.participantIdentity)
    const current = membersFromRoom(participants, screenSharers).map((member) => ({
      channelId: activeChannel.id,
      channelName: activeChannel.name,
      name: member.name,
      identity: member.id,
      muted: member.muted,
      deafened: member.deafened,
      screenSharing: member.screenSharing,
      speaking: member.speaking,
    }))
    const index = voiceRooms.findIndex((room) => room.channelId === activeChannel.id)
    if (index === -1) {
      voiceRooms.push({
        channelId: activeChannel.id,
        channelName: activeChannel.name,
        states: current,
      })
    } else {
      const existing = voiceRooms[index]
      if (existing) {
        voiceRooms[index] = { ...existing, channelName: activeChannel.name, states: current }
      }
    }
  }

  const voiceStates = new Map<string, VoiceState>()
  let voiceCount = 0
  for (const room of voiceRooms) {
    for (const state of room.states) {
      voiceStates.set(state.identity, state)
      voiceCount += 1
    }
  }

  const role = membership?.role
  const myId = user?.id
  const remote = new Map(
    participants.filter((participant) => !participant.isLocal).map((p) => [p.identity, p]),
  )

  const volumeProps = (identity: string) => {
    const participant = remote.get(identity)
    if (!participant) {
      return { volume: undefined, onVolume: undefined }
    }
    return {
      volume: participant.volume,
      onVolume: (volume: number) => {
        setParticipantVolume(identity, volume)
      },
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-30 bg-bg/70 lg:hidden"
        onClick={() => {
          setMemberPanelOpen(false)
        }}
      />
      <aside
        aria-label="Участники"
        className="flex w-60 shrink-0 flex-col overflow-y-auto border-l border-border bg-bg max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:w-72 max-lg:shadow-popover"
      >
        <div className="flex shrink-0 items-center justify-between p-2 lg:hidden">
          <h2 className="text-sm font-semibold">Участники</h2>
          <IconButton
            label="Скрыть участников"
            size="sm"
            onClick={() => {
              setMemberPanelOpen(false)
            }}
          >
            <XIcon className="size-3.5" />
          </IconButton>
        </div>
        {voiceCount > 0 && (
          <section aria-label="В голосе" className="flex flex-col gap-2 border-b border-border p-2">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">
              В голосе — {voiceCount}
            </h2>
            {voiceRooms
              .filter((room) => room.states.length > 0)
              .map((room) => (
                <div key={room.channelId} className="flex flex-col gap-0.5">
                  <p className="flex items-center gap-1 px-1 text-xs text-fg-muted">
                    <SpeakerIcon className="size-3" />
                    <span className="truncate">{room.channelName}</span>
                  </p>
                  <ul aria-label={`В голосе: ${room.channelName}`}>
                    {room.states.map((state) => {
                      const member = members?.find((item) => item.user.id === state.identity)
                      return (
                        <li key={state.identity}>
                          <MemberRow
                            member={member}
                            name={member?.user.nickname ?? state.name}
                            voice={state}
                            workspaceId={workspaceId}
                            memberRole={role}
                            myId={myId}
                            {...volumeProps(state.identity)}
                            moderation={moderation}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
          </section>
        )}

        {members === undefined ? (
          <div role="status" aria-label="Загружаем участников" className="flex flex-col gap-2 p-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center gap-2">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : (
          ROLE_GROUPS.map((group) => {
            const rows = members
              .filter((member) => member.role === group.role)
              .sort((a, b) => a.user.nickname.localeCompare(b.user.nickname, 'ru'))
            if (rows.length === 0) {
              return null
            }
            return (
              <section
                key={group.role}
                aria-label={group.title}
                className="flex flex-col gap-0.5 p-2 pb-0 last:pb-2"
              >
                <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">
                  {group.title} — {rows.length}
                </h2>
                <ul>
                  {rows.map((member) => (
                    <li key={member.user.id}>
                      <MemberRow
                        member={member}
                        name={member.user.nickname}
                        voice={voiceStates.get(member.user.id)}
                        workspaceId={workspaceId}
                        memberRole={role}
                        myId={myId}
                        {...volumeProps(member.user.id)}
                        moderation={moderation}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </aside>
    </>
  )
}

interface MemberRowProps {
  member: WorkspaceMember | undefined
  name: string
  voice: VoiceState | undefined
  workspaceId: string
  memberRole: WorkspaceRole | undefined
  myId: string | undefined
  /** Set for someone in the room this client is in: their volume is local. */
  volume: number | undefined
  onVolume: ((volume: number) => void) | undefined
  moderation: Moderation
}

const MemberRow = ({
  member,
  name,
  voice,
  workspaceId,
  memberRole,
  myId,
  volume,
  onVolume,
  moderation,
}: MemberRowProps) => {
  const isMe = myId !== undefined && member?.user.id === myId
  const canChangeRole = member !== undefined && mayChangeRole(memberRole, member, myId)
  const canModerate = member !== undefined && mayModerate(memberRole, member, myId)
  const showActions = canChangeRole || canModerate

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[10px] font-semibold text-fg ring-2 ring-transparent',
              voice?.speaking && 'ring-success',
            )}
          >
            {initials(name)}
          </span>
          <span className="min-w-0 flex-1 truncate">{name}</span>
          {member?.user.isGuest === true && (
            <span className="rounded bg-surface-hover px-1 text-[10px] tracking-wide text-fg-muted uppercase">
              гость
            </span>
          )}
          <VoiceMarks voice={voice} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-72">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="truncate font-semibold">{name}</p>
            <p className="text-xs text-fg-muted">
              {member === undefined ? 'участник' : ROLE_NAME[member.role]}
              {isMe && ' · это вы'}
            </p>
          </div>

          {member && !isMe && (
            <div className="flex flex-wrap gap-1 border-t border-border pt-2">
              <StartDirectChat userId={member.user.id} size="sm" variant="ghost" />
              {!member.user.isGuest && (
                <StartSecretChat userId={member.user.id} nickname={member.user.nickname} />
              )}
            </div>
          )}

          {voice && (
            <p className="flex items-center gap-1 text-xs text-fg-muted">
              <SpeakerIcon className="size-3.5" />В голосе: {voice.channelName}
            </p>
          )}

          {volume !== undefined && onVolume !== undefined && (
            <div className="flex items-center gap-2 text-fg-muted">
              <VolumeIcon className="size-4 shrink-0" />
              <Slider
                aria-label={`Громкость: ${name}`}
                value={[Math.round(volume * 100)]}
                max={100}
                step={5}
                getValueText={(percent) => `${String(percent)} %`}
                onValueChange={([percent]) => {
                  if (percent !== undefined) {
                    onVolume(percent / 100)
                  }
                }}
              />
            </div>
          )}

          {showActions && (
            <div className="flex flex-wrap gap-1 border-t border-border pt-2">
              {memberRole === 'owner' && member.role !== 'admin' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    moderation.setRole.mutate({
                      path: { workspaceId, userId: member.user.id },
                      body: { role: 'admin' },
                    })
                  }}
                >
                  Сделать админом
                </Button>
              )}
              {memberRole === 'owner' && member.role === 'admin' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    moderation.setRole.mutate({
                      path: { workspaceId: workspaceId, userId: member.user.id },
                      body: { role: 'member' },
                    })
                  }}
                >
                  Снять админа
                </Button>
              )}
              {canModerate && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      moderation.remove.mutate({
                        path: { workspaceId: workspaceId, userId: member.user.id },
                      })
                    }}
                  >
                    Убрать
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      moderation.ban.mutate({
                        path: { workspaceId: workspaceId, userId: member.user.id },
                        body: {},
                      })
                    }}
                  >
                    Забанить
                  </Button>
                </>
              )}
            </div>
          )}

          {moderation.error && (
            <p role="alert" className="text-xs text-danger">
              {describeMemberActionError(moderation.error)}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Mute, deafen and screen marks; the words are for a screen reader. */
const VoiceMarks = ({ voice }: { voice: VoiceState | undefined }) => {
  if (!voice) {
    return null
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      {voice.screenSharing && (
        <span title="Показывает экран">
          <ScreenIcon className="size-3.5" />
          <span className="sr-only">показывает экран</span>
        </span>
      )}
      {voice.deafened ? (
        <span title="Звук выключен">
          <HeadphonesOffIcon className="size-3.5 text-danger" />
          <span className="sr-only">звук выключен</span>
        </span>
      ) : (
        voice.muted && (
          <span title="Микрофон выключен">
            <MicOffIcon className="size-3.5 text-danger" />
            <span className="sr-only">микрофон выключен</span>
          </span>
        )
      )}
    </span>
  )
}
