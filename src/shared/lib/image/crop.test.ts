import { coverLayout, visibleSquare } from './crop'

const landscape = { width: 400, height: 200 }

it('fits the shorter side to the frame and centres the image', () => {
  const layout = coverLayout(landscape, 100, 1, { x: 0, y: 0 })

  expect(layout).toMatchObject({ scale: 0.5, width: 200, height: 100, left: -50, top: 0 })
  expect(visibleSquare(layout, 100)).toEqual({ x: 100, y: 0, size: 200 })
})

it('keeps the frame covered however far the image is dragged', () => {
  const layout = coverLayout(landscape, 100, 1, { x: 500, y: -30 })

  // Only sideways is there room to move, and only up to the edge.
  expect(layout.offset).toEqual({ x: 50, y: 0 })
  expect(visibleSquare(layout, 100)).toEqual({ x: 0, y: 0, size: 200 })
})

it('shows a smaller square when zoomed in, and never zooms out past the fit', () => {
  const zoomed = coverLayout(landscape, 100, 2, { x: 0, y: 0 })
  expect(visibleSquare(zoomed, 100)).toEqual({ x: 150, y: 50, size: 100 })

  expect(coverLayout(landscape, 100, 0.5, { x: 0, y: 0 }).scale).toBe(0.5)
})
