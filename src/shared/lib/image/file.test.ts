import { checkImageFile, formatMegabytes } from './file'

const file = (type: string, bytes: number) => new File([new Uint8Array(bytes)], 'icon', { type })

it('accepts PNG, JPEG and WebP within the size', () => {
  expect(checkImageFile(file('image/png', 10), 100)).toBeNull()
  expect(checkImageFile(file('image/jpeg', 10), 100)).toBeNull()
  expect(checkImageFile(file('image/webp', 100), 100)).toBeNull()
})

it('names what is wrong with a file', () => {
  expect(checkImageFile(file('image/gif', 10), 100)).toBe('type')
  expect(checkImageFile(file('application/pdf', 10), 100)).toBe('type')
  expect(checkImageFile(file('image/png', 101), 100)).toBe('size')
})

it('writes sizes the Russian way', () => {
  expect(formatMegabytes(2 * 1024 * 1024)).toBe('2 МБ')
  expect(formatMegabytes(1.5 * 1024 * 1024)).toBe('1,5 МБ')
})
