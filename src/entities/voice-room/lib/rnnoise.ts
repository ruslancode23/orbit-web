import { loadRnnoise, RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor'
import wasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'
import simdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'
import workletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'

import type { AudioProcessorOptions, LocalAudioTrack, Track, TrackProcessor } from 'livekit-client'

/**
 * RNNoise in an AudioWorklet as a LiveKit track processor: the microphone goes
 * through the network and the cleaned copy is what gets published. This module
 * is imported only when someone turns enhanced noise suppression on, so the
 * WASM (~150 KB) never reaches people who do not use it.
 */
export const RNNOISE_PROCESSOR = 'orbit-rnnoise'

// RNNoise is trained on 48 kHz frames; a context at another rate would feed it the wrong audio.
const SAMPLE_RATE = 48_000

let context: AudioContext | null = null
let wasm: Promise<ArrayBuffer> | null = null
const ready = new WeakSet<BaseAudioContext>()

const audioContext = (): AudioContext => {
  context ??= new AudioContext({ sampleRate: SAMPLE_RATE })
  return context
}

const prepare = async (target: AudioContext): Promise<ArrayBuffer> => {
  // The SIMD build is picked when the browser has it.
  wasm ??= loadRnnoise({ url: wasmUrl, simdUrl: simdWasmUrl })
  const binary = await wasm
  if (!ready.has(target)) {
    await target.audioWorklet.addModule(workletUrl)
    ready.add(target)
  }
  return binary
}

const createProcessor = (): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> => {
  let source: MediaStreamAudioSourceNode | null = null
  let node: RnnoiseWorkletNode | null = null
  let destination: MediaStreamAudioDestinationNode | null = null

  const teardown = () => {
    source?.disconnect()
    node?.disconnect()
    node?.destroy()
    source = null
    node = null
    destination = null
  }

  /** Wires track → RNNoise → a fresh output track, replacing the previous wiring. */
  const build = async ({
    track,
    audioContext: target,
  }: AudioProcessorOptions): Promise<MediaStreamTrack | undefined> => {
    const binary = await prepare(target)
    if (target.state === 'suspended') {
      await target.resume()
    }
    teardown()
    source = target.createMediaStreamSource(new MediaStream([track]))
    node = new RnnoiseWorkletNode(target, { wasmBinary: binary, maxChannels: 1 })
    destination = target.createMediaStreamDestination()
    source.connect(node).connect(destination)
    return destination.stream.getAudioTracks()[0]
  }

  const processor: TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> = {
    name: RNNOISE_PROCESSOR,
    init: async (options) => {
      processor.processedTrack = await build(options)
    },
    // LiveKit calls restart with the new MediaStreamTrack after a device switch or restartTrack.
    restart: async (options) => {
      processor.processedTrack = await build(options)
    },
    destroy: () => {
      teardown()
      processor.processedTrack = undefined
      return Promise.resolve()
    },
  }

  return processor
}

/** Puts RNNoise on the published microphone; a track that already has it is left alone. */
export const attachRnnoise = async (track: LocalAudioTrack): Promise<void> => {
  if (track.getProcessor()?.name === RNNOISE_PROCESSOR) {
    return
  }
  if (typeof AudioWorkletNode === 'undefined') {
    throw new Error('AudioWorklet is not available')
  }
  track.setAudioContext(audioContext())
  await track.setProcessor(createProcessor())
}

/** Takes it off again: the raw microphone is published from then on. */
export const detachRnnoise = async (track: LocalAudioTrack): Promise<void> => {
  if (track.getProcessor()) {
    await track.stopProcessor()
  }
}
