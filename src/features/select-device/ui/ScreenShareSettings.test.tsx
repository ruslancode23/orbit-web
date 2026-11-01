import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { ScreenShareSettings } from './ScreenShareSettings'

afterEach(() => {
  localStorage.clear()
})

it('starts with 1080p at 30 fps', () => {
  renderWithProviders(<ScreenShareSettings />)

  expect(screen.getByRole('radio', { name: /1080p/ })).toBeChecked()
  expect(screen.getByRole('radio', { name: /30 кадров/ })).toBeChecked()
  expect(localStorage.getItem('orbit.voice.screen-resolution')).toBeNull()
  expect(localStorage.getItem('orbit.voice.screen-frame-rate')).toBeNull()
})

it('remembers 720p at 60 fps and restores it on the next render', async () => {
  const { unmount } = renderWithProviders(<ScreenShareSettings />)

  await userEvent.click(screen.getByRole('radio', { name: /720p/ }))
  await userEvent.click(screen.getByRole('radio', { name: /60 кадров/ }))

  expect(localStorage.getItem('orbit.voice.screen-resolution')).toBe('720p')
  expect(localStorage.getItem('orbit.voice.screen-frame-rate')).toBe('60')
  expect(screen.getByRole('radio', { name: /720p/ })).toBeChecked()
  expect(screen.getByRole('radio', { name: /60 кадров/ })).toBeChecked()

  unmount()
  renderWithProviders(<ScreenShareSettings />)

  expect(screen.getByRole('radio', { name: /720p/ })).toBeChecked()
  expect(screen.getByRole('radio', { name: /60 кадров/ })).toBeChecked()
})

it('keeps the resolution when only the frame rate changes', async () => {
  renderWithProviders(<ScreenShareSettings />)

  await userEvent.click(screen.getByRole('radio', { name: /60 кадров/ }))

  expect(screen.getByRole('radio', { name: /1080p/ })).toBeChecked()
  expect(screen.getByRole('radio', { name: /60 кадров/ })).toBeChecked()
  expect(localStorage.getItem('orbit.voice.screen-resolution')).toBe('1080p')
})

it('falls back to the default when the stored choice is unknown', () => {
  localStorage.setItem('orbit.voice.screen-resolution', '4k')
  localStorage.setItem('orbit.voice.screen-frame-rate', '120')

  renderWithProviders(<ScreenShareSettings />)

  expect(screen.getByRole('radio', { name: /1080p/ })).toBeChecked()
  expect(screen.getByRole('radio', { name: /30 кадров/ })).toBeChecked()
})
