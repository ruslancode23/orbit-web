/**
 * Copies text the way a browser allows. The async Clipboard API needs a secure
 * context and permission; when it is missing or refused, the old selection +
 * `execCommand` path still works in ordinary pages.
 */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // No Clipboard API, no permission, or no secure context: select and copy.
  }

  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.append(field)
  field.select()
  try {
    const exec = Reflect.get(document, 'execCommand')
    if (typeof exec !== 'function') {
      return false
    }
    return exec.call(document, 'copy')
  } finally {
    field.remove()
  }
}
