import { Injectable, signal } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Laboratorio, EstadoRegistro } from '../../../core/models';

/**
 * Servicio para gestión de laboratorios (Fabricantes)
 * Adaptado al mercado de Ecuador
 */
@Injectable({
    providedIn: 'root'
})
export class LaboratoriosService {
    laboratorios = signal<Laboratorio[]>([]);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    constructor(private db: DatabaseService) { }

    async cargarLaboratorios(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const sql = `
                SELECT * FROM laboratorios 
                WHERE estado = 'activo' 
                ORDER BY nombre ASC
            `;

            const result = await this.db.query<any>(sql);
            const laboratorios = this.db.toCamelCase(result) as Laboratorio[];
            this.laboratorios.set(laboratorios);
        } catch (err: any) {
            this.error.set(err.message || 'Error al cargar laboratorios');
            console.error('Error cargando laboratorios:', err);
        } finally {
            this.loading.set(false);
        }
    }

    async crear(laboratorio: Partial<Laboratorio>): Promise<number> {
        try {
            const sql = `
                INSERT INTO laboratorios (nombre, pais, estado)
                VALUES (?, ?, 'activo')
            `;

            const result = await this.db.run(sql, [
                laboratorio.nombre,
                laboratorio.pais || 'Ecuador'
            ]);

            await this.cargarLaboratorios();
            return result.lastInsertRowid;
        } catch (err: any) {
            console.error('Error creando laboratorio:', err);
            throw err;
        }
    }

    async actualizar(id: number, laboratorio: Partial<Laboratorio>): Promise<void> {
        try {
            const sql = `
                UPDATE laboratorios 
                SET nombre = ?, pais = ?
                WHERE id = ?
            `;

            await this.db.run(sql, [
                laboratorio.nombre,
                laboratorio.pais || 'Ecuador',
                id
            ]);

            await this.cargarLaboratorios();
        } catch (err: any) {
            console.error('Error actualizando laboratorio:', err);
            throw err;
        }
    }

    async eliminar(id: number): Promise<void> {
        try {
            const sql = `UPDATE laboratorios SET estado = 'inactivo' WHERE id = ?`;
            await this.db.run(sql, [id]);
            await this.cargarLaboratorios();
        } catch (err: any) {
            console.error('Error eliminando laboratorio:', err);
            throw err;
        }
    }
}














