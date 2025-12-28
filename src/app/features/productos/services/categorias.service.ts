import { Injectable, signal } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Categoria } from '../../../core/models';

/**
 * Servicio para gestión de categorías
 * Adaptado al esquema simplificado de la base de datos
 */
@Injectable({
    providedIn: 'root'
})
export class CategoriasService {
    categorias = signal<Categoria[]>([]);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    constructor(private db: DatabaseService) { }

    async cargarCategorias(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const sql = `SELECT * FROM categorias ORDER BY nombre ASC`;
            const result = await this.db.query<any>(sql);
            const categorias = this.db.toCamelCase(result) as Categoria[];
            this.categorias.set(categorias);
        } catch (err: any) {
            this.error.set(err.message || 'Error al cargar categorías');
            console.error('Error cargando categorías:', err);
        } finally {
            this.loading.set(false);
        }
    }

    async obtenerPorId(id: number): Promise<Categoria | null> {
        try {
            const sql = `SELECT * FROM categorias WHERE id = ?`;
            const categoria = await this.db.get<any>(sql, [id]);
            if (!categoria) return null;
            return this.db.toCamelCase(categoria) as Categoria;
        } catch (err: any) {
            console.error('Error obteniendo categoría:', err);
            throw err;
        }
    }

    async crear(categoria: Partial<Categoria>): Promise<number> {
        try {
            const sql = `INSERT INTO categorias (nombre) VALUES (?)`;
            const result = await this.db.run(sql, [categoria.nombre]);
            await this.cargarCategorias();
            return result.lastInsertRowid;
        } catch (err: any) {
            console.error('Error creando categoría:', err);
            throw err;
        }
    }

    async actualizar(id: number, categoria: Partial<Categoria>): Promise<void> {
        try {
            const sql = `UPDATE categorias SET nombre = ? WHERE id = ?`;
            await this.db.run(sql, [categoria.nombre, id]);
            await this.cargarCategorias();
        } catch (err: any) {
            console.error('Error actualizando categoría:', err);
            throw err;
        }
    }

    async eliminar(id: number): Promise<void> {
        try {
            // En el nuevo esquema no hay 'estado' para categorías, 
            // intentaremos un borrado físico controlado por FK
            const sql = `DELETE FROM categorias WHERE id = ?`;
            await this.db.run(sql, [id]);
            await this.cargarCategorias();
        } catch (err: any) {
            if (err.message?.includes('FOREIGN KEY constraint failed')) {
                throw new Error('No se puede eliminar la categoría porque tiene productos asociados');
            }
            console.error('Error eliminando categoría:', err);
            throw err;
        }
    }
}
