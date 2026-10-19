import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { Label } from '@/shared/ui/label'

import { Switch } from './Switch'

const Labelled = () => {
  const [checked, setChecked] = useState(false)
  return (
    <>
      <Switch id="files" checked={checked} onCheckedChange={setChecked} />
      <Label htmlFor="files">Прикреплять файлы</Label>
    </>
  )
}

it('is named by its label and toggles by click, label and Space', async () => {
  render(<Labelled />)
  const toggle = screen.getByRole('switch', { name: 'Прикреплять файлы' })
  expect(toggle).not.toBeChecked()

  await userEvent.click(toggle)
  expect(toggle).toBeChecked()

  await userEvent.click(screen.getByText('Прикреплять файлы'))
  expect(toggle).not.toBeChecked()

  toggle.focus()
  await userEvent.keyboard(' ')
  expect(toggle).toBeChecked()
})
