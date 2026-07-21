/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_PUBLISHED_PAGES?: string
  readonly VITE_PAGE_ACCESS_CONTROL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
