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
import { Producto, EstadoRegistro, Presentacion, EstadoOrdenCompra } from '../../../../core/models';
import { ComprasService } from '../../../compras/services/compras.service';
import { PedidosService } from '../../../../shared/services/pedidos.service';

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
    comprasService = inject(ComprasService);
    pedidosService = inject(PedidosService);
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
    showModalLaboratorios = signal(false);
    showModalCategorias = signal(false);
    showModalConsolidacion = signal(false);

    // Configuración para Import/Export (Simplificada al modelo base)
    private readonly IMPORT_MAPPING: Record<string, keyof Producto> = {
        'Código Interno': 'codigoInterno',
        'Nombre Comercial': 'nombreComercial',
        'Principio Activo': 'principioActivo'
    };

    columns: TableColumn<Producto>[] = [
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
            label: 'Añadir a Pedido',
            iconName: 'CART',
            variant: 'success',
            visible: (p) => {
                const agotado = p.presentaciones?.some(pres => (pres.stockTotal || 0) <= 0);
                const bajo = p.presentaciones?.some(pres => (pres.stockTotal || 0) <= (pres.stockMinimo || 0));
                return !!(agotado || bajo) && p.estado === EstadoRegistro.ACTIVO;
            },
            handler: (producto) => {
                if (producto.presentaciones?.length) {
                    this.pedidosService.añadirItem(producto, producto.presentaciones[0]);
                }
            }
        },
        {
            label: 'Ver Ficha',
            iconName: 'VIEW',
            variant: 'secondary',
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

    async ngOnInit() {
        // Escuchar el evento personalizado desde los badges (renderizados vía HTML string)
        window.addEventListener('prepararReposicion', (event: any) => {
            const productoId = event.detail;
            const producto = this.productosService.productos().find(p => p.id === productoId);
            if (producto) this.prepararReposicion(producto);
        });

        // Evento para añadir a lista de faltantes
        window.addEventListener('añadirAPedido', (event: any) => {
            const productoId = event.detail;
            const producto = this.productosService.productos().find(p => p.id === productoId);
            if (producto && producto.presentaciones?.length) {
                this.pedidosService.añadirItem(producto, producto.presentaciones[0]);
            }
        });

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
            case 'vencimiento':
                const hoy = new Date();
                const limiteVencimiento = new Date();
                limiteVencimiento.setMonth(hoy.getMonth() + 3);
                
                productos = productos.filter(p => 
                    p.presentaciones && p.presentaciones.some(pres => {
                        if (!pres.proximoVencimiento) return false;
                        const fechaVenc = new Date(pres.proximoVencimiento);
                        return fechaVenc <= limiteVencimiento && (pres.stockTotal || 0) > 0;
                    })
                );
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
        let html = '<div class="flex items-center flex-wrap gap-1">';
        
        const tieneAgotados = producto.presentaciones?.some(p => (p.stockTotal || 0) <= 0);
        const tieneBajos = producto.presentaciones?.some(p => (p.stockTotal || 0) <= (p.stockMinimo || 0));
        
        // Lógica de Vencimiento
        const hoy = new Date();
        const limiteVencimiento = new Date();
        limiteVencimiento.setMonth(hoy.getMonth() + 3);

        const tieneVencimientosProximos = producto.presentaciones?.some(p => {
            if (!p.proximoVencimiento) return false;
            const fechaVenc = new Date(p.proximoVencimiento);
            return fechaVenc <= limiteVencimiento && fechaVenc >= hoy;
        });

        const tieneVencidos = producto.presentaciones?.some(p => {
            if (!p.proximoVencimiento) return false;
            const fechaVenc = new Date(p.proximoVencimiento);
            return fechaVenc < hoy;
        });

        // BADGES INFORMATIVOS (Solo visual)
        const baseBadge = 'px-1.5 py-0.5 text-[8px] font-black rounded border uppercase bg-white';
        
        if (tieneVencidos) {
            html += `<span class="${baseBadge} text-red-700 border-red-600 bg-red-50">VENCIDO</span>`;
        } else if (tieneVencimientosProximos) {
            html += `<span class="${baseBadge} text-orange-700 border-orange-600 bg-orange-50">Por Vencer</span>`;
        }

        if (tieneAgotados) {
            html += `<span class="${baseBadge} text-red-600 border-red-500">Sin Stock</span>`;
        } else if (tieneBajos) {
            html += `<span class="${baseBadge} text-amber-600 border-amber-50">Stock Bajo</span>`;
        }

        if (producto.requiereReceta) {
            html += `<span class="${baseBadge} text-blue-600 border-blue-500">Receta</span>`;
        }
        if (producto.esControlado) {
            html += `<span class="${baseBadge} text-purple-600 border-purple-500">Controlado</span>`;
        }

        // IVA Badge (Fase 1)
        if (producto.tarifaIva === 2) {
            html += `<span class="${baseBadge} text-indigo-600 border-indigo-200 bg-indigo-50/30">IVA 15%</span>`;
        } else {
            html += `<span class="${baseBadge} text-emerald-600 border-emerald-200 bg-emerald-50/30">IVA 0%</span>`;
        }

        html += '</div>';
        return html;
    }

    crearNuevo(): void {
        this.router.navigate(['/productos/nuevo']);
    }

    editar(producto: Producto): void {
        this.router.navigate(['/productos', producto.id, 'editar']);
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

    /**
     * Prepara una orden de compra para un producto con stock crítico
     */
    async prepararReposicion(producto: Producto) {
        // Usar la primera presentación por defecto para la reposición
        const presentacion = producto.presentaciones?.[0];
        if (!presentacion) {
            this.alertService.error('El producto no tiene presentaciones configuradas');
            return;
        }

        this.alertService.info(`Buscando el mejor proveedor para ${producto.nombreComercial}...`);

        try {
            const mejorOpcion = await this.comprasService.obtenerMejorProveedorHistorico(presentacion.id!);
            
            this.router.navigate(['/compras/nueva'], { 
                queryParams: { 
                    proveedorId: mejorOpcion?.proveedorId || null,
                    presentacionId: presentacion.id,
                    precioSugerido: mejorOpcion?.precio || presentacion.precioCompraCaja
                } 
            });
        } catch (error) {
            // Si falla la búsqueda, vamos de todas formas a la pantalla de orden pero vacía
            this.router.navigate(['/compras/nueva'], { 
                queryParams: { 
                    presentacionId: presentacion.id
                } 
            });
        }
    }

    async generarOrdenesConsolidadas() {
        const items = this.pedidosService.items();
        if (items.length === 0) return;

        const confirmed = await this.confirmService.ask({
            title: 'Generar Órdenes de Compra',
            message: `¿Desea crear borradores de órdenes de compra para los ${items.length} productos seleccionados?`,
            variant: 'primary',
            confirmText: 'Generar Borradores'
        });

        if (!confirmed) return;

        this.alertService.info('Agrupando por proveedor...');
        
        // Agrupar items por proveedorId
        const grupos = new Map<number | string, any[]>();
        items.forEach(item => {
            const key = item.proveedorId || 'sin-proveedor';
            if (!grupos.has(key)) grupos.set(key, []);
            grupos.get(key)?.push(item);
        });

        let creadas = 0;
        for (const [proveedorId, productos] of grupos.entries()) {
            if (proveedorId === 'sin-proveedor') continue;

            const orden: any = {
                proveedorId: proveedorId,
                fechaEmision: new Date().toISOString().split('T')[0],
                estado: EstadoOrdenCompra.BORRADOR,
                observaciones: 'Generada automáticamente desde Lista de Faltantes',
                detalles: productos.map(p => ({
                    presentacionId: p.presentacionId,
                    cantidad: p.cantidad,
                    precioUnitario: p.precioSugerido,
                    subtotal: p.cantidad * p.precioSugerido
                }))
            };

            await this.comprasService.crear(orden);
            creadas++;
        }

        this.alertService.success(`${creadas} Órdenes creadas en borrador. Revisa el módulo de Compras.`);
        this.pedidosService.limpiarTodo();
        this.showModalConsolidacion.set(false);
        this.router.navigate(['/compras']);
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
