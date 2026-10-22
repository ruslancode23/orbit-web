const NAMED: Record<string, string> = {
  Backquote: '`',
  Space: 'Пробел',
  Tab: 'Tab',
  CapsLock: 'Caps Lock',
  Enter: 'Enter',
  Backspace: 'Backspace',
  ShiftLeft: 'Левый Shift',
  ShiftRight: 'Правый Shift',
  ControlLeft: 'Левый Ctrl',
  ControlRight: 'Правый Ctrl',
  AltLeft: 'Левый Alt',
  AltRight: 'Правый Alt',
  MetaLeft: 'Левый ⌘',
  MetaRight: 'Правый ⌘',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Insert: 'Insert',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Pause: 'Pause',
  ScrollLock: 'Scroll Lock',
}

/**
 * A `KeyboardEvent.code` as people read it: `KeyV` → «V», `Digit1` → «1»,
 * `Numpad5` → «Num 5». Codes are physical keys, so the label does not change with the layout.
 */
export const describeKey = (code: string): string => {
  const named = NAMED[code]
  if (named !== undefined) {
    return named
  }
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter?.[1] !== undefined) {
    return letter[1]
  }
  const digit = /^Digit(\d)$/.exec(code)
  if (digit?.[1] !== undefined) {
    return digit[1]
  }
  const numpad = /^Numpad(.+)$/.exec(code)
  if (numpad?.[1] !== undefined) {
    return `Num ${numpad[1]}`
  }
  return code
}

/** Keys that cannot be push-to-talk: they close dialogs or belong to the system. */
export const RESERVED_KEYS: ReadonlySet<string> = new Set(['Escape', 'Tab', 'Enter'])
