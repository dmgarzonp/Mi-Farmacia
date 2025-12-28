import { Injectable, signal } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Producto, Lote, EstadoRegistro } from '../../../core/models';

/**
 * Servicio para gestión de productos (Catálogo Maestro)
 * Integrado con el esquema de Ecuador (Laboratorios y Lotes)
 */
@Injectable({
    providedIn: 'root'
})
export class ProductosService {
    productos = signal<Producto[]>([]);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    constructor(public db: DatabaseService) { }

    /**
     * Carga todos los productos activos con su stock total y relación con laboratorios
     */
    async cargarProductos(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const sql = `
                SELECT 
                    p.*,
                    c.nombre as categoria_nombre,
                    l.nombre as laboratorio_nombre,
                    (SELECT SUM(stock_actual) FROM lotes WHERE producto_id = p.id) as stock_total
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                WHERE p.estado = 'activo'
                ORDER BY p.nombre_comercial ASC
            `;

            const result = await this.db.query<any>(sql);
            const productos = this.db.toCamelCase(result) as Producto[];
            this.productos.set(productos);
        } catch (err: any) {
            this.error.set(err.message || 'Error al cargar productos');
            console.error('Error cargando productos:', err);
        } finally {
            this.loading.set(false);
        }
    }

    async obtenerPorId(id: number): Promise<Producto | null> {
        try {
            const sql = `
                SELECT 
                    p.*,
                    c.nombre as categoria_nombre,
                    l.nombre as laboratorio_nombre,
                    (SELECT SUM(stock_actual) FROM lotes WHERE producto_id = p.id) as stock_total
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                WHERE p.id = ? AND p.estado = 'activo'
            `;
            const producto = await this.db.get<any>(sql, [id]);
            if (!producto) return null;
            return this.db.toCamelCase(producto) as Producto;
        } catch (err: any) {
            console.error('Error obteniendo producto:', err);
            throw err;
        }
    }

    async obtenerLotes(productoId: number): Promise<Lote[]> {
        try {
            const sql = `
                SELECT * FROM lotes 
                WHERE producto_id = ? 
                ORDER BY fecha_vencimiento ASC
            `;
            const result = await this.db.query<any>(sql, [productoId]);
            return this.db.toCamelCase(result) as Lote[];
        } catch (err: any) {
            console.error('Error obteniendo lotes del producto:', err);
            throw err;
        }
    }

    async buscarPorCodigoBarras(codigoBarras: string): Promise<Producto | null> {
        try {
            const sql = `
                SELECT 
                    p.*,
                    c.nombre as categoria_nombre,
                    l.nombre as laboratorio_nombre,
                    (SELECT SUM(stock_actual) FROM lotes WHERE producto_id = p.id) as stock_total
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                WHERE p.codigo_barras = ? AND p.estado = 'activo'
            `;
            const producto = await this.db.get<any>(sql, [codigoBarras]);
            if (!producto) return null;
            return this.db.toCamelCase(producto) as Producto;
        } catch (err: any) {
            console.error('Error buscando producto por código de barras:', err);
            throw err;
        }
    }

    async buscar(termino: string): Promise<Producto[]> {
        try {
            const sql = `
                SELECT 
                    p.*,
                    c.nombre as categoria_nombre,
                    l.nombre as laboratorio_nombre,
                    (SELECT SUM(stock_actual) FROM lotes WHERE producto_id = p.id) as stock_total
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                WHERE p.estado = 'activo' 
                AND (p.nombre_comercial LIKE ? OR p.codigo_barras LIKE ? OR p.principio_activo LIKE ?)
                ORDER BY p.nombre_comercial ASC
            `;
            const searchTerm = `%${termino}%`;
            const result = await this.db.query<any>(sql, [searchTerm, searchTerm, searchTerm]);
            return this.db.toCamelCase(result) as Producto[];
        } catch (err: any) {
            console.error('Error buscando productos:', err);
            throw err;
        }
    }

    async crear(producto: Partial<Producto>): Promise<number> {
        try {
            const sql = `
                INSERT INTO productos (
                    codigo_barras, codigo_interno, nombre_comercial, principio_activo,
                    presentacion, laboratorio_id, categoria_id, precio_venta, stock_minimo,
                    requiere_receta, es_controlado, estado
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo')
            `;

            const result = await this.db.run(sql, [
                producto.codigoBarras || null,
                producto.codigoInterno || null,
                producto.nombreComercial,
                producto.principioActivo || null,
                producto.presentacion || null,
                producto.laboratorioId || null,
                producto.categoriaId,
                producto.precioVenta || 0,
                producto.stockMinimo || 0,
                producto.requiereReceta ? 1 : 0,
                producto.esControlado ? 1 : 0
            ]);

            await this.cargarProductos();
            return result.lastInsertRowid;
        } catch (err: any) {
            console.error('Error creando producto:', err);
            throw err;
        }
    }

    async actualizar(id: number, producto: Partial<Producto>): Promise<void> {
        try {
            const sql = `
                UPDATE productos 
                SET codigo_barras = ?, codigo_interno = ?, nombre_comercial = ?, 
                    principio_activo = ?, presentacion = ?, laboratorio_id = ?, 
                    categoria_id = ?, precio_venta = ?, stock_minimo = ?, 
                    requiere_receta = ?, es_controlado = ?
                WHERE id = ?
            `;

            await this.db.run(sql, [
                producto.codigoBarras || null,
                producto.codigoInterno || null,
                producto.nombreComercial,
                producto.principioActivo || null,
                producto.presentacion || null,
                producto.laboratorioId || null,
                producto.categoriaId,
                producto.precioVenta || 0,
                producto.stockMinimo || 0,
                producto.requiereReceta ? 1 : 0,
                producto.esControlado ? 1 : 0,
                id
            ]);

            await this.cargarProductos();
        } catch (err: any) {
            console.error('Error actualizando producto:', err);
            throw err;
        }
    }

    async eliminar(id: number): Promise<void> {
        try {
            const sql = `UPDATE productos SET estado = 'inactivo' WHERE id = ?`;
            await this.db.run(sql, [id]);
            await this.cargarProductos();
        } catch (err: any) {
            console.error('Error eliminando producto:', err);
            throw err;
        }
    }

    async obtenerEstadisticas(): Promise<{
        total: number;
        stockBajo: number;
        sinStock: number;
        vencimientosProximos: number;
    }> {
        try {
            const sqlTotal = `SELECT COUNT(*) as total FROM productos WHERE estado = 'activo'`;
            const total = (await this.db.get<any>(sqlTotal)).total;

            const sqlStockBajo = `
                SELECT COUNT(*) as count FROM (
                    SELECT p.id
                    FROM productos p
                    LEFT JOIN lotes l ON p.id = l.producto_id
                    WHERE p.estado = 'activo'
                    GROUP BY p.id
                    HAVING SUM(COALESCE(l.stock_actual, 0)) <= p.stock_minimo
                )
            `;
            const stockBajo = (await this.db.get<any>(sqlStockBajo)).count;

            const sqlSinStock = `
                SELECT COUNT(*) as count FROM (
                    SELECT p.id
                    FROM productos p
                    LEFT JOIN lotes l ON p.id = l.producto_id
                    WHERE p.estado = 'activo'
                    GROUP BY p.id
                    HAVING SUM(COALESCE(l.stock_actual, 0)) = 0
                )
            `;
            const sinStock = (await this.db.get<any>(sqlSinStock)).count;

            const sqlVencimientos = `
                SELECT COUNT(*) as count 
                FROM lotes 
                WHERE fecha_vencimiento <= date('now', '+30 days')
                AND stock_actual > 0
            `;
            const vencimientos = (await this.db.get<any>(sqlVencimientos)).count;

            return {
                total: total || 0,
                stockBajo: stockBajo || 0,
                sinStock: sinStock || 0,
                vencimientosProximos: vencimientos || 0
            };
        } catch (err: any) {
            console.error('Error obteniendo estadísticas:', err);
            return { total: 0, stockBajo: 0, sinStock: 0, vencimientosProximos: 0 };
        }
    }
}
