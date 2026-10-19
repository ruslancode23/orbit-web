import { formatSize, previewSize } from './attachment'

const base = {
  id: 'a-1',
  fileName: 'cat.png',
  mimeType: 'image/png',
  sizeBytes: 1n,
  createdAt: new Date(),
}

it('writes sizes as people read them', () => {
  expect(formatSize(512)).toBe('512 Б')
  expect(formatSize(1536)).toBe('1,5 КБ')
  expect(formatSize(25n * 1024n * 1024n)).toBe('25 МБ')
})

it('fits a preview into its box, keeping the shape', () => {
  expect(previewSize({ ...base, width: 1920, height: 1080 })).toEqual({ width: 360, height: 203 })
  expect(previewSize({ ...base, width: 100, height: 50 })).toEqual({ width: 100, height: 50 })
})
