import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { ProductosService } from '../../features/productos/services/productos.service';
import { ComprasService } from '../../features/compras/services/compras.service';
import { RolUsuario } from '../models';

export interface NotificationAlert {
    type: 'danger' | 'warning' | 'info';
    message: string;
    date: string;
    link?: string;
}

/**
 * Servicio central de notificaciones/alertas para Dashboard y Header.
 * Agrupa vencimientos, stock bajo y (por rol) órdenes pendientes y saldos con proveedores.
 */
@Injectable({
    providedIn: 'root'
})
export class NotificationsService {
    private authService = inject(AuthService);
    private productosService = inject(ProductosService);
    private comprasService = inject(ComprasService);

    alerts = signal<NotificationAlert[]>([]);

    /** Recarga las alertas críticas (vencimientos, stock, compras según rol). */
    async loadAlerts(): Promise<void> {
        const alerts: NotificationAlert[] = [];
        const stats = await this.productosService.obtenerEstadisticas().catch(() => ({
            total: 0,
            stockBajo: 0,
            sinStock: 0,
            vencimientosProximos: 0
        }));

        // 1. Vencimientos (próximos 30 días)
        try {
            const lotesVencen = await this.productosService.db.query<any>(`
                SELECT l.*, p.nombre_comercial, pres.nombre_descriptivo 
                FROM lotes l 
                JOIN presentaciones pres ON l.presentacion_id = pres.id
                JOIN productos p ON pres.producto_id = p.id 
                WHERE l.fecha_vencimiento <= date('now', '+30 days')
                AND l.stock_actual > 0
                LIMIT 3
            `);
            this.productosService.db.toCamelCase(lotesVencen).forEach((l: any) => {
                alerts.push({
                    type: 'danger',
                    message: `Lote ${l.lote} de ${l.nombreComercial} (${l.nombreDescriptivo}) vence el ${l.fechaVencimiento}`,
                    date: 'CRÍTICO',
                    link: '/inventario/vencimientos'
                });
            });
        } catch (e) {
            console.error(e);
        }

        // 2. Stock bajo
        if (stats.stockBajo > 0) {
            alerts.push({
                type: 'warning',
                message: `Tienes ${stats.stockBajo} productos con stock bajo o nulo`,
                date: 'Inventario',
                link: '/productos'
            });
        }

        // 3. Compras (solo roles que ven Compras)
        const puedeVerCompras = this.authService.tieneRol([RolUsuario.ADMINISTRADOR, RolUsuario.FARMACEUTICO]);
        if (puedeVerCompras) {
            try {
                const [pendientesCount, ordenesConSaldo] = await Promise.all([
                    this.comprasService.obtenerOrdenesPendientesCount(),
                    this.comprasService.obtenerOrdenesConSaldoPendiente()
                ]);
                if (pendientesCount > 0) {
                    alerts.push({
                        type: 'warning',
                        message: `${pendientesCount} orden(es) de compra pendientes de aprobar o recibir`,
                        date: 'Compras',
                        link: '/compras/ordenes'
                    });
                }
                if (ordenesConSaldo.length > 0) {
                    const totalSaldo = ordenesConSaldo.reduce((acc, o) => acc + (o.saldoPendiente ?? 0), 0);
                    const formatted = totalSaldo.toLocaleString('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
                    alerts.push({
                        type: 'warning',
                        message: `${ordenesConSaldo.length} orden(es) con saldo pendiente. Total: ${formatted}`,
                        date: 'Saldos',
                        link: '/compras/saldos-credito'
                    });
                }
                // Alertas de cuota/pago a proveedor vencida o por vencer (7 días)
                const ordenesConSaldoVencidoOProximo = ordenesConSaldo.filter((o: any) => {
                    if (o.diasVencido != null && o.diasVencido > 0) return true;
                    if (o.diasRestantes != null && o.diasRestantes >= 0 && o.diasRestantes <= 7) return true;
                    return false;
                });
                if (ordenesConSaldoVencidoOProximo.length > 0) {
                    const vencidas = ordenesConSaldoVencidoOProximo.filter((o: any) => o.diasVencido != null && o.diasVencido > 0).length;
                    const mensaje = vencidas > 0
                        ? `${ordenesConSaldoVencidoOProximo.length} orden(es) con pago a proveedor vencido o por vencer en 7 días (${vencidas} vencida(s))`
                        : `${ordenesConSaldoVencidoOProximo.length} orden(es) con pago a proveedor por vencer en 7 días`;
                    alerts.push({
                        type: vencidas > 0 ? 'danger' : 'warning',
                        message: mensaje,
                        date: 'Cuota proveedor',
                        link: '/compras/saldos-credito'
                    });
                }
            } catch (e) {
                console.error(e);
            }
        }

        this.alerts.set(
            alerts.length > 0
                ? alerts
                : [{ type: 'info', message: 'No hay alertas críticas pendientes', date: 'Al día' }]
        );
    }

    /** True si hay al menos una alerta crítica (danger o warning). */
    hasCriticalAlerts(): boolean {
        return this.alerts().some(
            (a) => a.type === 'danger' || a.type === 'warning'
        );
    }
}
