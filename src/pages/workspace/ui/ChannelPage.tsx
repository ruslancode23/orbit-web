import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useChannels, type Channel } from '@/entities/channel'
import { ParticipantTile } from '@/entities/participant'
import { useVoiceRoom } from '@/entities/voice-room'
import { atLeast, can, useWorkspace } from '@/entities/workspace'
import { ClaimGuest } from '@/features/claim-guest'
import { useVoiceChannel } from '@/features/join-voice-channel'
import { ManageInvites } from '@/features/manage-invites'
import { ScreenShares } from '@/features/share-screen'
import { UserCard } from '@/features/user-card'
import { Button } from '@/shared/ui/button'
import { HashIcon, LinkIcon, SpeakerIcon, UsersIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { useToast } from '@/shared/ui/toast'
import { ChannelChat } from '@/widgets/channel-chat'
import { MemberList, toggleMemberPanel, useMemberPanelOpen } from '@/widgets/member-list'

/**
 * One channel: its name and topic in a thin header, then either the chat or the
 * voice tiles, with the members of the server on the right.
 */
const ChannelPage = () => {
  const { workspaceId, channelId } = useParams()
  const { data: channels } = useChannels(workspaceId)
  const { membership } = useWorkspace(workspaceId)
  const [invitesOpen, setInvitesOpen] = useState(false)
  const channel = channels?.find((item) => item.id === channelId)
  const navigate = useNavigate()
  const toast = useToast()
  // The list is loaded and this channel is not in it: someone deleted it while
  // it was open (channel.deleted refreshed the list), or the link is stale.
  const gone = channels !== undefined && channelId !== undefined && channel === undefined

  // Said once per channel: the effect may run again before the navigation lands.
  const leftRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!gone || !workspaceId || leftRef.current === channelId) {
      return
    }
    leftRef.current = channelId
    toast('Канал удалён или больше недоступен.')
    void navigate(`/s/${workspaceId}`, { replace: true })
  }, [gone, workspaceId, channelId, navigate, toast])

  if (!workspaceId || !channelId) {
    return null
  }

  const canInvite = can(membership, 'canInvite')
  const canManage = atLeast(membership?.role, 'admin')
  const openInvites = () => {
    setInvitesOpen(true)
  }

  return (
    <>
      {channel?.kind === 'voice' ? (
        <VoiceChannelPage
          channel={channel}
          workspaceId={workspaceId}
          canInvite={canInvite}
          onInvite={openInvites}
        />
      ) : (
        <section aria-label="Канал" className="flex min-h-0 flex-1 flex-col">
          <ChannelHeader channel={channel} canInvite={canInvite} onInvite={openInvites} />
          <div className="flex min-h-0 flex-1">
            <ChannelChat
              workspaceId={workspaceId}
              channelId={channelId}
              {...(channel === undefined
                ? {}
                : { channelName: channel.name, channelTopic: channel.topic })}
              canWrite={channel?.canWrite ?? false}
              canAttach={can(membership, 'canAttachFiles')}
            />
            <MemberList workspaceId={workspaceId} />
          </div>
        </section>
      )}

      {canInvite && (
        <ManageInvites
          workspaceId={workspaceId}
          canInvite
          canManage={canManage}
          open={invitesOpen}
          onOpenChange={setInvitesOpen}
        />
      )}
    </>
  )
}

interface ChannelHeaderProps {
  channel: Channel | undefined
  canInvite: boolean
  onInvite: () => void
  /** A voice channel shows a speaker instead of a hash. */
  voice?: boolean
}

const ChannelHeader = ({ channel, canInvite, onInvite, voice = false }: ChannelHeaderProps) => {
  const memberOpen = useMemberPanelOpen()
  const Icon = voice ? SpeakerIcon : HashIcon

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 max-lg:pl-14">
      <Icon className="size-5 shrink-0 text-fg-muted" />
      <h1
        aria-label={voice ? (channel?.name ?? '…') : `# ${channel?.name ?? '…'}`}
        className="min-w-0 shrink-0 truncate text-sm font-semibold"
      >
        {channel?.name ?? '…'}
      </h1>
      {channel?.topic && (
        <>
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
          <p title={channel.topic} className="min-w-0 flex-1 truncate text-xs text-fg-muted">
            {channel.topic}
          </p>
        </>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {canInvite && (
          <IconButton label="Пригласить людей" onClick={onInvite}>
            <LinkIcon />
          </IconButton>
        )}
        <IconButton
          label="Участники"
          tooltip={memberOpen ? 'Скрыть участников' : 'Показать участников'}
          pressed={memberOpen}
          onClick={toggleMemberPanel}
        >
          <UsersIcon />
        </IconButton>
      </div>
    </header>
  )
}

const VoiceChannelPage = ({
  channel,
  workspaceId,
  canInvite,
  onInvite,
}: {
  channel: Channel
  workspaceId: string
  canInvite: boolean
  onInvite: () => void
}) => {
  const { connect, connecting } = useVoiceChannel()
  const { activeChannel, participants, screenShares } = useVoiceRoom()
  const here = activeChannel?.id === channel.id
  const screenSharers = new Set(screenShares.map((share) => share.participantIdentity))

  return (
    <section aria-label="Голосовой канал" className="flex min-h-0 flex-1 flex-col">
      <ChannelHeader channel={channel} canInvite={canInvite} onInvite={onInvite} voice />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {here ? (
            <>
              <div
                role="list"
                aria-label="Участники канала"
                className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3"
              >
                {participants.map((participant) => (
                  <div role="listitem" key={participant.identity}>
                    <ParticipantTile
                      participant={participant}
                      screenSharing={screenSharers.has(participant.identity)}
                      renderTrigger={(part, content) => (
                        <UserCard
                          userId={participant.identity}
                          workspaceId={workspaceId}
                          guestAction={<ClaimGuest />}
                          {...(part === 'avatar' ? { label: participant.name } : {})}
                          triggerClassName={
                            part === 'name' ? 'inline-flex max-w-full' : 'inline-flex shrink-0'
                          }
                        >
                          {content}
                        </UserCard>
                      )}
                    />
                  </div>
                ))}
              </div>
              <ScreenShares />
            </>
          ) : (
            <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center">
              <SpeakerIcon className="size-10 text-fg-muted" />
              <p className="text-sm text-fg-muted">
                Голосовой канал. Подключитесь, чтобы говорить и слышать участников.
              </p>
              <Button
                disabled={connecting}
                onClick={() => {
                  void connect(channel)
                }}
              >
                {connecting ? 'Подключаемся…' : 'Подключиться'}
              </Button>
            </div>
          )}
        </div>
        <MemberList workspaceId={workspaceId} />
      </div>
    </section>
  )
}

export default ChannelPage
