import { render } from '@testing-library/react'

import { Skeleton } from './Skeleton'

it('is a picture of the coming content, hidden from assistive technology', () => {
  const { container } = render(<Skeleton className="h-4 w-10" />)

  const skeleton = container.firstElementChild
  expect(skeleton).toHaveAttribute('aria-hidden', 'true')
  expect(skeleton).toHaveClass('h-4', 'w-10')
})
