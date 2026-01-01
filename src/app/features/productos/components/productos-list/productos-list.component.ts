import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductosService } from '../../services/productos.service';
import { CategoriasService } from '../../services/categorias.service';
import { TableComponent, TableColumn, TableAction } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ProductoFormComponent } from '../producto-form/producto-form.component';
import { CategoriaQuickFormComponent } from '../categoria-quick-form/categoria-quick-form.component';
import { LaboratorioQuickFormComponent } from '../laboratorio-quick-form/laboratorio-quick-form.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { PersistenceService } from '../../../../shared/services/persistence.service';
import { ExportService } from '../../../../shared/services/export.service';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';
import { Producto, EstadoRegistro } from '../../../../core/models';

/**
 * Listado de Productos (Catálogo Maestro)
 * Visualiza el catálogo con stock consolidado desde lotes
 * Adaptado al esquema de Ecuador (Laboratorios y Moneda USD)
 */
@Component({
    selector: 'app-productos-list',
    standalone: true,
    imports: [
        CommonModule, 
        FormsModule, 
        TableComponent, 
        ButtonComponent, 
        SafeHtmlPipe, 
        SkeletonComponent, 
        TableToolsComponent, 
        ModalComponent,
        ProductoFormComponent,
        CategoriaQuickFormComponent,
        LaboratorioQuickFormComponent,
        CurrencyFormatPipe
    ],
    providers: [CurrencyFormatPipe],
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
    private exportService = inject(ExportService);
    private currencyPipe = inject(CurrencyFormatPipe);

    icons = APP_ICONS;
    searchTerm = '';
    selectedCategoria = '';
    filterType = 'all';
    statusFilter = signal<string>(EstadoRegistro.ACTIVO);
    stats = signal({ total: 0, stockBajo: 0, sinStock: 0, vencimientosProximos: 0 });
    filteredProductos = signal<Producto[]>([]);

    // Modales y selección
    selectedProducto = signal<Producto | null>(null);
    showModalDetalle = signal(false);
    showModalEdicion = signal(false);
    showModalLaboratorios = signal(false);
    showModalCategorias = signal(false);
    idProductoEdicion = signal<number | null>(null);

    // Configuración para Import/Export (Simplificada al modelo base)
    private readonly IMPORT_MAPPING: Record<string, keyof Producto> = {
        'Código Interno': 'codigoInterno',
        'Nombre Comercial': 'nombreComercial',
        'Principio Activo': 'principioActivo'
    };

    columns: TableColumn<Producto>[] = [
// ... resto de columnas ...
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
                    <span class="text-[10px] text-gray-400 uppercase font-medium">${row.principioActivo || '<span class="italic text-[9px] lowercase">Sin principio activo</span>'}</span>
                </div>
            `
        },
        {
            key: 'laboratorioNombre',
            label: 'Laboratorio',
            sortable: true,
            render: (row) => `
                <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold text-gray-600">${row.laboratorioNombre || '<span class="text-gray-400 italic">Sin Laboratorio</span>'}</span>
                </div>
            `
        },
        {
            key: 'categoriaNombre',
            label: 'Categoría',
            sortable: true
        },
        {
            key: 'presentaciones',
            label: 'Stock x Presentación',
            render: (row) => this.getStockPresentaciones(row)
        },
        {
            key: 'estado',
            label: 'Estado',
            render: (row) => `
                <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    row.estado === EstadoRegistro.ACTIVO 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }">
                    ${row.estado}
                </span>
            `
        },
        {
            key: 'alertas',
            label: 'Alertas',
            render: (row) => this.getStatusBadges(row)
        }
    ];

    actions: TableAction<Producto>[] = [
        {
            label: 'Ver Ficha',
            iconName: 'VIEW',
            variant: 'secondary',
            handler: (producto) => this.verDetalle(producto)
        },
        {
            label: 'Lotes / Kardex',
            iconName: 'BOXES',
            variant: 'primary',
            handler: (producto) => this.verLotes(producto)
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
            visible: (p) => p.estado === EstadoRegistro.ACTIVO,
            handler: (producto) => this.eliminar(producto)
        },
        {
            label: 'Reactivar',
            iconName: 'CHECK',
            variant: 'primary',
            visible: (p) => p.estado === EstadoRegistro.INACTIVO,
            handler: (producto) => this.reactivar(producto)
        }
    ];

    // ... ngOnInit y otros métodos ...

    verDetalle(producto: Producto): void {
        this.selectedProducto.set(producto);
        this.showModalDetalle.set(true);
    }

    cerrarDetalle(): void {
        this.showModalDetalle.set(false);
        setTimeout(() => this.selectedProducto.set(null), 300);
    }

    verLotes(producto: Producto): void {
        this.router.navigate(['/productos', producto.id]);
    }

    async onProductoSaved() {
        this.showModalEdicion.set(false);
        await this.productosService.cargarProductos();
        this.applyFilter();
        await this.loadStats();
    }

    async ngOnInit() {
        // Recuperar filtros persistidos
        const savedFilters = this.persistenceService.get<any>('productos-filters');
        if (savedFilters) {
            this.searchTerm = savedFilters.searchTerm || '';
            this.selectedCategoria = savedFilters.selectedCategoria || '';
            this.filterType = savedFilters.filterType || 'all';
            if (savedFilters.statusFilter) {
                this.statusFilter.set(savedFilters.statusFilter);
            }
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
            filterType: this.filterType,
            statusFilter: this.statusFilter()
        });

        let productos = [...this.productosService.productos()];

        // Filtro por Estado (Nuevo)
        productos = productos.filter(p => p.estado === this.statusFilter());

        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            productos = productos.filter(p =>
                p.nombreComercial.toLowerCase().includes(term) ||
                (p.principioActivo && p.principioActivo.toLowerCase().includes(term)) ||
                (p.codigoInterno && p.codigoInterno.toLowerCase().includes(term)) ||
                (p.laboratorioNombre && p.laboratorioNombre.toLowerCase().includes(term)) ||
                (p.presentaciones && p.presentaciones.some(pres => pres.codigoBarras && pres.codigoBarras.toLowerCase().includes(term)))
            );
        }

        if (this.selectedCategoria) {
            const catId = parseInt(this.selectedCategoria, 10);
            productos = productos.filter(p => p.categoriaId === catId);
        }

        switch (this.filterType) {
            case 'stock-bajo':
                productos = productos.filter(p => 
                    p.presentaciones && p.presentaciones.some(pres => (pres.stockTotal || 0) <= (pres.stockMinimo || 0) && (pres.stockTotal || 0) > 0)
                );
                break;
            case 'sin-stock':
                productos = productos.filter(p => 
                    !p.presentaciones || p.presentaciones.every(pres => (pres.stockTotal || 0) === 0)
                );
                break;
            case 'requiere-receta':
                productos = productos.filter(p => p.requiereReceta);
                break;
        }

        this.filteredProductos.set(productos);
    }

    getStockPresentaciones(producto: Producto): string {
        if (!producto.presentaciones || producto.presentaciones.length === 0) {
            return '<span class="text-gray-400 italic text-[10px]">Sin presentaciones</span>';
        }

        return producto.presentaciones.map(p => {
            const stockTotal = p.stockTotal || 0;
            const unidadesPorCaja = p.unidadesPorCaja || 1;
            
            let stockHtml = '';
            if (unidadesPorCaja > 1) {
                const cajas = Math.floor(stockTotal / unidadesPorCaja);
                const unidades = stockTotal % unidadesPorCaja;
                stockHtml = `<span class="font-black text-slate-700">${cajas}</span> <span class="text-[9px] text-slate-400 uppercase">Cajas</span>`;
                if (unidades > 0) {
                    stockHtml += ` <span class="text-slate-300">+</span> <span class="font-black text-slate-700">${unidades}</span> <span class="text-[9px] text-slate-400 uppercase">${p.unidadBase}s</span>`;
                }
            } else {
                stockHtml = `<span class="font-black text-slate-700">${stockTotal}</span> <span class="text-[9px] text-slate-400 uppercase">${p.unidadBase}s</span>`;
            }

            // Alerta de stock bajo por presentación
            const esStockBajo = stockTotal <= (p.stockMinimo || 0);
            const alertClass = esStockBajo ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-white';

            return `
                <div class="flex items-center justify-between gap-4 mb-1 p-1.5 rounded-lg border ${alertClass}">
                    <span class="text-[9px] font-black text-slate-500 uppercase truncate max-w-[100px]">${p.nombreDescriptivo}</span>
                    <div class="flex items-center gap-1">
                        ${stockHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    getStatusBadges(producto: Producto): string {
        let html = '<div class="flex flex-wrap gap-1">';
        
        const tieneAgotados = producto.presentaciones?.some(p => (p.stockTotal || 0) <= 0);
        const tieneBajos = producto.presentaciones?.some(p => (p.stockTotal || 0) <= (p.stockMinimo || 0));

        // Clase base para badges discretos: fondo blanco, texto y borde de color
        const baseClass = 'px-1.5 py-0.5 text-[8px] font-black rounded border uppercase bg-white';

        if (tieneAgotados) {
            html += `<span class="${baseClass} text-red-600 border-red-500">Sin Stock</span>`;
        } else if (tieneBajos) {
            html += `<span class="${baseClass} text-amber-600 border-amber-500">Stock Bajo</span>`;
        }

        if (producto.requiereReceta) {
            html += `<span class="${baseClass} text-blue-600 border-blue-500">Receta</span>`;
        }
        if (producto.esControlado) {
            html += `<span class="${baseClass} text-purple-600 border-purple-500">Controlado</span>`;
        }
        html += '</div>';
        return html;
    }

    crearNuevo(): void {
        this.idProductoEdicion.set(null);
        this.showModalEdicion.set(true);
    }

    editar(producto: Producto): void {
        this.idProductoEdicion.set(producto.id!);
        this.showModalEdicion.set(true);
    }

    gestionarCategorias(): void {
        this.showModalCategorias.set(true);
    }

    gestionarLaboratorios(): void {
        this.showModalLaboratorios.set(true);
    }

    async eliminar(producto: Producto): Promise<void> {
        const confirmed = await this.confirmService.ask({
            title: 'Dar de Baja Producto',
            message: `¿Está seguro de desactivar "${producto.nombreComercial}"? Ya no aparecerá en el POS ni en nuevas órdenes.`,
            variant: 'danger',
            confirmText: 'Desactivar'
        });

        if (confirmed) {
            try {
                await this.productosService.eliminar(producto.id!);
                this.alertService.success('Producto desactivado correctamente');
                await this.productosService.cargarProductos();
                this.applyFilter();
                await this.loadStats();
            } catch (error: any) {
                this.alertService.error('Error al desactivar: ' + error.message);
            }
        }
    }

    async reactivar(producto: Producto): Promise<void> {
        try {
            await this.productosService.cambiarEstado(producto.id!, EstadoRegistro.ACTIVO);
            this.alertService.success('Producto reactivado correctamente');
            await this.productosService.cargarProductos();
            this.applyFilter();
            await this.loadStats();
        } catch (error: any) {
            this.alertService.error('Error al reactivar: ' + error.message);
        }
    }

    // --- ACCIONES DE DATOS ---

    async onImportExcel(file: File) {
        try {
            const rawData = await this.exportService.importFromExcel<any>(file);
            if (!rawData || rawData.length === 0) {
                this.alertService.error('El archivo está vacío o no es válido');
                return;
            }

            const confirmed = await this.confirmService.ask({
                title: 'Importar Catálogo',
                message: `Se han encontrado ${rawData.length} productos. ¿Desea integrarlos al catálogo maestro?`,
                variant: 'primary',
                confirmText: 'Iniciar Importación'
            });

            if (!confirmed) return;

            let exitosos = 0;
            let errores = 0;

            for (const row of rawData) {
                try {
                    const producto: Partial<Producto> = {
                        estado: EstadoRegistro.ACTIVO
                    };

                    Object.entries(this.IMPORT_MAPPING).forEach(([excelKey, modelKey]) => {
                        if (row[excelKey] !== undefined) {
                            (producto as any)[modelKey] = row[excelKey];
                        }
                    });

                    if (producto.nombreComercial) {
                        await this.productosService.crear(producto);
                        exitosos++;
                    }
                } catch (e) {
                    errores++;
                }
            }

            this.alertService.success(`Importación finalizada: ${exitosos} productos nuevos.`);
            await this.productosService.cargarProductos();
            this.applyFilter();
            await this.loadStats();
        } catch (error: any) {
            this.alertService.error('Error durante la importación: ' + error.message);
        }
    }

    exportToExcel() {
        const data = this.filteredProductos().map(p => ({
            'SKU': p.codigoInterno,
            'Nombre Comercial': p.nombreComercial,
            'Principio Activo': p.principioActivo,
            'Laboratorio': p.laboratorioNombre,
            'Categoría': p.categoriaNombre,
            'Requiere Receta': p.requiereReceta ? 'SÍ' : 'NO',
            'Presentaciones': p.presentaciones?.map(pres => `${pres.nombreDescriptivo} (Stock: ${pres.stockTotal})`).join(' | ')
        }));
        this.exportService.exportToExcel(data, 'Catalogo_Productos_MiFarmacia');
    }

    exportToPdf() {
        const data = this.filteredProductos().map(p => [
            p.codigoInterno || '-',
            p.nombreComercial,
            p.laboratorioNombre || '-',
            p.presentaciones?.map(pres => `${pres.nombreDescriptivo}: ${pres.stockTotal}`).join('\n') || 'Sin stock'
        ]);
        
        const columns = ['SKU', 'Producto', 'Laboratorio', 'Stock x Presentación'];
        this.exportService.exportToPdf('Reporte de Catálogo Maestro', columns, data, 'Catalogo_Reporte');
    }

    onDownloadTemplate() {
        const headers = Object.keys(this.IMPORT_MAPPING);
        this.exportService.downloadTemplate(headers, 'Plantilla_Importar_Productos');
    }
}
