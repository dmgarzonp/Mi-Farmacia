import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ComprasService } from '../../services/compras.service';
import { TableComponent, TableColumn, TableAction } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { PersistenceService } from '../../../../shared/services/persistence.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { RecepcionFormComponent } from '../recepcion-form/recepcion-form.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { FilterPipe } from '../../../../shared/pipes/filter.pipe';
import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';
import { OrdenCompra, EstadoOrdenCompra, DetalleOrdenCompra } from '../../../../core/models';

/**
 * Listado de Órdenes de Compra
 * Adaptado al nuevo esquema de estados y trazabilidad
 */
@Component({
    selector: 'app-ordenes-list',
    standalone: true,
    imports: [
        CommonModule, 
        FormsModule, 
        TableComponent, 
        ButtonComponent, 
        SafeHtmlPipe, 
        FilterPipe, 
        ModalComponent, 
        RecepcionFormComponent,
        CurrencyFormatPipe
    ],
    providers: [CurrencyFormatPipe],
    templateUrl: './ordenes-list.component.html',
    styles: []
})
export class OrdenesListComponent implements OnInit {
    comprasService = inject(ComprasService);
    private router = inject(Router);
    private alertService = inject(AlertService);
    private confirmService = inject(ConfirmService);
    private persistenceService = inject(PersistenceService);
    private currencyPipe = inject(CurrencyFormatPipe);

    icons = APP_ICONS;
    searchTerm = '';
    EstadoOrdenCompra = EstadoOrdenCompra;

    // Control de Modal de Recepción
    showModalRecepcion = signal(false);
    selectedOrden = signal<OrdenCompra | null>(null);
    procesandoRecepcion = signal(false);

    // Totales calculados para KPIs
    stats = computed(() => {
        const ordenes = this.comprasService.ordenes();
        return {
            total: ordenes.length,
            borradores: ordenes.filter(o => o.estado === EstadoOrdenCompra.BORRADOR).length,
            pendientes: ordenes.filter(o => o.estado === EstadoOrdenCompra.PENDIENTE).length,
            recibidas: ordenes.filter(o => o.estado === EstadoOrdenCompra.RECIBIDA).length,
            inversionTotal: ordenes.reduce((acc, o) => acc + (o.total || 0), 0)
        };
    });

    columns: TableColumn<OrdenCompra>[] = [
        {
            key: 'id',
            label: 'Nº Orden',
            width: '100px',
            render: (row) => `<span class="font-black text-gray-700">#${row.id}</span>`
        },
        {
            key: 'fechaEmision',
            label: 'Emisión',
            sortable: true
        },
        {
            key: 'proveedorNombre',
            label: 'Proveedor',
            sortable: true
        },
        {
            key: 'total',
            label: 'Total',
            sortable: true,
            render: (row) => `<span class="font-black text-primary-700">${this.currencyPipe.transform(row.total)}</span>`
        },
        {
            key: 'estado',
            label: 'Estado',
            render: (row) => this.getEstadoBadge(row.estado)
        }
    ];

    actions: TableAction<OrdenCompra>[] = [
        {
            label: 'Editar',
            iconName: 'EDIT',
            variant: 'primary',
            handler: (orden) => this.editar(orden),
            visible: (orden) => orden.estado === EstadoOrdenCompra.BORRADOR
        },
        {
            label: 'Ver Pedido',
            iconName: 'VIEW',
            variant: 'primary',
            handler: (orden) => this.editar(orden),
            visible: (orden) => orden.estado !== EstadoOrdenCompra.BORRADOR
        },
        {
            label: 'Aprobar Orden',
            iconName: 'CHECK',
            variant: 'success',
            handler: (orden) => this.aprobar(orden),
            visible: (orden) => orden.estado === EstadoOrdenCompra.PENDIENTE
        },
        {
            label: 'Recibir Mercancía',
            iconName: 'SAVE',
            variant: 'success',
            handler: (orden) => this.recibirMercancia(orden),
            visible: (orden) => orden.estado === EstadoOrdenCompra.APROBADA || (orden.estado === EstadoOrdenCompra.PENDIENTE && !this.requiereAprobacion) 
        },
        {
            label: 'Cancelar',
            iconName: 'CANCEL',
            variant: 'danger',
            handler: (orden) => this.cancelar(orden),
            visible: (orden) => orden.estado === EstadoOrdenCompra.PENDIENTE || orden.estado === EstadoOrdenCompra.APROBADA || orden.estado === EstadoOrdenCompra.BORRADOR
        },
        {
            label: 'Eliminar',
            iconName: 'DELETE',
            variant: 'danger',
            handler: (orden) => this.eliminar(orden),
            visible: (orden) => orden.estado === EstadoOrdenCompra.CANCELADA || orden.estado === EstadoOrdenCompra.BORRADOR
        }
    ];

    // Simular configuración de sistema (esto irá al módulo de config después)
    requiereAprobacion = true;

    async aprobar(orden: OrdenCompra) {
        const confirmed = await this.confirmService.ask({
            title: 'Aprobar Orden',
            message: `¿Desea aprobar la orden de compra #${orden.id}? Una vez aprobada podrá recibir la mercancía.`,
            variant: 'primary',
            confirmText: 'Aprobar Ahora'
        });

        if (confirmed) {
            try {
                await this.comprasService.cambiarEstado(orden.id!, EstadoOrdenCompra.APROBADA);
                this.alertService.success('Orden aprobada correctamente');
            } catch (error: any) {
                this.alertService.error('Error al aprobar: ' + error.message);
            }
        }
    }

    async ngOnInit() {
        const savedSearch = this.persistenceService.get<string>('compras-search');
        if (savedSearch) this.searchTerm = savedSearch;
        
        await this.comprasService.cargarOrdenes();
    }

    onSearchChange(value: string) {
        this.persistenceService.set('compras-search', value);
    }

    getEstadoBadge(estado: EstadoOrdenCompra): string {
        const configs: Record<EstadoOrdenCompra, string> = {
            [EstadoOrdenCompra.BORRADOR]: 'bg-slate-100 text-slate-600 border-slate-200',
            [EstadoOrdenCompra.PENDIENTE]: 'bg-amber-100 text-amber-700 border-amber-200',
            [EstadoOrdenCompra.APROBADA]: 'bg-blue-100 text-blue-700 border-blue-200',
            [EstadoOrdenCompra.RECIBIDA]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            [EstadoOrdenCompra.CANCELADA]: 'bg-gray-100 text-gray-700 border-gray-200'
        };
        const colorClass = configs[estado] || configs[EstadoOrdenCompra.PENDIENTE];
        return `<span class="px-2 py-1 ${colorClass} text-[10px] font-black rounded-lg border uppercase">${estado}</span>`;
    }

    crearNueva(): void {
        this.router.navigate(['/compras/nueva']);
    }

    editar(orden: OrdenCompra): void {
        this.router.navigate(['/compras', orden.id]);
    }

    async recibirMercancia(orden: OrdenCompra) {
        // Obtenemos la orden completa con sus detalles para el modal
        try {
            const ordenCompleta = await this.comprasService.obtenerPorId(orden.id!);
            if (ordenCompleta) {
                this.selectedOrden.set(ordenCompleta);
                this.showModalRecepcion.set(true);
            }
        } catch (error: any) {
            this.alertService.error('Error al cargar detalles: ' + error.message);
        }
    }

    async confirmarRecepcion(event: {detalles: DetalleOrdenCompra[], total: number}) {
        const orden = this.selectedOrden();
        if (!orden) return;

        this.procesandoRecepcion.set(true);
        try {
            await this.comprasService.marcarComoRecibida(orden.id!, event.detalles, event.total);
            this.alertService.success('Mercancía ingresada al inventario correctamente');
            this.showModalRecepcion.set(false);
            this.selectedOrden.set(null);
        } catch (error: any) {
            this.alertService.error('Error en la recepción: ' + error.message);
        } finally {
            this.procesandoRecepcion.set(false);
        }
    }

    async cancelar(orden: OrdenCompra) {
        const confirmed = await this.confirmService.ask({
            title: 'Cancelar Orden',
            message: `¿Está seguro de cancelar la orden #${orden.id}?`,
            variant: 'danger',
            confirmText: 'Cancelar Orden'
        });

        if (confirmed) {
            try {
                await this.comprasService.cambiarEstado(orden.id!, EstadoOrdenCompra.CANCELADA, 'Cancelada por el usuario');
                this.alertService.success('Orden cancelada');
            } catch (error: any) {
                this.alertService.error('Error al cancelar: ' + error.message);
            }
        }
    }

    async eliminar(orden: OrdenCompra) {
        const confirmed = await this.confirmService.ask({
            title: 'Eliminar Registro',
            message: `¿Desea eliminar permanentemente el registro de la orden #${orden.id}?`,
            variant: 'danger',
            confirmText: 'Eliminar'
        });

        if (confirmed) {
            try {
                await this.comprasService.eliminar(orden.id!);
                this.alertService.success('Registro eliminado');
            } catch (error: any) {
                this.alertService.error('Error al eliminar: ' + error.message);
            }
        }
    }
}
