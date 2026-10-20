import { useParams } from 'react-router'

import { useChannels, type Channel } from '@/entities/channel'
import { ParticipantTile } from '@/entities/participant'
import { useVoiceRoom } from '@/entities/voice-room'
import { can, useWorkspace } from '@/entities/workspace'
import { useVoiceChannel } from '@/features/join-voice-channel'
import { ScreenShares } from '@/features/share-screen'
import { Button } from '@/shared/ui/button'
import { HashIcon, SpeakerIcon, UsersIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { ChannelChat } from '@/widgets/channel-chat'
import { MemberList, toggleMemberPanel, useMemberPanelOpen } from '@/widgets/member-list'

/**
 * One channel: its name and topic in a thin header, then either the chat or the
 * voice tiles, with the members of the server on the right.
 */
const ChannelPage = () => {
  const { workspaceId, channelId } = useParams()
  const { data: channels } = useChannels(workspaceId)
  const channel = channels?.find((item) => item.id === channelId)
  const { membership } = useWorkspace(workspaceId)

  if (!workspaceId || !channelId) {
    return null
  }

  if (channel?.kind === 'voice') {
    return <VoiceChannelPage channel={channel} workspaceId={workspaceId} />
  }

  return (
    <section aria-label="Канал" className="flex min-h-0 flex-1 flex-col">
      <ChannelHeader channel={channel} />
      <div className="flex min-h-0 flex-1">
        <ChannelChat
          workspaceId={workspaceId}
          channelId={channelId}
          canWrite={channel?.canWrite ?? false}
          canAttach={can(membership, 'canAttachFiles')}
        />
        <MemberList workspaceId={workspaceId} />
      </div>
    </section>
  )
}

const ChannelHeader = ({ channel }: { channel: Channel | undefined }) => {
  const memberOpen = useMemberPanelOpen()

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <HashIcon className="size-5 shrink-0 text-fg-muted" />
      <h1
        aria-label={`# ${channel?.name ?? '…'}`}
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

const VoiceChannelPage = ({ channel, workspaceId }: { channel: Channel; workspaceId: string }) => {
  const { connect, connecting } = useVoiceChannel()
  const { activeChannel, participants, screenShares } = useVoiceRoom()
  const memberOpen = useMemberPanelOpen()
  const here = activeChannel?.id === channel.id
  const screenSharers = new Set(screenShares.map((share) => share.participantIdentity))

  return (
    <section aria-label="Голосовой канал" className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <SpeakerIcon className="size-5 shrink-0 text-fg-muted" />
        <h1 aria-label={channel.name} className="min-w-0 shrink-0 truncate text-sm font-semibold">
          {channel.name}
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-1">
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
