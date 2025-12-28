import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ComprasService } from '../../services/compras.service';
import { TableComponent, TableColumn, TableAction } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { PersistenceService } from '../../../../shared/services/persistence.service';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { FilterPipe } from '../../../../shared/pipes/filter.pipe';
import { OrdenCompra, EstadoOrdenCompra } from '../../../../core/models';

/**
 * Listado de Órdenes de Compra
 * Adaptado al nuevo esquema de estados y trazabilidad
 */
@Component({
    selector: 'app-ordenes-list',
    standalone: true,
    imports: [CommonModule, FormsModule, TableComponent, ButtonComponent, SafeHtmlPipe, FilterPipe],
    templateUrl: './ordenes-list.component.html',
    styles: []
})
export class OrdenesListComponent implements OnInit {
    comprasService = inject(ComprasService);
    private router = inject(Router);
    private alertService = inject(AlertService);
    private confirmService = inject(ConfirmService);
    private persistenceService = inject(PersistenceService);

    icons = APP_ICONS;
    searchTerm = '';
    EstadoOrdenCompra = EstadoOrdenCompra;

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
            render: (row) => `<span class="font-black text-primary-700">${row.moneda} ${row.total.toFixed(2)}</span>`
        },
        {
            key: 'estado',
            label: 'Estado',
            render: (row) => this.getEstadoBadge(row.estado)
        }
    ];

    actions: TableAction<OrdenCompra>[] = [
        {
            label: 'Ver/Editar',
            iconName: 'VIEW',
            variant: 'primary',
            handler: (orden) => this.editar(orden),
            visible: (orden) => orden.estado === EstadoOrdenCompra.PENDIENTE || orden.estado === EstadoOrdenCompra.APROBADA
        },
        {
            label: 'Recibir Mercancía',
            iconName: 'SAVE',
            variant: 'success',
            handler: (orden) => this.recibirMercancia(orden),
            visible: (orden) => orden.estado === EstadoOrdenCompra.APROBADA || orden.estado === EstadoOrdenCompra.PENDIENTE
        },
        {
            label: 'Cancelar',
            iconName: 'CANCEL',
            variant: 'danger',
            handler: (orden) => this.cancelar(orden),
            visible: (orden) => orden.estado === EstadoOrdenCompra.PENDIENTE || orden.estado === EstadoOrdenCompra.APROBADA
        },
        {
            label: 'Eliminar',
            iconName: 'DELETE',
            variant: 'danger',
            handler: (orden) => this.eliminar(orden),
            visible: (orden) => orden.estado === EstadoOrdenCompra.CANCELADA
        }
    ];

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
        const confirmed = await this.confirmService.ask({
            title: 'Recibir Mercancía',
            message: `¿Desea ingresar los productos de la orden #${orden.id} al inventario real? Esto creará los lotes correspondientes y actualizará el stock.`,
            variant: 'primary',
            confirmText: 'Ingresar a Almacén'
        });

        if (confirmed) {
            try {
                await this.comprasService.marcarComoRecibida(orden.id!);
                this.alertService.success('Mercancía ingresada al inventario correctamente');
            } catch (error: any) {
                this.alertService.error('Error al recibir: ' + error.message);
            }
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
