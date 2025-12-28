import { Injectable, signal } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Proveedor, EstadoRegistro } from '../../../core/models';

/**
 * Servicio para gestión de proveedores
 * Adaptado al esquema detallado (Empresa + Contacto)
 */
@Injectable({
    providedIn: 'root'
})
export class ProveedoresService {
    proveedores = signal<Proveedor[]>([]);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    constructor(private db: DatabaseService) { }

    async cargarProveedores(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const sql = `
                SELECT * FROM proveedores 
                WHERE estado = 'activo' 
                ORDER BY nombre_empresa ASC
            `;

            const result = await this.db.query<any>(sql);
            const proveedores = this.db.toCamelCase(result) as Proveedor[];
            this.proveedores.set(proveedores);
        } catch (err: any) {
            this.error.set(err.message || 'Error al cargar proveedores');
            console.error('Error cargando proveedores:', err);
        } finally {
            this.loading.set(false);
        }
    }

    async obtenerPorId(id: number): Promise<Proveedor | null> {
        try {
            const sql = `SELECT * FROM proveedores WHERE id = ? AND estado = 'activo'`;
            const proveedor = await this.db.get<any>(sql, [id]);

            if (!proveedor) return null;
            return this.db.toCamelCase(proveedor) as Proveedor;
        } catch (err: any) {
            console.error('Error obteniendo proveedor:', err);
            throw err;
        }
    }

    async buscar(termino: string): Promise<Proveedor[]> {
        try {
            const sql = `
                SELECT * FROM proveedores 
                WHERE estado = 'activo' 
                AND (nombre_empresa LIKE ? OR ruc LIKE ? OR nombre_contacto LIKE ?)
                ORDER BY nombre_empresa ASC
            `;
            const searchTerm = `%${termino}%`;
            const result = await this.db.query<any>(sql, [searchTerm, searchTerm, searchTerm]);
            return this.db.toCamelCase(result) as Proveedor[];
        } catch (err: any) {
            console.error('Error buscando proveedores:', err);
            throw err;
        }
    }

    async crear(proveedor: Partial<Proveedor>): Promise<number> {
        try {
            const dbData = this.db.toSnakeCase(proveedor);
            const keys = Object.keys(dbData);
            const values = Object.values(dbData);
            const placeholders = keys.map(() => '?').join(', ');

            const sql = `
                INSERT INTO proveedores (${keys.join(', ')}, estado)
                VALUES (${placeholders}, 'activo')
            `;

            const result = await this.db.run(sql, values);
            await this.cargarProveedores();
            return result.lastInsertRowid;
        } catch (err: any) {
            console.error('Error creando proveedor:', err);
            throw err;
        }
    }

    async actualizar(id: number, proveedor: Partial<Proveedor>): Promise<void> {
        try {
            const dbData = this.db.toSnakeCase(proveedor);
            delete dbData.id; // No actualizar el ID
            
            const keys = Object.keys(dbData);
            const values = Object.values(dbData);
            const setClause = keys.map(key => `${key} = ?`).join(', ');

            const sql = `
                UPDATE proveedores 
                SET ${setClause}
                WHERE id = ?
            `;

            await this.db.run(sql, [...values, id]);
            await this.cargarProveedores();
        } catch (err: any) {
            console.error('Error actualizando proveedor:', err);
            throw err;
        }
    }

    async eliminar(id: number): Promise<void> {
        try {
            const sql = `UPDATE proveedores SET estado = 'inactivo' WHERE id = ?`;
            await this.db.run(sql, [id]);
            await this.cargarProveedores();
        } catch (err: any) {
            console.error('Error eliminando proveedor:', err);
            throw err;
        }
    }
}
