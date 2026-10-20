/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** Largest attachment in bytes; keep equal to the server's ORBIT_MAX_UPLOAD_BYTES. */
  readonly VITE_MAX_UPLOAD_BYTES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** libolm's emscripten build reads its init options from this global. */
declare var OLM_OPTIONS: { locateFile?: (file: string) => string } | undefined
