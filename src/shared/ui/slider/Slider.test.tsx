import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Slider } from './Slider'

describe('Slider', () => {
  it('moves with the arrow keys and reads out its value', async () => {
    const onValueChange = vi.fn()
    render(
      <Slider
        aria-label="Громкость"
        value={[50]}
        max={100}
        step={5}
        getValueText={(v) => `${String(v)} %`}
        onValueChange={onValueChange}
      />,
    )
    const thumb = screen.getByRole('slider', { name: 'Громкость' })
    expect(thumb).toHaveAttribute('aria-valuenow', '50')
    expect(thumb).toHaveAttribute('aria-valuetext', '50 %')

    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')

    expect(onValueChange).toHaveBeenCalledWith([55])
  })
})
