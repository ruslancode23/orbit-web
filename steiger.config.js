import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      // Early on most slices have a single consumer (join-room is used by pages/room only,
      // widgets/voice-room and server channels come next). Keep it visible, do not fail CI.
      'fsd/insignificant-slice': 'warn',
    },
  },
])
