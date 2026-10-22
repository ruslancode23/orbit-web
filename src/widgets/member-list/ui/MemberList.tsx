import { useEffect } from 'react'

import { useChannels } from '@/entities/channel'
import { UserAvatar, userDisplayName } from '@/entities/user'
import { useVoicePresence } from '@/entities/voice-presence'
import { useVoiceRoom } from '@/entities/voice-room'
import {
  colorRoleOf,
  useRoles,
  useWorkspaceMembers,
  type WorkspaceMember,
} from '@/entities/workspace'
import { ClaimGuest } from '@/features/claim-guest'
import { membersFromPresence, membersFromRoom } from '@/features/join-voice-channel'
import { UserCard } from '@/features/user-card'
import { accentOf } from '@/shared/lib/accent'
import { cn } from '@/shared/lib/cn'
import { Avatar } from '@/shared/ui/avatar'
import {
  HeadphonesOffIcon,
  MicOffIcon,
  ScreenIcon,
  SpeakerIcon,
  VolumeIcon,
  XIcon,
} from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Skeleton } from '@/shared/ui/skeleton'
import { Slider } from '@/shared/ui/slider'

import { MemberContextMenu } from './MemberContextMenu'
import { groupMembers } from '../model/groups'
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

/**
 * The people of the server, on the right where Discord keeps them: who is in
 * voice, then everyone by the roles shown apart. A click opens a card with the person's voice
 * state, their volume here, and the moderation an admin may do.
 */
export const MemberList = ({ workspaceId }: { workspaceId: string }) => {
  const open = useMemberPanelOpen()
  const { data: members } = useWorkspaceMembers(workspaceId)
  const { data: roles } = useRoles(workspaceId)
  const { data: channels } = useChannels(workspaceId)
  const { data: presence } = useVoicePresence(workspaceId)
  const { activeChannel, participants, screenShares, setParticipantVolume } = useVoiceRoom()

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
                            name={member ? userDisplayName(member.user) : state.name}
                            nameClass={
                              member ? accentOf(colorRoleOf(member, roles)?.color)?.text : undefined
                            }
                            voice={state}
                            userId={state.identity}
                            workspaceId={workspaceId}
                            {...volumeProps(state.identity)}
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
          // One flat list with the group headings in it: a member who gets a
          // role shown apart moves under it without remounting, so the card
          // they were opened in stays open.
          <ul aria-label="Участники сервера" className="flex flex-col gap-0.5 p-2">
            {groupMembers(members, roles).flatMap((group) => [
              <li
                key={`group-${group.key}`}
                className="px-1 pt-2 text-xs font-semibold tracking-wide text-fg-muted uppercase first:pt-0"
              >
                <h2>
                  {group.title} — {group.rows.length}
                </h2>
              </li>,
              ...group.rows.map((member) => (
                <li key={member.user.id}>
                  <MemberRow
                    member={member}
                    name={userDisplayName(member.user)}
                    nameClass={accentOf(colorRoleOf(member, roles)?.color)?.text}
                    voice={voiceStates.get(member.user.id)}
                    userId={member.user.id}
                    workspaceId={workspaceId}
                    {...volumeProps(member.user.id)}
                  />
                </li>
              )),
            ])}
          </ul>
        )}
      </aside>
    </>
  )
}

interface MemberRowProps {
  userId: string
  member: WorkspaceMember | undefined
  name: string
  /** The colour of the member's highest coloured role, as a text class. */
  nameClass: string | undefined
  voice: VoiceState | undefined
  workspaceId: string
  /** Set for someone in the room this client is in: their volume is local. */
  volume: number | undefined
  onVolume: ((volume: number) => void) | undefined
}

/**
 * One row of the member column. The whole row opens the same user card as the
 * rest of the app; the voice state and this device's volume are passed into it,
 * because they belong to this room rather than to the profile.
 */
const MemberRow = ({
  userId,
  member,
  name,
  nameClass,
  voice,
  workspaceId,
  volume,
  onVolume,
}: MemberRowProps) => {
  const extra =
    voice === undefined && (volume === undefined || onVolume === undefined) ? undefined : (
      <div className="flex flex-col gap-2 border-t border-border pt-2">
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
      </div>
    )

  return (
    <MemberContextMenu member={member} name={name}>
      <UserCard
        userId={userId}
        workspaceId={workspaceId}
        side="left"
        align="start"
        {...(extra === undefined ? {} : { extra })}
        triggerClassName="flex w-full items-center gap-2 px-1.5 py-1 text-left text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
        guestAction={<ClaimGuest />}
      >
        {member ? (
          <UserAvatar
            profile={member.user}
            size={20}
            status={member.presence}
            decorative
            className={cn('ring-2 ring-transparent', voice?.speaking && 'ring-success')}
          />
        ) : (
          <Avatar
            name={name}
            size={20}
            decorative
            className={cn('ring-2 ring-transparent', voice?.speaking && 'ring-success')}
          />
        )}
        <span className={cn('min-w-0 flex-1 truncate', nameClass)}>{name}</span>
        {member?.role === 'owner' && (
          <span className="rounded bg-surface-hover px-1 text-[10px] tracking-wide text-fg-muted uppercase">
            владелец
          </span>
        )}
        {member?.user.isGuest === true && (
          <span className="rounded bg-surface-hover px-1 text-[10px] tracking-wide text-fg-muted uppercase">
            гость
          </span>
        )}
        <VoiceMarks voice={voice} />
      </UserCard>
    </MemberContextMenu>
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
