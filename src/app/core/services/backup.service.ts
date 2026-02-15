import { Injectable } from '@angular/core';

/**
 * Servicio para crear y restaurar respaldos de la base de datos.
 * Solo funciona en entorno Electron (no en navegador).
 */
@Injectable({
    providedIn: 'root'
})
export class BackupService {

    /** True si la API de respaldo está disponible (Electron). */
    get isAvailable(): boolean {
        return typeof window !== 'undefined' && !!(window as any).electronAPI?.backupCreate;
    }

    /**
     * Crea un respaldo de la base de datos. Abre el diálogo para elegir dónde guardar.
     * Hace checkpoint WAL y copia farmacia.db al archivo elegido.
     */
    async createBackup(): Promise<{ success: boolean; path?: string; error?: string }> {
        if (!this.isAvailable) {
            return { success: false, error: 'Respaldos solo disponibles en la aplicación de escritorio.' };
        }
        try {
            const result = await window.electronAPI.backupCreate();
            if (result.canceled) return { success: false, error: 'Cancelado' };
            if (!result.success) return { success: false, error: result.error || 'Error al crear respaldo' };
            return { success: true, path: result.path };
        } catch (e: any) {
            return { success: false, error: e?.message || 'Error al crear respaldo' };
        }
    }

    /**
     * Restaura la base de datos desde un archivo .db elegido por el usuario.
     * La aplicación se reiniciará automáticamente tras la restauración.
     */
    async restoreBackup(): Promise<{ success: boolean; error?: string }> {
        if (!this.isAvailable) {
            return { success: false, error: 'Restauración solo disponible en la aplicación de escritorio.' };
        }
        try {
            const result = await window.electronAPI.backupRestore();
            if (result.canceled) return { success: false, error: 'Cancelado' };
            if (!result.success) return { success: false, error: result.error || 'Error al restaurar' };
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e?.message || 'Error al restaurar' };
        }
    }

    /** Ruta donde está la base de datos (solo Electron). */
    async getDbPath(): Promise<string | null> {
        if (!this.isAvailable) return null;
        try {
            return await window.electronAPI.backupGetDbPath();
        } catch {
            return null;
        }
    }
}
