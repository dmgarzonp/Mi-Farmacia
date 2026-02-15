/**
 * Tipos para el API de Electron expuesto vía preload (solo en app de escritorio).
 * Declaración única para evitar TS2687 por declaraciones duplicadas de electronAPI.
 */
declare global {
  interface Window {
    electronAPI: {
      dbQuery: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
      dbRun: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
      dbGet: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
      getLocale: () => Promise<string>;
      getLogPath: () => Promise<string>;
      login: (credentials: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      hashPassword: (password: string) => Promise<string>;
      backupCreate: () => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean }>;
      backupRestore: () => Promise<{ success: boolean; error?: string; canceled?: boolean }>;
      backupGetDbPath: () => Promise<string>;
      windowMinimize: () => void;
      windowMaximize: () => void;
      windowClose: () => void;
    };
  }
}

export {};
