/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: pre-fills the "Executed By" metadata row on the Publish page. */
  readonly VITE_EXECUTED_BY?: string;
}
