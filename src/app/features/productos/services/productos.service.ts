import { Injectable, signal } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Producto, Lote, EstadoRegistro, Presentacion } from '../../../core/models';

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
     * Carga todos los productos activos con su relación con laboratorios
     */
    async cargarProductos(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const sql = `
                SELECT 
                    p.*,
                    c.nombre as categoria_nombre,
                    l.nombre as laboratorio_nombre
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                WHERE p.estado = 'activo'
                ORDER BY p.nombre_comercial ASC
            `;

            const result = await this.db.query<any>(sql);
            const productos = this.db.toCamelCase(result) as Producto[];
            
            // Cargar presentaciones para cada producto
            for (const prod of productos) {
                const presSql = `
                    SELECT 
                        id, producto_id, nombre_descriptivo, unidad_base, unidades_por_caja,
                        precio_compra_caja, precio_venta_unidad, precio_venta_caja, 
                        stock_minimo, codigo_barras, vencimiento_predeterminado_meses,
                        (SELECT SUM(stock_actual) FROM lotes WHERE presentacion_id = presentaciones.id) as stock_total,
                        (SELECT MIN(fecha_vencimiento) FROM lotes WHERE presentacion_id = presentaciones.id AND stock_actual > 0) as proximo_vencimiento
                    FROM presentaciones 
                    WHERE producto_id = ?
                `;
                const presResult = await this.db.query<any>(presSql, [prod.id]);
                prod.presentaciones = this.db.toCamelCase(presResult) as Presentacion[];
                
                // Debug para asegurar que los precios existan
                prod.presentaciones.forEach(pres => {
                    if (!pres.precioVentaCaja) {
                        // Intento de rescate si toCamelCase falló o el campo vino diferente
                        const raw: any = presResult.find((r: any) => r.id === pres.id);
                        pres.precioVentaCaja = raw?.precio_venta_caja || 0;
                        pres.precioVentaUnidad = raw?.precio_venta_unidad || 0;
                    }
                });
            }

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
                    l.nombre as laboratorio_nombre
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                WHERE p.id = ? AND p.estado = 'activo'
            `;
            const producto = await this.db.get<any>(sql, [id]);
            if (!producto) return null;
            
            const prodObj = this.db.toCamelCase(producto) as Producto;
            
            // Cargar presentaciones
            const presSql = `
                SELECT 
                    id, producto_id, nombre_descriptivo, unidad_base, unidades_por_caja,
                    precio_compra_caja, precio_venta_unidad, precio_venta_caja, 
                    stock_minimo, codigo_barras, vencimiento_predeterminado_meses,
                    (SELECT SUM(stock_actual) FROM lotes WHERE presentacion_id = presentaciones.id) as stock_total,
                    (SELECT MIN(fecha_vencimiento) FROM lotes WHERE presentacion_id = presentaciones.id AND stock_actual > 0) as proximo_vencimiento
                FROM presentaciones 
                WHERE producto_id = ?
            `;
            const presResult = await this.db.query<any>(presSql, [id]);
            prodObj.presentaciones = this.db.toCamelCase(presResult) as Presentacion[];

            // Asegurar precios numéricos
            prodObj.presentaciones.forEach(pres => {
                const raw: any = presResult.find((r: any) => r.id === pres.id);
                pres.precioVentaCaja = Number(raw?.precio_venta_caja || pres.precioVentaCaja || 0);
                pres.precioVentaUnidad = Number(raw?.precio_venta_unidad || pres.precioVentaUnidad || 0);
            });

            return prodObj;
        } catch (err: any) {
            console.error('Error obteniendo producto:', err);
            throw err;
        }
    }

    async obtenerLotes(presentacionId: number): Promise<Lote[]> {
        try {
            const sql = `
                SELECT * FROM lotes 
                WHERE presentacion_id = ? 
                ORDER BY fecha_vencimiento ASC
            `;
            const result = await this.db.query<any>(sql, [presentacionId]);
            return this.db.toCamelCase(result) as Lote[];
        } catch (err: any) {
            console.error('Error obteniendo lotes de la presentación:', err);
            throw err;
        }
    }

    async obtenerMovimientosProducto(productoId: number): Promise<any[]> {
        try {
            const sql = `
                SELECT 
                    m.*,
                    l.lote as lote_numero,
                    pres.nombre_descriptivo as presentacion_nombre
                FROM movimientos_stock m
                JOIN lotes l ON m.lote_id = l.id
                JOIN presentaciones pres ON l.presentacion_id = pres.id
                WHERE pres.producto_id = ?
                ORDER BY m.fecha_movimiento DESC
            `;
            const result = await this.db.query<any>(sql, [productoId]);
            return this.db.toCamelCase(result);
        } catch (err: any) {
            console.error('Error obteniendo movimientos del producto:', err);
            throw err;
        }
    }

    async buscarPorCodigoBarras(codigoBarras: string): Promise<Producto | null> {
        try {
            // Primero buscar por código de barras en presentaciones
            const presSql = `SELECT producto_id FROM presentaciones WHERE codigo_barras = ?`;
            const pres = await this.db.get<any>(presSql, [codigoBarras]);
            
            if (pres) {
                return this.obtenerPorId(pres.producto_id);
            }
            return null;
        } catch (err: any) {
            console.error('Error buscando producto por código de barras:', err);
            throw err;
        }
    }

    async buscar(termino: string): Promise<Producto[]> {
        try {
            const sql = `
                SELECT DISTINCT
                    p.*,
                    c.nombre as categoria_nombre,
                    l.nombre as laboratorio_nombre
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                LEFT JOIN presentaciones pres ON p.id = pres.producto_id
                WHERE p.estado = 'activo' 
                AND (p.nombre_comercial LIKE ? OR p.principio_activo LIKE ? OR pres.codigo_barras LIKE ?)
                ORDER BY p.nombre_comercial ASC
            `;
            const searchTerm = `%${termino}%`;
            const result = await this.db.query<any>(sql, [searchTerm, searchTerm, searchTerm]);
            const productos = this.db.toCamelCase(result) as Producto[];

            for (const prod of productos) {
                const presSql = `
                    SELECT 
                        id, producto_id, nombre_descriptivo, unidad_base, unidades_por_caja,
                        precio_compra_caja, precio_venta_unidad, precio_venta_caja, 
                        stock_minimo, codigo_barras, vencimiento_predeterminado_meses,
                        (SELECT SUM(stock_actual) FROM lotes WHERE presentacion_id = presentaciones.id) as stock_total
                    FROM presentaciones 
                    WHERE producto_id = ?
                `;
                const presResult = await this.db.query<any>(presSql, [prod.id]);
                prod.presentaciones = this.db.toCamelCase(presResult) as Presentacion[];

                // Asegurar precios numéricos
                prod.presentaciones.forEach(pres => {
                    const raw: any = presResult.find((r: any) => r.id === pres.id);
                    pres.precioVentaCaja = Number(raw?.precio_venta_caja || pres.precioVentaCaja || 0);
                    pres.precioVentaUnidad = Number(raw?.precio_venta_unidad || pres.precioVentaUnidad || 0);
                });
            }

            return productos;
        } catch (err: any) {
            console.error('Error buscando productos:', err);
            throw err;
        }
    }

    async crear(producto: Partial<Producto>): Promise<number> {
        try {
            const sql = `
                INSERT INTO productos (
                    codigo_interno, nombre_comercial, principio_activo,
                    laboratorio_id, categoria_id, requiere_receta, es_controlado, tarifa_iva, estado
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activo')
            `;

            const result = await this.db.run(sql, [
                producto.codigoInterno || null,
                producto.nombreComercial,
                producto.principioActivo || null,
                producto.laboratorioId || null,
                producto.categoriaId,
                producto.requiereReceta ? 1 : 0,
                producto.esControlado ? 1 : 0,
                producto.tarifaIva || 0
            ]);

            const productoId = result.lastInsertRowid;

            // Crear presentaciones
            if (producto.presentaciones) {
                for (const pres of producto.presentaciones) {
                    await this.db.run(`
                        INSERT INTO presentaciones (
                            producto_id, nombre_descriptivo, unidad_base, unidades_por_caja,
                            precio_compra_caja, precio_venta_unidad, precio_venta_caja, 
                            stock_minimo, codigo_barras, vencimiento_predeterminado_meses
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        productoId,
                        pres.nombreDescriptivo,
                        pres.unidadBase,
                        pres.unidadesPorCaja,
                        pres.precioCompraCaja || 0,
                        pres.precioVentaUnidad,
                        pres.precioVentaCaja,
                        pres.stockMinimo,
                        pres.codigoBarras || null,
                        pres.vencimientoPredeterminadoMeses || 0
                    ]);
                }
            }

            await this.cargarProductos();
            return productoId;
        } catch (err: any) {
            console.error('Error creando producto:', err);
            throw err;
        }
    }

    async actualizar(id: number, producto: Partial<Producto>): Promise<void> {
        try {
            const sql = `
                UPDATE productos 
                SET codigo_interno = ?, nombre_comercial = ?, 
                    principio_activo = ?, laboratorio_id = ?, 
                    categoria_id = ?, requiere_receta = ?, 
                    es_controlado = ?, tarifa_iva = ?
                WHERE id = ?
            `;

            await this.db.run(sql, [
                producto.codigoInterno || null,
                producto.nombreComercial,
                producto.principioActivo || null,
                producto.laboratorioId || null,
                producto.categoriaId,
                producto.requiereReceta ? 1 : 0,
                producto.esControlado ? 1 : 0,
                producto.tarifaIva || 0,
                id
            ]);

            // Actualizar presentaciones (Estrategia simple: borrar y reinsertar)
            if (producto.presentaciones) {
                // Primero obtener IDs existentes para no romper lotes si es posible, 
                // pero por simplicidad de este rediseño, borraremos y reinsertaremos.
                // NOTA: En un sistema real esto debe ser un UPSERT para no perder la relación con lotes existentes.
                // Implementaremos un UPSERT manual básico.
                
                const existingPres = await this.db.query<any>(`SELECT id FROM presentaciones WHERE producto_id = ?`, [id]);
                const incomingIds = producto.presentaciones.filter(p => p.id).map(p => p.id);
                
                // Borrar las que ya no vienen
                for (const ex of existingPres) {
                    if (!incomingIds.includes(ex.id)) {
                        await this.db.run(`DELETE FROM presentaciones WHERE id = ?`, [ex.id]);
                    }
                }

                for (const pres of producto.presentaciones) {
                    if (pres.id) {
                        await this.db.run(`
                            UPDATE presentaciones SET
                                nombre_descriptivo = ?, unidad_base = ?, unidades_por_caja = ?,
                                precio_compra_caja = ?, precio_venta_unidad = ?, precio_venta_caja = ?, 
                                stock_minimo = ?, codigo_barras = ?, vencimiento_predeterminado_meses = ?
                            WHERE id = ?
                        `, [
                            pres.nombreDescriptivo, pres.unidadBase, pres.unidadesPorCaja,
                            pres.precioCompraCaja || 0, pres.precioVentaUnidad, pres.precioVentaCaja, 
                            pres.stockMinimo, pres.codigoBarras || null, 
                            pres.vencimientoPredeterminadoMeses || 0, pres.id
                        ]);
                    } else {
                        await this.db.run(`
                            INSERT INTO presentaciones (
                                producto_id, nombre_descriptivo, unidad_base, unidades_por_caja,
                                precio_compra_caja, precio_venta_unidad, precio_venta_caja, 
                                stock_minimo, codigo_barras, vencimiento_predeterminado_meses
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            id, pres.nombreDescriptivo, pres.unidadBase, pres.unidadesPorCaja,
                            pres.precioCompraCaja || 0, pres.precioVentaUnidad, pres.precioVentaCaja, 
                            pres.stockMinimo, pres.codigoBarras || null, pres.vencimientoPredeterminadoMeses || 0
                        ]);
                    }
                }
            }

            await this.cargarProductos();
        } catch (err: any) {
            console.error('Error actualizando producto:', err);
            throw err;
        }
    }

    async eliminar(id: number): Promise<void> {
        try {
            await this.cambiarEstado(id, EstadoRegistro.INACTIVO);
        } catch (err: any) {
            console.error('Error eliminando producto:', err);
            throw err;
        }
    }

    async cambiarEstado(id: number, estado: EstadoRegistro): Promise<void> {
        try {
            const sql = `UPDATE productos SET estado = ? WHERE id = ?`;
            await this.db.run(sql, [estado, id]);
            await this.cargarProductos();
        } catch (err: any) {
            console.error('Error cambiando estado del producto:', err);
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
                    SELECT pres.id
                    FROM presentaciones pres
                    LEFT JOIN lotes l ON pres.id = l.presentacion_id
                    GROUP BY pres.id
                    HAVING SUM(COALESCE(l.stock_actual, 0)) <= pres.stock_minimo
                    AND SUM(COALESCE(l.stock_actual, 0)) > 0
                )
            `;
            const stockBajo = (await this.db.get<any>(sqlStockBajo)).count;

            const sqlSinStock = `
                SELECT COUNT(*) as count FROM (
                    SELECT pres.id
                    FROM presentaciones pres
                    LEFT JOIN lotes l ON pres.id = l.presentacion_id
                    GROUP BY pres.id
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

    /**
     * Calcula la fecha de vencimiento sugerida basada en los meses predeterminados
     */
    sugerirFechaVencimiento(meses: number): string {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() + (meses || 24)); // 24 meses por defecto si es 0
        return fecha.toISOString().split('T')[0];
    }
}
