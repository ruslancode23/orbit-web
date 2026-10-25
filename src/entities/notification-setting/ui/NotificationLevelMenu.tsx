import { useEffect } from 'react'

import {
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/shared/ui/context-menu'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/ui/dropdown-menu'
import { BellIcon, CheckIcon } from '@/shared/ui/icon'
import { useToast } from '@/shared/ui/toast'

import { describeMuteUntil, type NotificationTarget } from '../model/levels'
import { useNotificationMenu, type NotificationMenu } from '../model/use-notification-menu'

/** A refusal goes to a toast: the menu is already closed when the server answers. */
const useMenuError = (error: unknown) => {
  const toast = useToast()
  useEffect(() => {
    if (error !== null && error !== undefined) {
      toast('Не получилось изменить уведомления.', 'danger')
    }
  }, [error, toast])
}

const LevelMark = ({ selected }: { selected: boolean }) => {
  return (
    <span aria-hidden="true" className="flex w-4 shrink-0 justify-center">
      {selected && <CheckIcon className="size-3.5" />}
    </span>
  )
}

interface MenuBodyProps {
  menu: NotificationMenu
  Item: typeof ContextMenuItem | typeof DropdownMenuItem
  Separator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator
  Label: typeof ContextMenuLabel | typeof DropdownMenuLabel
}

/** The same choices in whichever menu is open; only the primitives differ. */
const MenuBody = ({ menu, Item, Separator, Label }: MenuBodyProps) => {
  return (
    <>
      {menu.levels.map((level) => (
        <Item
          key={level.value}
          role="menuitemradio"
          aria-checked={level.selected}
          disabled={menu.pending}
          onSelect={() => {
            menu.choose(level.value)
          }}
        >
          <LevelMark selected={level.selected} />
          {level.label}
        </Item>
      ))}
      <Separator />
      {menu.mutedUntil !== undefined && (
        <Label>Без звука до {describeMuteUntil(menu.mutedUntil)}</Label>
      )}
      {menu.mutes.map((mute) => (
        <Item
          key={mute.id}
          disabled={menu.pending}
          onSelect={() => {
            menu.muteFor(mute.ms)
          }}
        >
          <span aria-hidden="true" className="w-4 shrink-0" />
          {mute.label}
        </Item>
      ))}
      <Item
        disabled={menu.pending}
        onSelect={() => {
          menu.muteForever()
        }}
      >
        <span aria-hidden="true" className="w-4 shrink-0" />
        До включения
      </Item>
      {menu.canEnable && (
        <>
          <Separator />
          <Item
            disabled={menu.pending}
            onSelect={() => {
              menu.enable()
            }}
          >
            <span aria-hidden="true" className="w-4 shrink-0" />
            Включить уведомления
          </Item>
        </>
      )}
    </>
  )
}

interface NotificationLevelMenuProps {
  target: NotificationTarget
}

/**
 * «Уведомления» inside the context menu of a channel or a server: the level,
 * a mute deadline and the way back. The same choices are a button elsewhere
 * (the dialogue header), so a keyboard reaches them too.
 */
export const NotificationLevelContextMenu = ({ target }: NotificationLevelMenuProps) => {
  const menu = useNotificationMenu(target)
  useMenuError(menu.error)
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger disabled={menu.pending}>
        <BellIcon className="size-4 text-fg-muted" />
        Уведомления
      </ContextMenuSubTrigger>
      <ContextMenuSubContent aria-label="Уведомления">
        <MenuBody
          menu={menu}
          Item={ContextMenuItem}
          Separator={ContextMenuSeparator}
          Label={ContextMenuLabel}
        />
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}

/** The same choices in the «Действия с диалогом» dropdown of a conversation. */
export const NotificationLevelDropdownMenu = ({ target }: NotificationLevelMenuProps) => {
  const menu = useNotificationMenu(target)
  useMenuError(menu.error)
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={menu.pending}>
        <BellIcon className="size-4 text-fg-muted" />
        Уведомления
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent aria-label="Уведомления">
        <MenuBody
          menu={menu}
          Item={DropdownMenuItem}
          Separator={DropdownMenuSeparator}
          Label={DropdownMenuLabel}
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
