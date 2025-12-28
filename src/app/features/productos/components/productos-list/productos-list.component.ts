import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductosService } from '../../services/productos.service';
import { CategoriasService } from '../../services/categorias.service';
import { TableComponent, TableColumn, TableAction } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { PersistenceService } from '../../../../shared/services/persistence.service';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { Producto } from '../../../../core/models';

/**
 * Listado de Productos (Catálogo Maestro)
 * Visualiza el catálogo con stock consolidado desde lotes
 * Adaptado al esquema de Ecuador (Laboratorios y Moneda USD)
 */
@Component({
    selector: 'app-productos-list',
    standalone: true,
    imports: [CommonModule, FormsModule, TableComponent, ButtonComponent, SafeHtmlPipe],
    templateUrl: './productos-list.component.html',
    styles: []
})
export class ProductosListComponent implements OnInit {
    productosService = inject(ProductosService);
    categoriasService = inject(CategoriasService);
    private router = inject(Router);
    private alertService = inject(AlertService);
    private confirmService = inject(ConfirmService);
    private persistenceService = inject(PersistenceService);

    icons = APP_ICONS;
    searchTerm = '';
    selectedCategoria = '';
    filterType = 'all';
    stats = signal({ total: 0, stockBajo: 0, sinStock: 0, vencimientosProximos: 0 });
    filteredProductos = signal<Producto[]>([]);

    columns: TableColumn<Producto>[] = [
        {
            key: 'codigoInterno',
            label: 'SKU',
            width: '100px',
            sortable: true
        },
        {
            key: 'nombreComercial',
            label: 'Producto',
            sortable: true,
            render: (row) => `
                <div class="flex flex-col">
                    <span class="font-bold text-gray-800">${row.nombreComercial}</span>
                    <span class="text-[10px] text-gray-400 uppercase font-medium">${row.principioActivo || 'S/P Activo'}</span>
                </div>
            `
        },
        {
            key: 'laboratorioNombre',
            label: 'Laboratorio',
            sortable: true,
            render: (row) => `
                <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold text-gray-600">${row.laboratorioNombre || 'S/L'}</span>
                </div>
            `
        },
        {
            key: 'categoriaNombre',
            label: 'Categoría',
            sortable: true
        },
        {
            key: 'precioVenta',
            label: 'P. Venta',
            sortable: true,
            render: (row) => `<span class="font-black text-primary-700">$ ${row.precioVenta.toFixed(2)}</span>`
        },
        {
            key: 'stockTotal',
            label: 'Stock Real',
            sortable: true,
            render: (row) => this.getStockBadge(row)
        },
        {
            key: 'alertas',
            label: 'Estado',
            render: (row) => this.getStatusBadges(row)
        }
    ];

    actions: TableAction<Producto>[] = [
        {
            label: 'Lotes / Kardex',
            iconName: 'BOXES',
            variant: 'primary',
            handler: (producto) => this.verDetalle(producto)
        },
        {
            label: 'Editar',
            iconName: 'EDIT',
            variant: 'secondary',
            handler: (producto) => this.editar(producto)
        },
        {
            label: 'Eliminar',
            iconName: 'DELETE',
            variant: 'danger',
            handler: (producto) => this.eliminar(producto)
        }
    ];

    async ngOnInit() {
        // Recuperar filtros persistidos
        const savedFilters = this.persistenceService.get<any>('productos-filters');
        if (savedFilters) {
            this.searchTerm = savedFilters.searchTerm || '';
            this.selectedCategoria = savedFilters.selectedCategoria || '';
            this.filterType = savedFilters.filterType || 'all';
        }

        await Promise.all([
            this.productosService.cargarProductos(),
            this.categoriasService.cargarCategorias()
        ]);
        await this.loadStats();
        this.applyFilter();
    }

    async loadStats() {
        const estadisticas = await this.productosService.obtenerEstadisticas();
        this.stats.set(estadisticas);
    }

    onSearch() {
        this.applyFilter();
    }

    onCategoriaChange() {
        this.applyFilter();
    }

    applyFilter() {
        this.persistenceService.set('productos-filters', {
            searchTerm: this.searchTerm,
            selectedCategoria: this.selectedCategoria,
            filterType: this.filterType
        });

        let productos = [...this.productosService.productos()];

        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            productos = productos.filter(p =>
                p.nombreComercial.toLowerCase().includes(term) ||
                (p.principioActivo && p.principioActivo.toLowerCase().includes(term)) ||
                (p.codigoBarras && p.codigoBarras.toLowerCase().includes(term)) ||
                (p.codigoInterno && p.codigoInterno.toLowerCase().includes(term)) ||
                (p.laboratorioNombre && p.laboratorioNombre.toLowerCase().includes(term))
            );
        }

        if (this.selectedCategoria) {
            const catId = parseInt(this.selectedCategoria, 10);
            productos = productos.filter(p => p.categoriaId === catId);
        }

        switch (this.filterType) {
            case 'stock-bajo':
                productos = productos.filter(p => (p.stockTotal || 0) <= p.stockMinimo && (p.stockTotal || 0) > 0);
                break;
            case 'sin-stock':
                productos = productos.filter(p => (p.stockTotal || 0) === 0);
                break;
            case 'requiere-receta':
                productos = productos.filter(p => p.requiereReceta);
                break;
        }

        this.filteredProductos.set(productos);
    }

    getStockBadge(producto: Producto): string {
        const stock = producto.stockTotal || 0;
        if (stock === 0) {
            return '<span class="text-red-600 font-black">0</span>';
        } else if (stock <= producto.stockMinimo) {
            return `<span class="text-amber-600 font-black">${stock}</span> <span class="text-[8px] font-bold uppercase text-amber-500 ml-1">Bajo</span>`;
        } else {
            return `<span class="text-emerald-600 font-black">${stock}</span>`;
        }
    }

    getStatusBadges(producto: Producto): string {
        let html = '<div class="flex gap-1">';
        if (producto.requiereReceta) {
            html += '<span class="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black rounded border border-blue-100 uppercase">Receta</span>';
        }
        if (producto.esControlado) {
            html += '<span class="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-black rounded border border-purple-100 uppercase">Controlado</span>';
        }
        html += '</div>';
        return html;
    }

    crearNuevo(): void {
        this.router.navigate(['/productos/nuevo']);
    }

    verDetalle(producto: Producto): void {
        this.router.navigate(['/productos', producto.id]);
    }

    editar(producto: Producto): void {
        this.router.navigate(['/productos', producto.id, 'editar']);
    }

    gestionarCategorias(): void {
        this.router.navigate(['/productos/categorias']);
    }

    gestionarLaboratorios(): void {
        this.router.navigate(['/productos/laboratorios']);
    }

    async eliminar(producto: Producto): Promise<void> {
        const confirmed = await this.confirmService.ask({
            title: 'Eliminar del Catálogo',
            message: `¿Está seguro de eliminar "${producto.nombreComercial}"? Esto no afectará a los lotes existentes en inventario pero ya no podrá ser usado en nuevas órdenes.`,
            variant: 'danger',
            confirmText: 'Eliminar'
        });

        if (confirmed) {
            try {
                await this.productosService.eliminar(producto.id!);
                this.alertService.success('Producto marcado como inactivo');
                await this.productosService.cargarProductos();
                this.applyFilter();
                await this.loadStats();
            } catch (error: any) {
                this.alertService.error('Error al eliminar: ' + error.message);
            }
        }
    }
}
