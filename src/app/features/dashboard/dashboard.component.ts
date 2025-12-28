import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { APP_ICONS } from '../../core/constants/icons';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';
import { ProductosService } from '../productos/services/productos.service';
import { ComprasService } from '../compras/services/compras.service';

/**
 * Componente Dashboard - Página principal
 * Centraliza alertas de stock, vencimientos y KPI del sistema
 */
@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule, SafeHtmlPipe],
    templateUrl: './dashboard.component.html',
    styles: []
})
export class DashboardComponent implements OnInit {
    icons = APP_ICONS;
    Math = Math;
    
    productosService = inject(ProductosService);
    comprasService = inject(ComprasService);

    stats = signal({
        totalVentasHoy: 0,
        totalProductos: 0,
        stockBajo: 0,
        sinStock: 0,
        vencimientosProximos: 0
    });

    trendData = signal([
        { day: 'Lun', value: 450 },
        { day: 'Mar', value: 580 },
        { day: 'Mie', value: 420 },
        { day: 'Jue', value: 750 },
        { day: 'Vie', value: 890 },
        { day: 'Sab', value: 920 },
        { day: 'Dom', value: 650 }
    ]);

    criticalAlerts = signal<any[]>([]);

    get maxTrendValue(): number {
        return Math.max(...this.trendData().map(d => d.value)) * 1.2;
    }

    async ngOnInit() {
        await this.loadStats();
        await this.loadAlerts();
    }

    private async loadStats() {
        const prodStats = await this.productosService.obtenerEstadisticas();
        
        this.stats.update(s => ({
            ...s,
            totalProductos: prodStats.total,
            stockBajo: prodStats.stockBajo,
            sinStock: prodStats.sinStock,
            vencimientosProximos: prodStats.vencimientosProximos,
            totalVentasHoy: 0 // Se implementará con el módulo de ventas
        }));
    }

    private async loadAlerts() {
        const alerts: any[] = [];
        
        // 1. Alertas de Vencimiento Reales
        try {
            const lotesVencen = await this.productosService.db.query<any>(`
                SELECT l.*, p.nombre_comercial 
                FROM lotes l 
                JOIN productos p ON l.producto_id = p.id 
                WHERE l.fecha_vencimiento <= date('now', '+30 days')
                AND l.stock_actual > 0
                LIMIT 3
            `);
            
            this.productosService.db.toCamelCase(lotesVencen).forEach((l: any) => {
                alerts.push({
                    type: 'danger',
                    message: `Lote ${l.lote} de ${l.nombreComercial} vence el ${l.fechaVencimiento}`,
                    date: 'CRÍTICO'
                });
            });
        } catch (e) { console.error(e); }

        // 2. Alertas de Stock Crítico
        if (this.stats().stockBajo > 0) {
            alerts.push({
                type: 'warning',
                message: `Tienes ${this.stats().stockBajo} productos con stock bajo o nulo`,
                date: 'Inventario'
            });
        }

        this.criticalAlerts.set(alerts.length > 0 ? alerts : [
            { type: 'info', message: 'No hay alertas críticas pendientes', date: 'Al día' }
        ]);
    }

    // Generador de puntos para el gráfico SVG
    get chartPoints(): string {
        const data = this.trendData();
        const max = this.maxTrendValue;
        const width = 400;
        const height = 150;
        const stepX = width / (data.length - 1);
        
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
