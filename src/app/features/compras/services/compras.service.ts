import { Injectable, signal } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { OrdenCompra, DetalleOrdenCompra, EstadoOrdenCompra, TipoMovimiento } from '../../../core/models';

/**
 * Servicio para gestión de órdenes de compra
 * Adaptado al nuevo esquema de trazabilidad y lotes
 */
@Injectable({
    providedIn: 'root'
})
export class ComprasService {
    ordenes = signal<OrdenCompra[]>([]);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    constructor(private db: DatabaseService) { }

    async cargarOrdenes(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const sql = `
                SELECT 
                    oc.*,
                    p.nombre_empresa as proveedor_nombre
                FROM ordenes_compra oc
                LEFT JOIN proveedores p ON oc.proveedor_id = p.id
                ORDER BY oc.fecha_emision DESC
            `;

            const result = await this.db.query<any>(sql);
            const ordenes = this.db.toCamelCase(result) as OrdenCompra[];
            this.ordenes.set(ordenes);
        } catch (err: any) {
            this.error.set(err.message || 'Error al cargar órdenes');
            console.error('Error cargando órdenes:', err);
        } finally {
            this.loading.set(false);
        }
    }

    async obtenerPorId(id: number): Promise<OrdenCompra | null> {
        try {
            const sql = `
                SELECT 
                    oc.*,
                    p.nombre_empresa as proveedor_nombre
                FROM ordenes_compra oc
                LEFT JOIN proveedores p ON oc.proveedor_id = p.id
                WHERE oc.id = ?
            `;

            const orden = await this.db.get<any>(sql, [id]);
            if (!orden) return null;

            const detallesSql = `
                SELECT 
                    doc.*,
                    pres.nombre_descriptivo as presentacion_nombre,
                    pr.nombre_comercial as producto_nombre
                FROM ordenes_compra_detalles doc
                LEFT JOIN presentaciones pres ON doc.presentacion_id = pres.id
                LEFT JOIN productos pr ON pres.producto_id = pr.id
                WHERE doc.orden_compra_id = ?
            `;

            const detalles = await this.db.query<any>(detallesSql, [id]);
            const ordenCompleta = this.db.toCamelCase(orden) as OrdenCompra;
            ordenCompleta.detalles = this.db.toCamelCase(detalles) as DetalleOrdenCompra[];

            return ordenCompleta;
        } catch (err: any) {
            console.error('Error obteniendo orden:', err);
            throw err;
        }
    }

    async crear(orden: Partial<OrdenCompra>): Promise<number> {
        if (!orden.proveedorId || isNaN(Number(orden.proveedorId))) {
            throw new Error('Debe seleccionar un proveedor válido para crear la orden');
        }

        try {
            const ordenSql = `
                INSERT INTO ordenes_compra (
                    proveedor_id, fecha_emision, estado, subtotal, 
                    descuento_monto, impuesto_total, total, moneda, observaciones
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const result = await this.db.run(ordenSql, [
                Number(orden.proveedorId),
                orden.fechaEmision || new Date().toISOString().split('T')[0],
                orden.estado || EstadoOrdenCompra.PENDIENTE,
                Number(orden.subtotal) || 0,
                Number(orden.descuentoMonto) || 0,
                Number(orden.impuestoTotal) || 0,
                Number(orden.total) || 0,
                orden.moneda || 'USD',
                orden.observaciones || null
            ]);

            const ordenId = result.lastInsertRowid;

            if (orden.detalles && orden.detalles.length > 0) {
                const detalleSql = `
                    INSERT INTO ordenes_compra_detalles 
                    (orden_compra_id, presentacion_id, cantidad, precio_unitario, subtotal, lote, fecha_vencimiento)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                for (const detalle of orden.detalles) {
                    if (!detalle.presentacionId) continue;
                    
                    await this.db.run(detalleSql, [
                        ordenId,
                        Number(detalle.presentacionId),
                        Number(detalle.cantidad),
                        Number(detalle.precioUnitario),
                        Number(detalle.subtotal),
                        detalle.lote || null,
                        detalle.fechaVencimiento || null
                    ]);
                }
            }

            await this.cargarOrdenes();
            return ordenId;
        } catch (err: any) {
            console.error('Error creando orden:', err);
            throw err;
        }
    }

    async actualizar(id: number, orden: Partial<OrdenCompra>): Promise<void> {
        if (!orden.proveedorId || isNaN(Number(orden.proveedorId))) {
            throw new Error('Debe seleccionar un proveedor válido para actualizar la orden');
        }

        try {
            const sql = `
                UPDATE ordenes_compra 
                SET proveedor_id = ?, fecha_emision = ?, estado = ?, subtotal = ?, 
                    descuento_monto = ?, impuesto_total = ?, total = ?, observaciones = ?
                WHERE id = ?
            `;

            await this.db.run(sql, [
                Number(orden.proveedorId),
                orden.fechaEmision,
                orden.estado,
                Number(orden.subtotal) || 0,
                Number(orden.descuentoMonto) || 0,
                Number(orden.impuestoTotal) || 0,
                Number(orden.total) || 0,
                orden.observaciones || null,
                id
            ]);

            // Actualizar detalles (Estrategia simple: Borrar y volver a insertar para ediciones)
            if (orden.detalles) {
                await this.db.run(`DELETE FROM ordenes_compra_detalles WHERE orden_compra_id = ?`, [id]);
                
                const detalleSql = `
                    INSERT INTO ordenes_compra_detalles 
                    (orden_compra_id, presentacion_id, cantidad, precio_unitario, subtotal, lote, fecha_vencimiento)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                for (const detalle of orden.detalles) {
                    if (!detalle.presentacionId) continue;

                    await this.db.run(detalleSql, [
                        id,
                        Number(detalle.presentacionId),
                        Number(detalle.cantidad),
                        Number(detalle.precioUnitario),
                        Number(detalle.subtotal),
                        detalle.lote || null,
                        detalle.fechaVencimiento || null
                    ]);
                }
            }

            await this.cargarOrdenes();
        } catch (err: any) {
            console.error('Error actualizando orden:', err);
            throw err;
        }
    }

    async eliminar(id: number): Promise<void> {
        try {
            const sql = `DELETE FROM ordenes_compra WHERE id = ?`;
            await this.db.run(sql, [id]);
            await this.cargarOrdenes();
        } catch (err: any) {
            console.error('Error eliminando orden:', err);
            throw err;
        }
    }

    async cambiarEstado(id: number, estado: EstadoOrdenCompra, motivo?: string): Promise<void> {
        try {
            const sql = `UPDATE ordenes_compra SET estado = ?, observaciones = ? WHERE id = ?`;
            await this.db.run(sql, [estado, motivo || null, id]);
            await this.db.run(sql, [estado, motivo || null, id]);
            await this.cargarOrdenes();
        } catch (err: any) {
            console.error('Error cambiando estado:', err);
            throw err;
        }
    }

    /**
     * Busca el proveedor que ha ofrecido el mejor precio histórico para una presentación
     */
    async obtenerMejorProveedorHistorico(presentacionId: number): Promise<{proveedorId: number, precio: number} | null> {
        try {
            const sql = `
                SELECT 
                    oc.proveedor_id,
                    doc.precio_unitario as precio
                FROM ordenes_compra_detalles doc
                JOIN ordenes_compra oc ON doc.orden_compra_id = oc.id
                WHERE doc.presentacion_id = ?
                AND oc.estado = 'recibida'
                ORDER BY doc.precio_unitario ASC
                LIMIT 1
            `;
            const result = await this.db.get<any>(sql, [presentacionId]);
            return result ? { proveedorId: result.proveedor_id, precio: result.precio } : null;
        } catch (err) {
            console.error('Error obteniendo mejor proveedor:', err);
            return null;
        }
    }

    /**
     * Proceso de Recepción de Mercancía:
     * 1. Actualiza los detalles de la orden con cantidades, precios, lotes/vencimientos reales
     * 2. Actualiza el total de la orden si hubo cambios
     * 3. Crea/Actualiza lotes en inventario (Basado en presentaciones)
     * 4. Registra movimientos de stock para auditoría
     * 5. Cambia estado de la orden
     */
    async marcarComoRecibida(id: number, detallesActualizados: DetalleOrdenCompra[], nuevoTotal?: number): Promise<void> {
        try {
            const orden = await this.obtenerPorId(id);
            if (!orden || !orden.detalles) throw new Error('Orden no encontrada');

            // 1. Actualizar detalles de la orden con datos reales de recepción
            const updateDetSql = `
                UPDATE ordenes_compra_detalles 
                SET cantidad = ?, precio_unitario = ?, subtotal = ?, lote = ?, fecha_vencimiento = ? 
                WHERE orden_compra_id = ? AND presentacion_id = ?
            `;
            
            for (const det of detallesActualizados) {
                const subtotal = det.cantidad * det.precioUnitario;
                await this.db.run(updateDetSql, [
                    det.cantidad, 
                    det.precioUnitario, 
                    subtotal, 
                    det.lote, 
                    det.fechaVencimiento, 
                    id, 
                    det.presentacionId
                ]);
            }

            // 2. Actualizar total de la orden si cambió
            if (nuevoTotal !== undefined) {
                const updateOrdenSql = `UPDATE ordenes_compra SET subtotal = ?, total = ? WHERE id = ?`;
                await this.db.run(updateOrdenSql, [nuevoTotal, nuevoTotal, id]);
            }

            // 3. Procesar inventario para cada presentación
            for (const det of detallesActualizados) {
                if (!det.lote || !det.fechaVencimiento) {
                    throw new Error(`Faltan datos de lote/vencimiento para la presentación con ID ${det.presentacionId}`);
                }

                // Obtener unidades por caja de la presentación
                const presSql = `SELECT unidades_por_caja FROM presentaciones WHERE id = ?`;
                const pres = await this.db.get<any>(presSql, [det.presentacionId]);
                const unidadesPorCaja = pres?.unidades_por_caja || 1;
                
                // Cantidad total en UNIDADES BASE
                const cantidadTotalUnidades = det.cantidad * unidadesPorCaja;
                const precioCompraUnitario = det.precioUnitario / unidadesPorCaja;

                // Gestionar el lote (UPSERT manual en SQLite)
                const sqlCheckLote = `SELECT id, stock_actual FROM lotes WHERE presentacion_id = ? AND lote = ?`;
                const existingLote = await this.db.get<any>(sqlCheckLote, [det.presentacionId, det.lote]);

                let loteId: number;
                if (existingLote) {
                    loteId = existingLote.id;
                    const sqlUpdateLote = `UPDATE lotes SET stock_actual = stock_actual + ? WHERE id = ?`;
                    await this.db.run(sqlUpdateLote, [cantidadTotalUnidades, loteId]);
                } else {
                    const sqlInsertLote = `
                        INSERT INTO lotes (
                            presentacion_id, lote, fecha_vencimiento, stock_actual, 
                            precio_compra_caja, precio_compra_unitario, fecha_ingreso
                        )
                        VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE)
                    `;
                    const resLote = await this.db.run(sqlInsertLote, [
                        det.presentacionId, det.lote, det.fechaVencimiento, cantidadTotalUnidades,
                        det.precioUnitario, precioCompraUnitario
                    ]);
                    loteId = resLote.lastInsertRowid;
                }

                // Registrar Movimiento de Stock
                const sqlMov = `
                    INSERT INTO movimientos_stock (tipo, lote_id, cantidad, documento_referencia, observaciones)
                    VALUES (?, ?, ?, ?, ?)
                `;
                await this.db.run(sqlMov, [
                    TipoMovimiento.ENTRADA_COMPRA,
                    loteId,
                    cantidadTotalUnidades,
                    `OC-${id}`,
                    `Recepción de OC #${id} (${det.cantidad} CAJAS x ${unidadesPorCaja} unid.)`
                ]);
            }

            await this.cambiarEstado(id, EstadoOrdenCompra.RECIBIDA);
        } catch (err: any) {
            console.error('Error en recepción:', err);
            throw err;
        }
    }
}
