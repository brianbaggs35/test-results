/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: pre-fills the "Published By" metadata row on the Publish page. */
  readonly VITE_PUBLISHED_BY?: string;
  /** Deprecated name for VITE_PUBLISHED_BY; still honoured so an existing .env keeps working. */
  readonly VITE_EXECUTED_BY?: string;
}
