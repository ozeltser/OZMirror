/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL: string;
  readonly VITE_API_KEY: string;
  readonly VITE_CONFIG_API_URL: string;
  readonly VITE_MODULES_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
