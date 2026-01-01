import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductosService } from '../../services/productos.service';
import { TableComponent, TableColumn } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { Producto, Lote } from '../../../../core/models';

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
            const prod = await this.productosService.obtenerPorId(id);
            if (prod && prod.presentaciones) {
                this.producto.set(prod);
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








