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
                    pr.nombre_comercial as producto_nombre
                FROM ordenes_compra_detalles doc
                LEFT JOIN productos pr ON doc.producto_id = pr.id
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
        try {
            const ordenSql = `
                INSERT INTO ordenes_compra (
                    proveedor_id, fecha_emision, estado, subtotal, 
                    descuento_monto, impuesto_total, total, moneda, observaciones
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const result = await this.db.run(ordenSql, [
                orden.proveedorId,
                orden.fechaEmision || new Date().toISOString().split('T')[0],
                orden.estado || EstadoOrdenCompra.PENDIENTE,
                orden.subtotal || 0,
                orden.descuentoMonto || 0,
                orden.impuestoTotal || 0,
                orden.total || 0,
                orden.moneda || 'PEN',
                orden.observaciones || null
            ]);

            const ordenId = result.lastInsertRowid;

            if (orden.detalles && orden.detalles.length > 0) {
                const detalleSql = `
                    INSERT INTO ordenes_compra_detalles 
                    (orden_compra_id, producto_id, cantidad, precio_unitario, subtotal, lote, fecha_vencimiento)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                for (const detalle of orden.detalles) {
                    await this.db.run(detalleSql, [
                        ordenId,
                        detalle.productoId,
                        detalle.cantidad,
                        detalle.precioUnitario,
                        detalle.subtotal,
                        detalle.lote,
                        detalle.fechaVencimiento
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
        try {
            const sql = `
                UPDATE ordenes_compra 
                SET proveedor_id = ?, fecha_emision = ?, estado = ?, subtotal = ?, 
                    descuento_monto = ?, impuesto_total = ?, total = ?, observaciones = ?
                WHERE id = ?
            `;

            await this.db.run(sql, [
                orden.proveedorId,
                orden.fechaEmision,
                orden.estado,
                orden.subtotal,
                orden.descuentoMonto,
                orden.impuestoTotal,
                orden.total,
                orden.observaciones || null,
                id
            ]);

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
            await this.cargarOrdenes();
        } catch (err: any) {
            console.error('Error cambiando estado:', err);
            throw err;
        }
    }

    /**
     * Proceso de Recepción de Mercancía:
     * 1. Crea/Actualiza lotes en inventario
     * 2. Registra movimientos de stock para auditoría
     * 3. Cambia estado de la orden
     */
    async marcarComoRecibida(id: number): Promise<void> {
        try {
            const orden = await this.obtenerPorId(id);
            if (!orden || !orden.detalles) throw new Error('Orden no encontrada');

            for (const det of orden.detalles) {
                // 1. Gestionar el lote (UPSERT manual en SQLite)
                const sqlCheckLote = `SELECT id, stock_actual FROM lotes WHERE producto_id = ? AND lote = ?`;
                const existingLote = await this.db.get<any>(sqlCheckLote, [det.productoId, det.lote]);

                let loteId: number;
                if (existingLote) {
                    loteId = existingLote.id;
                    const sqlUpdateLote = `UPDATE lotes SET stock_actual = stock_actual + ? WHERE id = ?`;
                    await this.db.run(sqlUpdateLote, [det.cantidad, loteId]);
                } else {
                    const sqlInsertLote = `
                        INSERT INTO lotes (producto_id, lote, fecha_vencimiento, stock_actual, fecha_ingreso)
                        VALUES (?, ?, ?, ?, CURRENT_DATE)
                    `;
                    const resLote = await this.db.run(sqlInsertLote, [
                        det.productoId, det.lote, det.fechaVencimiento, det.cantidad
                    ]);
                    loteId = resLote.lastInsertRowid;
                }

                // 2. Registrar Movimiento de Stock
                const sqlMov = `
                    INSERT INTO movimientos_stock (tipo, lote_id, cantidad, documento_referencia, observaciones)
                    VALUES (?, ?, ?, ?, ?)
                `;
                await this.db.run(sqlMov, [
                    TipoMovimiento.ENTRADA_COMPRA,
                    loteId,
                    det.cantidad,
                    `OC-${orden.id}`,
                    `Recepción de orden de compra #${orden.id}`
                ]);
            }

            await this.cambiarEstado(id, EstadoOrdenCompra.RECIBIDA);
        } catch (err: any) {
            console.error('Error en recepción:', err);
            throw err;
        }
    }
}
