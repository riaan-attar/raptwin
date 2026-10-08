/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sent as X-API-Key on every request when dt/api.py's FABRIC_API_KEY gate
   * is enabled. See src/api/client.ts. */
  readonly VITE_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
