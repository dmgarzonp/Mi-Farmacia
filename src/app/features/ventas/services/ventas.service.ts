import { Injectable, signal, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Venta, DetalleVenta, TipoMovimiento, EstadoVenta, Lote, Receta } from '../../../core/models';
import { SriService } from '../../../core/services/sri.service';
import { AuthService } from '../../../core/services/auth.service';
import { CajaService } from '../../../core/services/caja.service';

@Injectable({
    providedIn: 'root'
})
export class VentasService {
    private db = inject(DatabaseService);
    private sriService = inject(SriService);
    private authService = inject(AuthService);
    private cajaService = inject(CajaService);
    
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
     * Registra una venta completa y opcionalmente una receta médica
     */
    async registrarVenta(venta: Partial<Venta>, receta?: Partial<Receta>): Promise<number> {
        try {
            // 1. Lógica Fiscal SRI: Generar Clave de Acceso
            const secuencial = await this.obtenerSiguienteSecuencial();
            const fechaActual = new Date();
            const claveAcceso = this.sriService.generarClaveAcceso(fechaActual, '01', secuencial);

            // 2. Cabecera con Clave de Acceso y Usuario
            const usuarioId = this.authService.usuarioActual()?.id || null;
            const sesionCajaId = this.cajaService.sesionActiva()?.id || null;
            
            const sqlVenta = `
                INSERT INTO ventas (
                    cliente_id, subtotal, impuesto_total, total, 
                    metodo_pago, estado, clave_acceso, estado_sri, cajero_id, sesion_caja_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const resVenta = await this.db.run(sqlVenta, [
                venta.clienteId || null,
                venta.subtotal,
                venta.impuestoTotal,
                venta.total,
                venta.metodoPago,
                EstadoVenta.COMPLETADA,
                claveAcceso,
                'pendiente',
                usuarioId,
                sesionCajaId
            ]);
            const ventaId = resVenta.lastInsertRowid;

            // 3. Registrar Receta si existe (ARCSA / Controlados)
            if (receta) {
                const sqlReceta = `
                    INSERT INTO recetas (
                        venta_id, cliente_id, medico_nombre, medico_registro, 
                        receta_numero, fecha_emision, observaciones, estado
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                await this.db.run(sqlReceta, [
                    ventaId,
                    venta.clienteId || null,
                    receta.medicoNombre || null,
                    receta.medicoRegistro || null,
                    receta.recetaNumero || null,
                    receta.fechaEmision || new Date().toISOString().split('T')[0],
                    receta.observaciones || null,
                    'validada'
                ]);
            }

            // 4. Detalles y Stock
            if (venta.detalles) {
                for (const det of venta.detalles) {
                    const sqlDet = `
                        INSERT INTO ventas_detalles (venta_id, lote_id, presentacion_id, cantidad, precio_unitario, subtotal, es_fraccion)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;
                    await this.db.run(sqlDet, [
                        ventaId,
                        det.loteId,
                        det.presentacionId || null,
                        det.cantidad,
                        det.precioUnitario,
                        det.subtotal,
                        det.esFraccion ? 1 : 0
                    ]);

                    // Descontar del lote
                    const sqlUpdateLote = `UPDATE lotes SET stock_actual = stock_actual - ? WHERE id = ?`;
                    await this.db.run(sqlUpdateLote, [det.cantidad, det.loteId]);

                    // Registrar Movimiento con Usuario
                    const sqlMov = `
                        INSERT INTO movimientos_stock (tipo, lote_id, cantidad, documento_referencia, observaciones, usuario_id)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    await this.db.run(sqlMov, [
                        TipoMovimiento.SALIDA_VENTA,
                        det.loteId,
                        -det.cantidad,
                        `V-${ventaId}`,
                        `Venta registrada #${ventaId} (Clave: ${claveAcceso.substring(0, 10)}...)`,
                        usuarioId
                    ]);
                }
            }

            return ventaId;
        } catch (e) {
            console.error('Error registrando venta:', e);
            throw e;
        }
    }

    /**
     * Obtiene todas las recetas registradas para reportes legales (ARCSA)
     */
    async obtenerRecetasARCSA(filtros: { inicio?: string; fin?: string } = {}): Promise<any[]> {
        let sql = `
            SELECT 
                r.*,
                v.fecha_venta,
                c.nombre_completo as cliente_nombre,
                c.documento as cliente_documento
            FROM recetas r
            JOIN ventas v ON r.venta_id = v.id
            LEFT JOIN clientes c ON r.cliente_id = c.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (filtros.inicio) {
            sql += ` AND date(v.fecha_venta) >= ?`;
            params.push(filtros.inicio);
        }
        if (filtros.fin) {
            sql += ` AND date(v.fecha_venta) <= ?`;
            params.push(filtros.fin);
        }

        sql += ` ORDER BY v.fecha_venta DESC`;
        
        const result = await this.db.query<any>(sql, params);
        const recetas = this.db.toCamelCase(result);

        // Para cada receta, traer los productos controlados de esa venta
        for (const receta of recetas) {
            const prodSql = `
                SELECT 
                    p.nombre_comercial,
                    p.principio_activo,
                    vd.cantidad,
                    pres.unidad_base
                FROM ventas_detalles vd
                JOIN presentaciones pres ON vd.presentacion_id = pres.id
                JOIN productos p ON pres.producto_id = p.id
                WHERE vd.venta_id = ? AND (p.requiere_receta = 1 OR p.es_controlado = 1)
            `;
            const productos = await this.db.query<any>(prodSql, [receta.ventaId]);
            receta.productos = this.db.toCamelCase(productos);
        }

        return recetas;
    }
}








