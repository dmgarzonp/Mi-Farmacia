import { Injectable } from '@angular/core';

/**
 * Interfaz para el API de Electron expuesto vía preload
 */
declare global {
    interface Window {
        electronAPI: {
            dbQuery: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
            dbRun: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
            dbGet: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
        };
    }
}

/**
 * Servicio de base de datos SQLite
 * Proporciona acceso a la base de datos a través del IPC de Electron
 */
@Injectable({
    providedIn: 'root'
})
export class DatabaseService {

    /**
     * Ejecuta una consulta SELECT que retorna múltiples filas
     */
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        try {
            const result = await window.electronAPI.dbQuery(sql, params);
            if (result.success) {
                return result.data || [];
            } else {
                console.error('Database query error:', result.error);
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Database query exception:', error);
            throw error;
        }
    }

    /**
     * Ejecuta un comando SQL (INSERT, UPDATE, DELETE)
     * Retorna información sobre la operación (lastInsertRowid, changes)
     */
    async run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
        try {
            const result = await window.electronAPI.dbRun(sql, params);
            if (result.success) {
                return result.data;
            } else {
                console.error('Database run error:', result.error);
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Database run exception:', error);
            throw error;
        }
    }

    /**
     * Ejecuta una consulta que retorna una sola fila
     */
    async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
        try {
            const result = await window.electronAPI.dbGet(sql, params);
            if (result.success) {
                return result.data;
            } else {
                console.error('Database get error:', result.error);
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Database get exception:', error);
            throw error;
        }
    }

    /**
     * Helper para convertir snake_case a camelCase
     */
    toCamelCase(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item => this.toCamelCase(item));
        } else if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj).reduce((result, key) => {
                const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                result[camelKey] = this.toCamelCase(obj[key]);
                return result;
            }, {} as any);
        }
        return obj;
    }

    /**
     * Helper para convertir camelCase a snake_case
     */
    toSnakeCase(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item => this.toSnakeCase(item));
        } else if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj).reduce((result, key) => {
                const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                result[snakeKey] = this.toSnakeCase(obj[key]);
                return result;
            }, {} as any);
        }
        return obj;
    }
}
