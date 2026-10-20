import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { useToast } from './useToast'

const Trigger = () => {
  const toast = useToast()
  return (
    <button
      type="button"
      onClick={() => {
        toast('Устройство отключилось', 'danger')
      }}
    >
      Показать
    </button>
  )
}

describe('toast', () => {
  it('announces a message as a status and lets it be dismissed', async () => {
    renderWithProviders(<Trigger />)

    await userEvent.click(screen.getByRole('button', { name: 'Показать' }))

    expect(await screen.findByText('Устройство отключилось')).toBeInTheDocument()
    expect(screen.getByText('Устройство отключилось').closest('[role="status"]')).not.toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть уведомление' }))

    await waitFor(() => {
      expect(screen.queryByText('Устройство отключилось')).not.toBeInTheDocument()
    })
  })
})
