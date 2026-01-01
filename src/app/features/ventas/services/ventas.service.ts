import { Injectable, signal, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Venta, DetalleVenta, TipoMovimiento, EstadoVenta, Lote } from '../../../core/models';
import { SriService } from '../../../core/services/sri.service';

@Injectable({
    providedIn: 'root'
})
export class VentasService {
    private db = inject(DatabaseService);
    private sriService = inject(SriService);
    
    ventas = signal<Venta[]>([]);
    loading = signal<boolean>(false);

    /**
     * Obtiene el siguiente secuencial de venta para la facturación electrónica
     */
    async obtenerSiguienteSecuencial(): Promise<number> {
        const sql = `SELECT MAX(id) as max_id FROM ventas`;
        const result = await this.db.get<any>(sql);
        return (result?.max_id || 0) + 1;
    }

    /**
     * Obtiene los detalles de una venta específica para el XML
     */
    async obtenerDetallesVenta(ventaId: number): Promise<DetalleVenta[]> {
        const sql = `
            SELECT 
                d.*, 
                pres.nombre_descriptivo as presentacion_nombre,
                prod.tarifa_iva
            FROM ventas_detalles d
            JOIN presentaciones pres ON d.presentacion_id = pres.id
            JOIN productos prod ON pres.producto_id = prod.id
            WHERE d.venta_id = ?
        `;
        const result = await this.db.query<any>(sql, [ventaId]);
        return this.db.toCamelCase(result);
    }

    /**
     * Carga el historial de ventas completo con datos SRI
     */
    async cargarVentas(): Promise<void> {
        this.loading.set(true);
        try {
            const sql = `
                SELECT 
                    v.*, 
                    c.nombre_completo as cliente_nombre 
                FROM ventas v 
                LEFT JOIN clientes c ON v.cliente_id = c.id 
                ORDER BY v.fecha_venta DESC
            `;
            const result = await this.db.query<any>(sql);
            this.ventas.set(this.db.toCamelCase(result));
        } catch (e) {
            console.error('Error cargando historial de ventas:', e);
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Busca lotes disponibles para una presentación específica usando lógica FEFO
     */
    async obtenerLotesDisponibles(presentacionId: number): Promise<Lote[]> {
        const sql = `
            SELECT * FROM lotes 
            WHERE presentacion_id = ? AND stock_actual > 0 
            AND fecha_vencimiento >= date('now')
            ORDER BY fecha_vencimiento ASC
        `;
        const result = await this.db.query<any>(sql, [presentacionId]);
        return this.db.toCamelCase(result);
    }

    /**
     * Registra una venta completa
     * 1. Genera Clave de Acceso SRI
     * 2. Inserta en ventas
     * 3. Inserta detalles
     * 4. Descuenta stock de lotes
     * 5. Registra movimientos de stock
     */
    async registrarVenta(venta: Partial<Venta>): Promise<number> {
        try {
            // 1. Lógica Fiscal SRI: Generar Clave de Acceso
            const secuencial = await this.obtenerSiguienteSecuencial();
            const fechaActual = new Date();
            const claveAcceso = this.sriService.generarClaveAcceso(fechaActual, '01', secuencial);

            // 2. Cabecera con Clave de Acceso
            const sqlVenta = `
                INSERT INTO ventas (
                    cliente_id, subtotal, impuesto_total, total, 
                    metodo_pago, estado, clave_acceso, estado_sri
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const resVenta = await this.db.run(sqlVenta, [
                venta.clienteId || null,
                venta.subtotal,
                venta.impuestoTotal,
                venta.total,
                venta.metodoPago,
                EstadoVenta.COMPLETADA,
                claveAcceso,
                'pendiente'
            ]);
            const ventaId = resVenta.lastInsertRowid;

            // 3. Detalles y Stock
            if (venta.detalles) {
                for (const det of venta.detalles) {
                    const sqlDet = `
                        INSERT INTO ventas_detalles (venta_id, lote_id, presentacion_id, cantidad, precio_unitario, subtotal)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    await this.db.run(sqlDet, [
                        ventaId,
                        det.loteId,
                        det.presentacionId || null,
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
                        `Venta registrada #${ventaId} (Clave: ${claveAcceso.substring(0, 10)}...)`
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








