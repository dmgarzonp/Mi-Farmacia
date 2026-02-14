import { Injectable, inject, signal } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { AuthService } from '../../../core/services/auth.service';
import { Lote, TipoMovimiento, MovimientoStock } from '../../../core/models';

/**
 * Servicio centralizado para gestión de inventario
 * Maneja ajustes de stock, vencimientos, devoluciones y consultas
 */
@Injectable({
    providedIn: 'root'
})
export class InventarioService {
    private db = inject(DatabaseService);
    private authService = inject(AuthService);

    /**
     * Ajusta el stock de un lote específico
     * @param loteId ID del lote a ajustar
     * @param cantidad Cantidad a ajustar (positiva para aumentar, negativa para disminuir)
     * @param tipo Tipo de ajuste (AJUSTE_POSITIVO o AJUSTE_NEGATIVO)
     * @param motivo Motivo del ajuste (obligatorio)
     * @returns Promise con el resultado
     */
    async ajustarStock(
        loteId: number, 
        cantidad: number, 
        tipo: TipoMovimiento.AJUSTE_POSITIVO | TipoMovimiento.AJUSTE_NEGATIVO,
        motivo: string
    ): Promise<void> {
        if (!motivo || motivo.trim().length === 0) {
            throw new Error('El motivo del ajuste es obligatorio');
        }

        if (cantidad === 0) {
            throw new Error('La cantidad a ajustar no puede ser cero');
        }

        try {
            // 1. Verificar que el lote existe y obtener stock actual
            const loteSql = `SELECT stock_actual, presentacion_id FROM lotes WHERE id = ?`;
            const lote = await this.db.get<any>(loteSql, [loteId]);
            
            if (!lote) {
                throw new Error('Lote no encontrado');
            }

            const stockActual = lote.stock_actual;
            const cantidadAbsoluta = Math.abs(cantidad);

            // 2. Validar que el ajuste negativo no deje stock negativo
            if (tipo === TipoMovimiento.AJUSTE_NEGATIVO) {
                if (cantidadAbsoluta > stockActual) {
                    throw new Error(
                        `Stock insuficiente. Stock actual: ${stockActual}, intentando descontar: ${cantidadAbsoluta}`
                    );
                }
            }

            // 3. Calcular nuevo stock
            const nuevoStock = tipo === TipoMovimiento.AJUSTE_POSITIVO 
                ? stockActual + cantidadAbsoluta 
                : stockActual - cantidadAbsoluta;

            // 4. Actualizar stock del lote
            const updateSql = `UPDATE lotes SET stock_actual = ? WHERE id = ?`;
            await this.db.run(updateSql, [nuevoStock, loteId]);

            // 5. Registrar movimiento de stock
            const usuarioId = this.authService.usuarioActual()?.id || null;
            const movimientoSql = `
                INSERT INTO movimientos_stock (
                    tipo, lote_id, cantidad, documento_referencia, observaciones, usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            const cantidadMovimiento = tipo === TipoMovimiento.AJUSTE_POSITIVO 
                ? cantidadAbsoluta 
                : -cantidadAbsoluta;

            await this.db.run(movimientoSql, [
                tipo,
                loteId,
                cantidadMovimiento,
                `AJUSTE-${Date.now()}`,
                motivo.trim(),
                usuarioId
            ]);
        } catch (err: any) {
            console.error('Error ajustando stock:', err);
            throw err;
        }
    }

    /**
     * Marca un lote como vencido (ajusta stock a 0)
     * @param loteId ID del lote
     * @param motivo Motivo del vencimiento
     */
    async marcarVencido(loteId: number, motivo: string): Promise<void> {
        if (!motivo || motivo.trim().length === 0) {
            throw new Error('El motivo del vencimiento es obligatorio');
        }

        try {
            // 1. Obtener stock actual
            const loteSql = `SELECT stock_actual FROM lotes WHERE id = ?`;
            const lote = await this.db.get<any>(loteSql, [loteId]);
            
            if (!lote) {
                throw new Error('Lote no encontrado');
            }

            const stockActual = lote.stock_actual;

            if (stockActual === 0) {
                throw new Error('El lote ya tiene stock cero');
            }

            // 2. Ajustar stock a 0
            const updateSql = `UPDATE lotes SET stock_actual = 0 WHERE id = ?`;
            await this.db.run(updateSql, [loteId]);

            // 3. Registrar movimiento de vencimiento
            const usuarioId = this.authService.usuarioActual()?.id || null;
            const movimientoSql = `
                INSERT INTO movimientos_stock (
                    tipo, lote_id, cantidad, documento_referencia, observaciones, usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            await this.db.run(movimientoSql, [
                TipoMovimiento.VENCIMIENTO,
                loteId,
                -stockActual,
                `VENC-${Date.now()}`,
                motivo.trim(),
                usuarioId
            ]);
        } catch (err: any) {
            console.error('Error marcando lote como vencido:', err);
            throw err;
        }
    }

    /**
     * Obtiene productos próximos a vencer
     * @param dias Número de días para considerar "próximo a vencer" (default: 30)
     */
    async obtenerProductosProximosAVencer(dias: number = 30): Promise<any[]> {
        try {
            const sql = `
                SELECT 
                    l.*,
                    p.nombre_comercial as producto_nombre,
                    p.principio_activo,
                    pres.nombre_descriptivo as presentacion_nombre,
                    pres.unidad_base,
                    julianday(l.fecha_vencimiento) - julianday('now') as dias_restantes
                FROM lotes l
                JOIN presentaciones pres ON l.presentacion_id = pres.id
                JOIN productos p ON pres.producto_id = p.id
                WHERE l.stock_actual > 0
                AND l.fecha_vencimiento <= date('now', '+' || ? || ' days')
                AND l.fecha_vencimiento >= date('now')
                ORDER BY l.fecha_vencimiento ASC
            `;
            const result = await this.db.query<any>(sql, [dias]);
            return this.db.toCamelCase(result);
        } catch (err: any) {
            console.error('Error obteniendo productos próximos a vencer:', err);
            throw err;
        }
    }

    /**
     * Obtiene productos vencidos con stock > 0
     */
    async obtenerProductosVencidos(): Promise<any[]> {
        try {
            const sql = `
                SELECT 
                    l.*,
                    p.nombre_comercial as producto_nombre,
                    p.principio_activo,
                    pres.nombre_descriptivo as presentacion_nombre,
                    pres.unidad_base,
                    julianday('now') - julianday(l.fecha_vencimiento) as dias_vencido
                FROM lotes l
                JOIN presentaciones pres ON l.presentacion_id = pres.id
                JOIN productos p ON pres.producto_id = p.id
                WHERE l.stock_actual > 0
                AND l.fecha_vencimiento < date('now')
                ORDER BY l.fecha_vencimiento ASC
            `;
            const result = await this.db.query<any>(sql);
            return this.db.toCamelCase(result);
        } catch (err: any) {
            console.error('Error obteniendo productos vencidos:', err);
            throw err;
        }
    }

    /**
     * Obtiene productos con stock bajo (por debajo del mínimo)
     */
    async obtenerProductosStockBajo(): Promise<any[]> {
        try {
            const sql = `
                SELECT 
                    pres.id as presentacion_id,
                    pres.nombre_descriptivo as presentacion_nombre,
                    pres.stock_minimo,
                    p.id as producto_id,
                    p.nombre_comercial as producto_nombre,
                    p.principio_activo,
                    COALESCE(SUM(l.stock_actual), 0) as stock_total
                FROM presentaciones pres
                JOIN productos p ON pres.producto_id = p.id
                LEFT JOIN lotes l ON pres.id = l.presentacion_id
                WHERE p.estado = 'activo'
                GROUP BY pres.id, pres.nombre_descriptivo, pres.stock_minimo, p.id, p.nombre_comercial, p.principio_activo
                HAVING stock_total <= pres.stock_minimo AND stock_total > 0
                ORDER BY (stock_total / NULLIF(pres.stock_minimo, 0)) ASC
            `;
            const result = await this.db.query<any>(sql);
            return this.db.toCamelCase(result);
        } catch (err: any) {
            console.error('Error obteniendo productos con stock bajo:', err);
            throw err;
        }
    }

    /**
     * Obtiene un lote por ID con información completa
     */
    async obtenerLotePorId(loteId: number): Promise<any> {
        try {
            const sql = `
                SELECT 
                    l.*,
                    p.nombre_comercial as producto_nombre,
                    p.principio_activo,
                    pres.nombre_descriptivo as presentacion_nombre,
                    pres.unidad_base,
                    pres.unidades_por_caja
                FROM lotes l
                JOIN presentaciones pres ON l.presentacion_id = pres.id
                JOIN productos p ON pres.producto_id = p.id
                WHERE l.id = ?
            `;
            const result = await this.db.get<any>(sql, [loteId]);
            return this.db.toCamelCase(result);
        } catch (err: any) {
            console.error('Error obteniendo lote:', err);
            throw err;
        }
    }

    /**
     * Busca lotes por término de búsqueda (producto, lote, presentación).
     * Incluye lotes con stock 0 para permitir ajustes positivos tras inventario físico.
     */
    async buscarLotes(termino: string): Promise<any[]> {
        try {
            let sql: string;
            let params: any[];

            if (termino === '*' || termino === '') {
                sql = `
                    SELECT 
                        l.*,
                        p.nombre_comercial as producto_nombre,
                        p.principio_activo,
                        pres.nombre_descriptivo as presentacion_nombre,
                        pres.unidad_base,
                        pres.unidades_por_caja
                    FROM lotes l
                    JOIN presentaciones pres ON l.presentacion_id = pres.id
                    JOIN productos p ON pres.producto_id = p.id
                    ORDER BY l.stock_actual DESC, l.fecha_vencimiento ASC
                    LIMIT 100
                `;
                params = [];
            } else {
                sql = `
                    SELECT 
                        l.*,
                        p.nombre_comercial as producto_nombre,
                        p.principio_activo,
                        pres.nombre_descriptivo as presentacion_nombre,
                        pres.unidad_base,
                        pres.unidades_por_caja
                    FROM lotes l
                    JOIN presentaciones pres ON l.presentacion_id = pres.id
                    JOIN productos p ON pres.producto_id = p.id
                    WHERE (
                        p.nombre_comercial LIKE ? OR
                        p.principio_activo LIKE ? OR
                        l.lote LIKE ? OR
                        pres.nombre_descriptivo LIKE ?
                    )
                    ORDER BY l.stock_actual DESC, l.fecha_vencimiento ASC
                    LIMIT 50
                `;
                const searchTerm = `%${termino}%`;
                params = [searchTerm, searchTerm, searchTerm, searchTerm];
            }

            const result = await this.db.query<any>(sql, params);
            return this.db.toCamelCase(result);
        } catch (err: any) {
            console.error('Error buscando lotes:', err);
            throw err;
        }
    }

    /**
     * Obtiene el historial de movimientos de un lote específico
     */
    async obtenerMovimientosLote(loteId: number): Promise<MovimientoStock[]> {
        try {
            const sql = `
                SELECT 
                    m.*,
                    u.nombre as usuario_nombre
                FROM movimientos_stock m
                LEFT JOIN usuarios u ON m.usuario_id = u.id
                WHERE m.lote_id = ?
                ORDER BY m.fecha_movimiento DESC
            `;
            const result = await this.db.query<any>(sql, [loteId]);
            return this.db.toCamelCase(result);
        } catch (err: any) {
            console.error('Error obteniendo movimientos del lote:', err);
            throw err;
        }
    }

    /**
     * Obtiene información del proveedor asociado a un lote
     * Busca la orden de compra original a través de los movimientos de stock
     */
    async obtenerProveedorDelLote(loteId: number): Promise<any> {
        try {
            // Buscar el movimiento de entrada_compra más antiguo para este lote
            const sqlMovimiento = `
                SELECT documento_referencia 
                FROM movimientos_stock 
                WHERE lote_id = ? 
                AND tipo = 'entrada_compra'
                ORDER BY fecha_movimiento ASC
                LIMIT 1
            `;
            const movimiento = await this.db.get<any>(sqlMovimiento, [loteId]);
            
            if (!movimiento || !movimiento.documento_referencia) {
                return null;
            }

            // Extraer ID de orden de compra del documento_referencia (formato: OC-{id})
            const ocMatch = movimiento.documento_referencia.match(/OC-(\d+)/);
            if (!ocMatch) {
                return null;
            }

            const ordenCompraId = parseInt(ocMatch[1], 10);

            // Obtener información de la orden de compra y proveedor
            const sqlOrden = `
                SELECT 
                    oc.id as orden_compra_id,
                    oc.numero_factura,
                    oc.fecha_factura,
                    p.id as proveedor_id,
                    p.nombre_empresa as proveedor_nombre,
                    p.ruc as proveedor_ruc,
                    p.email_empresa as proveedor_email,
                    p.telefono_empresa as proveedor_telefono,
                    p.nombre_contacto,
                    p.email_contacto,
                    p.telefono_contacto
                FROM ordenes_compra oc
                JOIN proveedores p ON oc.proveedor_id = p.id
                WHERE oc.id = ?
            `;
            const resultado = await this.db.get<any>(sqlOrden, [ordenCompraId]);
            return this.db.toCamelCase(resultado);
        } catch (err: any) {
            console.error('Error obteniendo proveedor del lote:', err);
            return null;
        }
    }

    /**
     * Devuelve un lote al proveedor (ajusta stock a 0 y registra movimiento)
     * @param loteId ID del lote
     * @param cantidad Cantidad a devolver (opcional, si no se especifica devuelve todo el stock)
     * @param motivo Motivo de la devolución
     * @param ordenCompraId ID de la orden de compra original (opcional)
     */
    async devolverAlProveedor(
        loteId: number, 
        cantidad?: number, 
        motivo: string = 'Devolución al proveedor por proximidad a vencimiento',
        ordenCompraId?: number
    ): Promise<void> {
        if (!motivo || motivo.trim().length === 0) {
            throw new Error('El motivo de la devolución es obligatorio');
        }

        try {
            // 1. Obtener stock actual del lote
            const loteSql = `SELECT stock_actual FROM lotes WHERE id = ?`;
            const lote = await this.db.get<any>(loteSql, [loteId]);
            
            if (!lote) {
                throw new Error('Lote no encontrado');
            }

            const stockActual = lote.stock_actual;
            const cantidadDevolver = cantidad || stockActual;

            if (cantidadDevolver > stockActual) {
                throw new Error(`No se puede devolver más de lo disponible. Stock actual: ${stockActual}`);
            }

            if (cantidadDevolver <= 0) {
                throw new Error('La cantidad a devolver debe ser mayor a 0');
            }

            // 2. Actualizar stock del lote
            const nuevoStock = stockActual - cantidadDevolver;
            const updateSql = `UPDATE lotes SET stock_actual = ? WHERE id = ?`;
            await this.db.run(updateSql, [nuevoStock, loteId]);

            // 3. Registrar movimiento de devolución
            const usuarioId = this.authService.usuarioActual()?.id || null;
            const documentoRef = ordenCompraId ? `DEV-OC-${ordenCompraId}` : `DEV-${Date.now()}`;
            
            const movimientoSql = `
                INSERT INTO movimientos_stock (
                    tipo, lote_id, cantidad, documento_referencia, observaciones, usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            await this.db.run(movimientoSql, [
                TipoMovimiento.DEVOLUCION,
                loteId,
                -cantidadDevolver,
                documentoRef,
                motivo.trim(),
                usuarioId
            ]);
        } catch (err: any) {
            console.error('Error devolviendo al proveedor:', err);
            throw err;
        }
    }

    /**
     * Genera el contenido de un correo para solicitar devolución al proveedor
     */
    generarPlantillaCorreoDevolucion(lote: any, proveedor: any, cantidad: number): string {
        const fechaActual = new Date().toLocaleDateString('es-EC', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const fechaVencimiento = new Date(lote.fechaVencimiento).toLocaleDateString('es-EC', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        return `
Estimado/a ${proveedor.nombreContacto || 'Representante'},

Por medio de la presente, solicitamos proceder con la devolución del siguiente producto:

PRODUCTO: ${lote.productoNombre}
PRESENTACIÓN: ${lote.presentacionNombre}
LOTE: ${lote.lote}
FECHA DE VENCIMIENTO: ${fechaVencimiento}
CANTIDAD A DEVOLVER: ${cantidad} ${lote.unidadBase}
ORDEN DE COMPRA: ${proveedor.ordenCompraId ? `#${proveedor.ordenCompraId}` : 'N/A'}
${proveedor.numeroFactura ? `FACTURA: ${proveedor.numeroFactura}` : ''}

MOTIVO: Producto próximo a vencer (${lote.diasRestantes || 'N/A'} días restantes)

Solicitamos coordinar la recolección o indicar el procedimiento para realizar la devolución.

Quedamos atentos a su respuesta.

Saludos cordiales,
${this.authService.usuarioActual()?.nombre || 'Equipo de Inventario'}
Mi Farmacia
Fecha: ${fechaActual}
        `.trim();
    }
}
