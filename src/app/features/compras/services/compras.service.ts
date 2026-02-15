import { Injectable, signal, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { OrdenCompra, DetalleOrdenCompra, EstadoOrdenCompra, TipoMovimiento, PagoCompra } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Servicio para gestión de órdenes de compra
 * Adaptado al nuevo esquema de trazabilidad y lotes
 */
@Injectable({
    providedIn: 'root'
})
export class ComprasService {
    private db = inject(DatabaseService);
    private authService = inject(AuthService);
    
    ordenes = signal<OrdenCompra[]>([]);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    async cargarOrdenes(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const sql = `
                SELECT 
                    oc.*,
                    p.nombre_empresa as proveedor_nombre,
                    (oc.total - COALESCE((SELECT SUM(monto) FROM pagos_compra WHERE orden_compra_id = oc.id), 0)) as saldo_pendiente
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

            // Saldo pendiente para crédito (total - suma de pagos)
            const saldoSql = `SELECT COALESCE(SUM(monto), 0) as total_pagado FROM pagos_compra WHERE orden_compra_id = ?`;
            const saldoRow = await this.db.get<any>(saldoSql, [id]);
            const totalPagado = saldoRow ? (saldoRow.totalPagado ?? saldoRow.total_pagado ?? 0) : 0;
            ordenCompleta.saldoPendiente = (ordenCompleta.total || 0) - totalPagado;

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
            const usuarioId = this.authService.usuarioActual()?.id || null;
            const ordenSql = `
                INSERT INTO ordenes_compra (
                    proveedor_id, fecha_emision, estado, tipo_compra, plazo_dias, forma_pago, fecha_vencimiento_pago,
                    subtotal, descuento_monto, impuesto_total, total, moneda, observaciones, creado_por
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const result = await this.db.run(ordenSql, [
                Number(orden.proveedorId),
                orden.fechaEmision || new Date().toISOString().split('T')[0],
                orden.estado || EstadoOrdenCompra.PENDIENTE,
                orden.tipoCompra || 'contado',
                orden.plazoDias ?? null,
                orden.formaPago || null,
                orden.fechaVencimientoPago || null,
                Number(orden.subtotal) || 0,
                Number(orden.descuentoMonto) || 0,
                Number(orden.impuestoTotal) || 0,
                Number(orden.total) || 0,
                orden.moneda || 'USD',
                orden.observaciones || null,
                usuarioId
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
                SET proveedor_id = ?, fecha_emision = ?, estado = ?, tipo_compra = ?, plazo_dias = ?, forma_pago = ?, fecha_vencimiento_pago = ?,
                    subtotal = ?, descuento_monto = ?, impuesto_total = ?, total = ?, observaciones = ?
                WHERE id = ?
            `;

            await this.db.run(sql, [
                Number(orden.proveedorId),
                orden.fechaEmision,
                orden.estado,
                orden.tipoCompra ?? 'contado',
                orden.plazoDias ?? null,
                orden.formaPago ?? null,
                orden.fechaVencimientoPago ?? null,
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
            await this.cargarOrdenes();
        } catch (err: any) {
            console.error('Error cambiando estado:', err);
            throw err;
        }
    }

    /**
     * Cantidad de órdenes pendientes de aprobar o recibir (estado pendiente o aprobada).
     */
    async obtenerOrdenesPendientesCount(): Promise<number> {
        try {
            const row = await this.db.get<{ count: number }>(
                `SELECT COUNT(*) as count FROM ordenes_compra WHERE estado IN (?, ?)`,
                [EstadoOrdenCompra.PENDIENTE, EstadoOrdenCompra.APROBADA]
            );
            const count = row != null ? Number((row as any).count ?? 0) : 0;
            return count;
        } catch (err: any) {
            console.error('Error obteniendo count órdenes pendientes:', err);
            return 0;
        }
    }

    /**
     * Órdenes a crédito con saldo pendiente, para vista "Saldos de cancelación".
     */
    async obtenerOrdenesConSaldoPendiente(filtros?: { proveedorId?: number; plazoDias?: number }): Promise<(OrdenCompra & { diasRestantes?: number; diasVencido?: number })[]> {
        try {
            let sql = `
                SELECT 
                    oc.*,
                    p.nombre_empresa as proveedor_nombre,
                    (oc.total - COALESCE((SELECT SUM(monto) FROM pagos_compra WHERE orden_compra_id = oc.id), 0)) as saldo_pendiente
                FROM ordenes_compra oc
                LEFT JOIN proveedores p ON oc.proveedor_id = p.id
                WHERE oc.tipo_compra = 'credito'
                AND (oc.total - COALESCE((SELECT SUM(monto) FROM pagos_compra WHERE orden_compra_id = oc.id), 0)) > 0
            `;
            const params: any[] = [];
            if (filtros?.proveedorId != null) {
                sql += ` AND oc.proveedor_id = ?`;
                params.push(filtros.proveedorId);
            }
            if (filtros?.plazoDias != null) {
                sql += ` AND oc.plazo_dias = ?`;
                params.push(filtros.plazoDias);
            }
            sql += ` ORDER BY oc.fecha_vencimiento_pago IS NULL, oc.fecha_vencimiento_pago ASC, oc.id DESC`;
            const rows = await this.db.query<any>(sql, params);
            const list = this.db.toCamelCase(rows) as (OrdenCompra & { diasRestantes?: number; diasVencido?: number })[];
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            for (const o of list) {
                if (o.fechaVencimientoPago) {
                    const ven = new Date(o.fechaVencimientoPago);
                    ven.setHours(0, 0, 0, 0);
                    const diff = Math.floor((ven.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                    if (diff >= 0) o.diasRestantes = diff;
                    else o.diasVencido = -diff;
                }
            }
            return list;
        } catch (err: any) {
            console.error('Error obteniendo órdenes con saldo:', err);
            throw err;
        }
    }

    /**
     * Obtiene los pagos (abonos) registrados para una orden de compra (crédito).
     */
    async obtenerPagos(ordenCompraId: number): Promise<PagoCompra[]> {
        try {
            const sql = `
                SELECT * FROM pagos_compra WHERE orden_compra_id = ? ORDER BY fecha_pago DESC
            `;
            const rows = await this.db.query<any>(sql, [ordenCompraId]);
            return this.db.toCamelCase(rows) as PagoCompra[];
        } catch (err: any) {
            console.error('Error obteniendo pagos:', err);
            throw err;
        }
    }

    /**
     * Registra un pago (abono) contra una orden a crédito. Valida que el total pagado no supere el total de la orden.
     */
    async registrarPago(ordenCompraId: number, pago: Partial<PagoCompra>): Promise<number> {
        try {
            const orden = await this.obtenerPorId(ordenCompraId);
            if (!orden) throw new Error('Orden no encontrada');
            const saldo = orden.saldoPendiente ?? orden.total ?? 0;
            if (Number(pago.monto || 0) <= 0) throw new Error('El monto del pago debe ser mayor a 0');
            if (Number(pago.monto || 0) > saldo) {
                throw new Error('El monto del pago supera el saldo pendiente de la orden');
            }
            const usuarioId = this.authService.usuarioActual()?.id || null;
            const sql = `
                INSERT INTO pagos_compra (orden_compra_id, monto, fecha_pago, forma_pago, referencia, observaciones, registrado_por)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const result = await this.db.run(sql, [
                ordenCompraId,
                Number(pago.monto),
                pago.fechaPago || new Date().toISOString().split('T')[0],
                pago.formaPago || 'efectivo',
                pago.referencia || null,
                pago.observaciones || null,
                usuarioId
            ]);
            await this.cargarOrdenes();
            return result.lastInsertRowid;
        } catch (err: any) {
            console.error('Error registrando pago:', err);
            throw err;
        }
    }

    /**
     * Actualiza forma de pago (y opcionalmente registra pago total) en la orden. Usado al recibir mercancía al contado.
     */
    async actualizarFormaPago(ordenCompraId: number, formaPago: string, referencia?: string): Promise<void> {
        try {
            await this.db.run(
                `UPDATE ordenes_compra SET forma_pago = ? WHERE id = ?`,
                [formaPago, ordenCompraId]
            );
            const orden = await this.obtenerPorId(ordenCompraId);
            if (orden && orden.total != null && orden.total > 0) {
                await this.registrarPago(ordenCompraId, {
                    ordenCompraId,
                    monto: orden.total,
                    fechaPago: new Date().toISOString().split('T')[0],
                    formaPago,
                    referencia
                });
            }
            await this.cargarOrdenes();
        } catch (err: any) {
            console.error('Error actualizando forma de pago:', err);
            throw err;
        }
    }

    /**
     * Órdenes a crédito de un proveedor (con o sin saldo), para ficha proveedor.
     */
    async obtenerOrdenesCreditoPorProveedor(proveedorId: number): Promise<(OrdenCompra & { diasRestantes?: number; diasVencido?: number })[]> {
        try {
            const sql = `
                SELECT 
                    oc.*,
                    p.nombre_empresa as proveedor_nombre,
                    (oc.total - COALESCE((SELECT SUM(monto) FROM pagos_compra WHERE orden_compra_id = oc.id), 0)) as saldo_pendiente
                FROM ordenes_compra oc
                LEFT JOIN proveedores p ON oc.proveedor_id = p.id
                WHERE oc.proveedor_id = ? AND oc.tipo_compra = 'credito'
                ORDER BY oc.fecha_emision DESC
            `;
            const rows = await this.db.query<any>(sql, [proveedorId]);
            const list = this.db.toCamelCase(rows) as (OrdenCompra & { diasRestantes?: number; diasVencido?: number })[];
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            for (const o of list) {
                if (o.fechaVencimientoPago) {
                    const ven = new Date(o.fechaVencimientoPago);
                    ven.setHours(0, 0, 0, 0);
                    const diff = Math.floor((ven.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                    if (diff >= 0) o.diasRestantes = diff;
                    else o.diasVencido = -diff;
                }
            }
            return list;
        } catch (err: any) {
            console.error('Error obteniendo órdenes crédito por proveedor:', err);
            throw err;
        }
    }

    /**
     * Kardex de saldos a crédito con un proveedor: movimientos (compra + pagos) ordenados por fecha con saldo acumulado.
     */
    async obtenerMovimientosKardexProveedor(proveedorId: number): Promise<{ fecha: string; tipo: 'compra' | 'pago'; ordenId: number; numeroOrden: string; concepto: string; entrega?: string; debito: number; credito: number; saldo: number }[]> {
        try {
            const ordenes = await this.obtenerOrdenesCreditoPorProveedor(proveedorId);
            const movs: { fecha: string; tipo: 'compra' | 'pago'; ordenId: number; numeroOrden: string; concepto: string; entrega?: string; debito: number; credito: number; saldo: number }[] = [];
            for (const oc of ordenes) {
                movs.push({
                    fecha: oc.fechaEmision || '',
                    tipo: 'compra',
                    ordenId: oc.id!,
                    numeroOrden: `OC-${oc.id}`,
                    concepto: `Compra orden #${oc.id}`,
                    entrega: oc.fechaRecepcion || undefined,
                    debito: oc.total || 0,
                    credito: 0,
                    saldo: 0
                });
                const pagos = await this.obtenerPagos(oc.id!);
                for (const p of pagos) {
                    movs.push({
                        fecha: p.fechaPago,
                        tipo: 'pago',
                        ordenId: oc.id!,
                        numeroOrden: `OC-${oc.id}`,
                        concepto: `Pago ${p.formaPago}${p.referencia ? ' ' + p.referencia : ''}`,
                        debito: 0,
                        credito: p.monto,
                        saldo: 0
                    });
                }
            }
            movs.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.tipo === 'compra' ? -1 : 1));
            let saldoAcum = 0;
            for (const m of movs) {
                saldoAcum += m.debito - m.credito;
                m.saldo = saldoAcum;
            }
            return movs;
        } catch (err: any) {
            console.error('Error obteniendo kardex proveedor:', err);
            throw err;
        }
    }

    /**
     * Total deuda con todos los proveedores (suma de saldos pendientes de órdenes a crédito).
     * Útil para dashboard y visibilidad de pasivo a corto plazo.
     */
    async obtenerTotalDeudaProveedores(): Promise<number> {
        try {
            const sql = `
                SELECT COALESCE(SUM(oc.total - COALESCE((SELECT SUM(monto) FROM pagos_compra WHERE orden_compra_id = oc.id), 0)), 0) as total
                FROM ordenes_compra oc
                WHERE oc.tipo_compra = 'credito'
                AND (oc.total - COALESCE((SELECT SUM(monto) FROM pagos_compra WHERE orden_compra_id = oc.id), 0)) > 0
            `;
            const row = await this.db.get<{ total: number }>(sql, []);
            const n = row != null ? Number((row as any).total ?? 0) : 0;
            return n;
        } catch (err: any) {
            console.error('Error obteniendo total deuda proveedores:', err);
            return 0;
        }
    }

    /**
     * Total deuda (saldo pendiente) con un proveedor (suma de saldos de órdenes a crédito).
     */
    async obtenerTotalDeudaProveedor(proveedorId: number): Promise<number> {
        try {
            const ordenes = await this.obtenerOrdenesConSaldoPendiente({ proveedorId });
            return ordenes.reduce((acc, o) => acc + (o.saldoPendiente ?? 0), 0);
        } catch (err: any) {
            console.error('Error obteniendo total deuda proveedor:', err);
            return 0;
        }
    }

    /**
     * Obtiene el ID del primer proveedor activo (para órdenes sin proveedor asignado, ej. desde Lista de Faltantes)
     */
    async obtenerPrimerProveedorActivo(): Promise<number | null> {
        try {
            const sql = `SELECT id FROM proveedores WHERE estado = 'activo' ORDER BY nombre_empresa ASC LIMIT 1`;
            const row = await this.db.get<{ id: number }>(sql);
            return row?.id ?? null;
        } catch (err) {
            console.error('Error obteniendo primer proveedor:', err);
            return null;
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
     * 6. Si es contado y se pasan formaPago/referenciaPago, actualiza forma de pago y registra pago por el total.
     */
    async marcarComoRecibida(
        id: number,
        detallesActualizados: DetalleOrdenCompra[],
        nuevoTotal?: number,
        formaPago?: string,
        referenciaPago?: string
    ): Promise<void> {
        try {
            const orden = await this.obtenerPorId(id);
            if (!orden || !orden.detalles) throw new Error('Orden no encontrada');

            const usuarioId = this.authService.usuarioActual()?.id || null;

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

            // 2. Actualizar total de la orden si cambió y marcar como aprobada por el usuario actual
            const updateOrdenSql = `UPDATE ordenes_compra SET subtotal = ?, total = ?, aprobado_por = ? WHERE id = ?`;
            await this.db.run(updateOrdenSql, [
                nuevoTotal !== undefined ? nuevoTotal : orden.total, 
                nuevoTotal !== undefined ? nuevoTotal : orden.total, 
                usuarioId,
                id
            ]);

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

                // Registrar Movimiento de Stock con Usuario
                const sqlMov = `
                    INSERT INTO movimientos_stock (tipo, lote_id, cantidad, documento_referencia, observaciones, usuario_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                await this.db.run(sqlMov, [
                    TipoMovimiento.ENTRADA_COMPRA,
                    loteId,
                    cantidadTotalUnidades,
                    `OC-${id}`,
                    `Recepción de OC #${id} (${det.cantidad} CAJAS x ${unidadesPorCaja} unid.)`,
                    usuarioId
                ]);
            }

            await this.cambiarEstado(id, EstadoOrdenCompra.RECIBIDA);
            const hoy = new Date().toISOString().split('T')[0];
            await this.db.run(`UPDATE ordenes_compra SET fecha_recepcion = ? WHERE id = ?`, [hoy, id]);

            if (formaPago && orden.tipoCompra === 'credito') {
                // Para crédito no registramos pago total aquí; el usuario usa "Registrar pago" en el detalle
            } else if (formaPago) {
                await this.actualizarFormaPago(id, formaPago, referenciaPago);
            }
        } catch (err: any) {
            console.error('Error en recepción:', err);
            throw err;
        }
    }
}
