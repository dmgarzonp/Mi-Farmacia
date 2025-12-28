import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProveedoresService } from '../../services/proveedores.service';
import { TableComponent, TableColumn, TableAction } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { PersistenceService } from '../../../../shared/services/persistence.service';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { Proveedor } from '../../../../core/models';

/**
 * Listado de Proveedores
 * Gestión de socios comerciales para abastecimiento
 */
@Component({
    selector: 'app-proveedores-list',
    standalone: true,
    imports: [CommonModule, FormsModule, TableComponent, ButtonComponent, SafeHtmlPipe, SkeletonComponent],
    templateUrl: './proveedores-list.component.html'
})
export class ProveedoresListComponent implements OnInit {
    proveedoresService = inject(ProveedoresService);
    private router = inject(Router);
    private alertService = inject(AlertService);
    private confirmService = inject(ConfirmService);
    private persistenceService = inject(PersistenceService);

    icons = APP_ICONS;
    searchTerm = signal('');

    // KPIs calculados
    stats = computed(() => {
        const list = this.proveedoresService.proveedores();
        return {
            total: list.length,
            conRuc: list.filter(p => !!p.ruc).length,
            sinContacto: list.filter(p => !p.nombreContacto).length
        };
    });

    columns: TableColumn<Proveedor>[] = [
        {
            key: 'id',
            label: 'ID',
            width: '80px'
        },
        {
            key: 'nombreEmpresa',
            label: 'Razón Social',
            sortable: true,
            render: (row) => `<div class="flex flex-col">
                <span class="font-bold text-gray-800">${row.nombreEmpresa}</span>
                <span class="text-[10px] text-gray-400 font-mono uppercase tracking-wider">${row.ruc || 'SIN RUC'}</span>
            </div>`
        },
        {
            key: 'nombreContacto',
            label: 'Contacto',
            render: (row) => row.nombreContacto ? `
                <div class="flex flex-col">
                    <span class="text-xs font-semibold">${row.nombreContacto}</span>
                    <span class="text-[10px] text-primary-500 uppercase">${row.cargoContacto || 'Contacto'}</span>
                </div>
            ` : '<span class="text-gray-400 text-xs italic">No asignado</span>'
        },
        {
            key: 'telefonoEmpresa',
            label: 'Teléfonos',
            render: (row) => `
                <div class="flex flex-col gap-0.5">
                    <span class="text-xs">🏢 ${row.telefonoEmpresa || '-'}</span>
                    <span class="text-xs">👤 ${row.telefonoContacto || '-'}</span>
                </div>
            `
        },
        {
            key: 'emailEmpresa',
            label: 'Correos',
            render: (row) => `
                <div class="flex flex-col gap-0.5">
                    <span class="text-[11px] text-gray-600">${row.emailEmpresa || '-'}</span>
                    <span class="text-[11px] text-gray-400 italic">${row.emailContacto || ''}</span>
                </div>
            `
        }
    ];

    actions: TableAction<Proveedor>[] = [
        {
            label: 'Editar',
            iconName: 'EDIT',
            variant: 'secondary',
            handler: (proveedor) => this.editar(proveedor)
        },
        {
            label: 'Eliminar',
            iconName: 'DELETE',
            variant: 'danger',
            handler: (proveedor) => this.eliminar(proveedor)
        }
    ];

    filteredProveedores = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const all = this.proveedoresService.proveedores();
        if (!term) return all;
        return all.filter(p => 
            p.nombreEmpresa.toLowerCase().includes(term) || 
            (p.ruc && p.ruc.toLowerCase().includes(term)) ||
            (p.nombreContacto && p.nombreContacto.toLowerCase().includes(term))
        );
    });

    async ngOnInit() {
        const saved = this.persistenceService.get<string>('proveedores-search');
        if (saved) this.searchTerm.set(saved);
        await this.proveedoresService.cargarProveedores();
    }

    onSearchChange(term: string): void {
        this.searchTerm.set(term);
        this.persistenceService.set('proveedores-search', term);
    }

    crearNuevo(): void {
        this.router.navigate(['/proveedores/nuevo']);
    }

    editar(proveedor: Proveedor): void {
        this.router.navigate(['/proveedores', proveedor.id, 'editar']);
    }

    async eliminar(proveedor: Proveedor): Promise<void> {
        const confirmed = await this.confirmService.ask({
            title: 'Eliminar Proveedor',
            message: `¿Está seguro de eliminar a "${proveedor.nombreEmpresa}"? No se podrá usar en nuevas órdenes.`,
            variant: 'danger',
            confirmText: 'Dar de Baja'
        });

        if (confirmed) {
            try {
                await this.proveedoresService.eliminar(proveedor.id!);
                this.alertService.success('Proveedor dado de baja correctamente');
            } catch (error: any) {
                this.alertService.error('Error al eliminar: ' + error.message);
            }
        }
    }
}
