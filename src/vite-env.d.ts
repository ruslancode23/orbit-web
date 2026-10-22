/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** Largest attachment in bytes; keep equal to the server's ORBIT_MAX_UPLOAD_BYTES. */
  readonly VITE_MAX_UPLOAD_BYTES?: string
  readonly VITE_FEEDBACK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The build, `<package version>+<commit>`; set by `define` in vite.config.ts. */
declare const __APP_VERSION__: string

/** libolm's emscripten build reads its init options from this global. */
declare var OLM_OPTIONS: { locateFile?: (file: string) => string } | undefined
