import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { APP_ICONS } from '../../core/constants/icons';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';
import { ProductosService } from '../productos/services/productos.service';
import { VentasService } from '../ventas/services/ventas.service';
import { ComprasService } from '../compras/services/compras.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { RolUsuario } from '../../core/models';

/**
 * Componente Dashboard - Página principal
 * Centraliza alertas de stock, vencimientos y KPI del sistema
 */
@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule, SafeHtmlPipe, CurrencyFormatPipe],
    templateUrl: './dashboard.component.html',
    styles: []
})
export class DashboardComponent implements OnInit {
    icons = APP_ICONS;
    Math = Math;

    productosService = inject(ProductosService);
    ventasService = inject(VentasService);
    comprasService = inject(ComprasService);
    authService = inject(AuthService);
    notificationsService = inject(NotificationsService);

    RolUsuario = RolUsuario;

    stats = signal({
        totalVentasHoy: 0,
        totalProductos: 0,
        stockBajo: 0,
        sinStock: 0,
        vencimientosProximos: 0,
        totalDeudaProveedores: 0
    });

    trendData = signal<{ day: string; value: number }[]>([]);

    get maxTrendValue(): number {
        const data = this.trendData();
        if (!data.length) return 100;
        const max = Math.max(...data.map(d => d.value));
        return max > 0 ? max * 1.2 : 100;
    }

    async ngOnInit() {
        await this.loadStats();
        await this.notificationsService.loadAlerts();
    }

    private async loadStats() {
        try {
            const puedeVerCompras = this.authService.tieneRol([RolUsuario.ADMINISTRADOR, RolUsuario.FARMACEUTICO]);
            const [prodStats, totalVentasHoy, ventas7Dias, totalDeuda] = await Promise.all([
                this.productosService.obtenerEstadisticas().catch(() => ({ total: 0, stockBajo: 0, sinStock: 0, vencimientosProximos: 0 })),
                this.ventasService.obtenerTotalVentasHoy().catch(() => 0),
                this.ventasService.obtenerVentasUltimos7Dias().catch(() => []),
                puedeVerCompras ? this.comprasService.obtenerTotalDeudaProveedores().catch(() => 0) : Promise.resolve(0)
            ]);

            this.stats.update(s => ({
                ...s,
                totalProductos: prodStats?.total ?? 0,
                stockBajo: prodStats?.stockBajo ?? 0,
                sinStock: prodStats?.sinStock ?? 0,
                vencimientosProximos: prodStats?.vencimientosProximos ?? 0,
                totalVentasHoy: totalVentasHoy ?? 0,
                totalDeudaProveedores: totalDeuda ?? 0
            }));
            this.trendData.set(Array.isArray(ventas7Dias) ? ventas7Dias : []);
        } catch (e) {
            console.error('Error cargando estadísticas del dashboard:', e);
        }
    }

    // Generador de puntos para el gráfico SVG
    get chartPoints(): string {
        const data = this.trendData() ?? [];
        if (!data.length) return '';
        const max = this.maxTrendValue;
        const width = 400;
        const height = 150;
        const stepX = data.length > 1 ? width / (data.length - 1) : 0;

        return data.map((d, i) => {
            const x = i * stepX;
            const y = height - (d.value / max) * height;
            return `${x},${y}`;
        }).join(' ');
    }

    get chartPath(): string {
        return `M ${this.chartPoints}`;
    }

    get chartAreaPath(): string {
        const points = this.chartPoints;
        const height = 150;
        const width = 400;
        return `M ${points} L ${width},${height} L 0,${height} Z`;
    }
}
