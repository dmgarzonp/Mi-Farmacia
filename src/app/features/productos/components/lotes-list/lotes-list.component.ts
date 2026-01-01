import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductosService } from '../../services/productos.service';
import { TableComponent, TableColumn } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { Producto, Lote, MovimientoStock, TipoMovimiento } from '../../../../core/models';

/**
 * Vista de Kardex / Lotes de un producto
 * Permite ver la trazabilidad física de un medicamento
 */
@Component({
    selector: 'app-lotes-list',
    standalone: true,
    imports: [CommonModule, TableComponent, ButtonComponent, SafeHtmlPipe],
    templateUrl: './lotes-list.component.html',
    styles: []
})
export class LotesListComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private productosService = inject(ProductosService);

    icons = APP_ICONS;
    producto = signal<Producto | null>(null);
    lotes = signal<Lote[]>([]);
    movimientos = signal<any[]>([]);
    loading = signal(true);

    totalStockConsolidado = computed(() => {
        const lotes = this.lotes();
        return lotes.reduce((acc, l) => acc + (l.stockActual || 0), 0);
    });

    columns: TableColumn<Lote>[] = [
        {
            key: 'presentacionNombre',
            label: 'Presentación',
            render: (row) => `<span class="text-xs font-bold text-primary-600">${row.presentacionNombre || 'Genérica'}</span>`
        },
        {
            key: 'lote',
            label: 'Nº de Lote',
            sortable: true,
            render: (row) => `<span class="font-black text-gray-700">${row.lote}</span>`
        },
        {
            key: 'fechaVencimiento',
            label: 'Vencimiento',
            sortable: true,
            render: (row) => this.getVencimientoBadge(row)
        },
        {
            key: 'stockActual',
            label: 'Stock (Unidades)',
            sortable: true,
            render: (row) => `<span class="text-lg font-black ${row.stockActual > 0 ? 'text-primary-700' : 'text-gray-400'}">${row.stockActual}</span>`
        },
        {
            key: 'precioCompraCaja',
            label: 'Costo Caja',
            render: (row) => `<span class="text-xs font-bold text-slate-500">$${row.precioCompraCaja.toFixed(2)}</span>`
        },
        {
            key: 'fechaIngreso',
            label: 'Ingreso',
            sortable: true
        }
    ];

    movimientoColumns: TableColumn<any>[] = [
        {
            key: 'fechaMovimiento',
            label: 'Fecha y Hora',
            sortable: true,
            render: (row) => `<span class="text-xs text-gray-500">${new Date(row.fechaMovimiento).toLocaleString()}</span>`
        },
        {
            key: 'tipo',
            label: 'Operación',
            render: (row) => this.getTipoMovimientoBadge(row.tipo)
        },
        {
            key: 'presentacionNombre',
            label: 'Presentación',
            render: (row) => `<span class="text-[10px] font-bold text-gray-400 uppercase">${row.presentacionNombre}</span>`
        },
        {
            key: 'loteNumero',
            label: 'Lote',
            render: (row) => `<span class="font-mono text-xs font-bold text-slate-600">${row.loteNumero}</span>`
        },
        {
            key: 'cantidad',
            label: 'Cantidad',
            render: (row) => {
                const esEntrada = [TipoMovimiento.ENTRADA_COMPRA, TipoMovimiento.AJUSTE_POSITIVO, TipoMovimiento.DEVOLUCION].includes(row.tipo);
                return `<span class="font-black ${esEntrada ? 'text-emerald-600' : 'text-red-600'}">${esEntrada ? '+' : '-'}${row.cantidad}</span>`;
            }
        },
        {
            key: 'documentoReferencia',
            label: 'Referencia',
            render: (row) => `<span class="text-[10px] font-black text-primary-600 uppercase bg-primary-50 px-2 py-1 rounded border border-primary-100">${row.documentoReferencia || 'S/R'}</span>`
        }
    ];

    async ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            const productoId = parseInt(id, 10);
            await this.cargarDatos(productoId);
        } else {
            this.volver();
        }
    }

    private async cargarDatos(id: number) {
        this.loading.set(true);
        try {
            const [prod, movs] = await Promise.all([
                this.productosService.obtenerPorId(id),
                this.productosService.obtenerMovimientosProducto(id)
            ]);

            if (prod && prod.presentaciones) {
                this.producto.set(prod);
                this.movimientos.set(movs);
                
                const allLotes: Lote[] = [];
                for (const pres of prod.presentaciones) {
                    const list = await this.productosService.obtenerLotes(pres.id!);
                    list.forEach(l => {
                        l.presentacionNombre = pres.nombreDescriptivo;
                        l.productoNombre = prod.nombreComercial;
                    });
                    allLotes.push(...list);
                }
                this.lotes.set(allLotes);
            } else {
                this.volver();
            }
        } catch (e) {
            console.error(e);
        } finally {
            this.loading.set(false);
        }
    }

    getTipoMovimientoBadge(tipo: TipoMovimiento): string {
        const config: Record<string, { label: string, class: string }> = {
            [TipoMovimiento.ENTRADA_COMPRA]: { label: 'Compra', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
            [TipoMovimiento.SALIDA_VENTA]: { label: 'Venta', class: 'bg-blue-100 text-blue-700 border-blue-200' },
            [TipoMovimiento.AJUSTE_POSITIVO]: { label: 'Ajuste (+)', class: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
            [TipoMovimiento.AJUSTE_NEGATIVO]: { label: 'Ajuste (-)', class: 'bg-red-50 text-red-600 border-red-100' },
            [TipoMovimiento.VENCIMIENTO]: { label: 'Vencimiento', class: 'bg-red-100 text-red-700 border-red-200' },
            [TipoMovimiento.DEVOLUCION]: { label: 'Devolución', class: 'bg-purple-100 text-purple-700 border-purple-200' }
        };

        const { label, class: cssClass } = config[tipo] || { label: tipo, class: 'bg-gray-100 text-gray-700' };
        return `<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase border ${cssClass}">${label}</span>`;
    }

    getVencimientoBadge(lote: Lote): string {
        const fecha = new Date(lote.fechaVencimiento);
        const hoy = new Date();
        const diffTime = fecha.getTime() - hoy.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return `<span class="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-black rounded-lg border border-red-200 uppercase">Vencido</span>`;
        } else if (diffDays <= 30) {
            return `<span class="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-lg border border-amber-200 uppercase">Próximo (${diffDays}d)</span>`;
        } else {
            return `<span class="text-gray-600 font-medium">${lote.fechaVencimiento}</span>`;
        }
    }

    volver() {
        this.router.navigate(['/productos']);
    }
}








