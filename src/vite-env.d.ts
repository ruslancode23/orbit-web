/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** Largest attachment in bytes; keep equal to the server's ORBIT_MAX_UPLOAD_BYTES. */
  readonly VITE_MAX_UPLOAD_BYTES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
