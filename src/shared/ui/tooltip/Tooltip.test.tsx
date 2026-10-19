import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Tooltip } from './Tooltip'

const renderTooltip = () =>
  render(
    <Tooltip content="Команда Orbit">
      <a href="/s/1" aria-label="Команда Orbit">
        КО
      </a>
    </Tooltip>,
  )

it('shows the hint when the control gets keyboard focus and hides it on Esc', async () => {
  renderTooltip()

  await userEvent.tab()

  expect(await screen.findByRole('tooltip')).toHaveTextContent('Команда Orbit')
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

it('shows the hint on hover', async () => {
  renderTooltip()

  await userEvent.hover(screen.getByRole('link', { name: 'Команда Orbit' }))

  expect(await screen.findByRole('tooltip')).toHaveTextContent('Команда Orbit')
})
