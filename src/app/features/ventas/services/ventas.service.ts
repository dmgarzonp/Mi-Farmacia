import { Injectable, signal, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Venta, DetalleVenta, TipoMovimiento, EstadoVenta, Lote } from '../../../core/models';

@Injectable({
    providedIn: 'root'
})
export class VentasService {
    private db = inject(DatabaseService);
    
    ventas = signal<Venta[]>([]);
    loading = signal<boolean>(false);

    /**
     * Carga el historial de ventas
     */
    async cargarVentas(): Promise<void> {
        this.loading.set(true);
        try {
            const sql = `
                SELECT v.*, c.nombre_completo as cliente_nombre 
                FROM ventas v 
                LEFT JOIN clientes c ON v.cliente_id = c.id 
                ORDER BY v.fecha_venta DESC
            `;
            const result = await this.db.query<any>(sql);
            this.ventas.set(this.db.toCamelCase(result));
        } catch (e) {
            console.error(e);
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Busca lotes disponibles para un producto usando lógica FEFO
     */
    async obtenerLotesDisponibles(productoId: number): Promise<Lote[]> {
        const sql = `
            SELECT * FROM lotes 
            WHERE producto_id = ? AND stock_actual > 0 
            AND fecha_vencimiento >= date('now')
            ORDER BY fecha_vencimiento ASC
        `;
        const result = await this.db.query<any>(sql, [productoId]);
        return this.db.toCamelCase(result);
    }

    /**
     * Registra una venta completa
     * 1. Inserta en ventas
     * 2. Inserta detalles
     * 3. Descuenta stock de lotes
     * 4. Registra movimientos de stock
     */
    async registrarVenta(venta: Partial<Venta>): Promise<number> {
        try {
            // 1. Cabecera
            const sqlVenta = `
                INSERT INTO ventas (cliente_id, subtotal, impuesto_total, total, metodo_pago, estado)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const resVenta = await this.db.run(sqlVenta, [
                venta.clienteId || null,
                venta.subtotal,
                venta.impuestoTotal,
                venta.total,
                venta.metodoPago,
                EstadoVenta.COMPLETADA
            ]);
            const ventaId = resVenta.lastInsertRowid;

            // 2. Detalles y Stock
            if (venta.detalles) {
                for (const det of venta.detalles) {
                    const sqlDet = `
                        INSERT INTO ventas_detalles (venta_id, lote_id, cantidad, precio_unitario, subtotal)
                        VALUES (?, ?, ?, ?, ?)
                    `;
                    await this.db.run(sqlDet, [
                        ventaId,
                        det.loteId,
                        det.cantidad,
                        det.precioUnitario,
                        det.subtotal
                    ]);

                    // Descontar del lote
                    const sqlUpdateLote = `UPDATE lotes SET stock_actual = stock_actual - ? WHERE id = ?`;
                    await this.db.run(sqlUpdateLote, [det.cantidad, det.loteId]);

                    // Registrar Movimiento
                    const sqlMov = `
                        INSERT INTO movimientos_stock (tipo, lote_id, cantidad, documento_referencia, observaciones)
                        VALUES (?, ?, ?, ?, ?)
                    `;
                    await this.db.run(sqlMov, [
                        TipoMovimiento.SALIDA_VENTA,
                        det.loteId,
                        -det.cantidad,
                        `V-${ventaId}`,
                        `Venta registrada #${ventaId}`
                    ]);
                }
            }

            return ventaId;
        } catch (e) {
            console.error('Error registrando venta:', e);
            throw e;
        }
    }
}


