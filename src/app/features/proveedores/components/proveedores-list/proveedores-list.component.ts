import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProveedoresService } from '../../services/proveedores.service';
import { TableComponent, TableColumn, TableAction } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ProveedorFormComponent } from '../proveedor-form/proveedor-form.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { PersistenceService } from '../../../../shared/services/persistence.service';
import { ExportService } from '../../../../shared/services/export.service';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { Proveedor, EstadoRegistro } from '../../../../core/models';

/**
 * Listado de Proveedores
 * Gestión de socios comerciales para abastecimiento
 */
@Component({
    selector: 'app-proveedores-list',
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
        ProveedorFormComponent
    ],
    templateUrl: './proveedores-list.component.html'
})
export class ProveedoresListComponent implements OnInit {
    proveedoresService = inject(ProveedoresService);
    private router = inject(Router);
    private alertService = inject(AlertService);
    private confirmService = inject(ConfirmService);
    private persistenceService = inject(PersistenceService);
    private exportService = inject(ExportService);

    icons = APP_ICONS;
    searchTerm = signal('');
    statusFilter = signal<string>(EstadoRegistro.ACTIVO);

    // KPIs calculados
    stats = computed(() => {
        const list = this.proveedoresService.proveedores();
        return {
            total: list.length,
            conRuc: list.filter(p => !!p.ruc).length,
            sinContacto: list.filter(p => !p.nombreContacto).length
        };
    });

    // Cabeceras para exportación/importación
    private readonly EXPORT_COLUMNS = ['ID', 'Nombre Empresa', 'RUC', 'Dirección', 'Teléfono Empresa', 'Email Empresa', 'Contacto', 'Cargo Contacto', 'Teléfono Contacto', 'Email Contacto'];
    private readonly IMPORT_MAPPING: Record<string, keyof Proveedor> = {
        'Nombre Empresa': 'nombreEmpresa',
        'RUC': 'ruc',
        'Dirección': 'direccion',
        'Teléfono Empresa': 'telefonoEmpresa',
        'Email Empresa': 'emailEmpresa',
        'Contacto': 'nombreContacto',
        'Cargo Contacto': 'cargoContacto',
        'Teléfono Contacto': 'telefonoContacto',
        'Email Contacto': 'emailContacto'
    };

    columns: TableColumn<Proveedor>[] = [
// ... (mantenemos las columnas iguales) ...
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
        }
    ];

    actions: TableAction<Proveedor>[] = [
        {
            label: 'Ver Ficha',
            iconName: 'VIEW',
            variant: 'secondary',
            handler: (proveedor) => this.verDetalle(proveedor)
        },
        {
            label: 'Editar',
            iconName: 'EDIT',
            variant: 'secondary',
            handler: (proveedor) => this.editar(proveedor)
        },
        {
            label: 'Dar de Baja',
            iconName: 'DELETE',
            variant: 'danger',
            visible: (p) => p.estado === EstadoRegistro.ACTIVO,
            handler: (proveedor) => this.darDeBaja(proveedor)
        },
        {
            label: 'Reactivar',
            iconName: 'CHECK',
            variant: 'primary',
            visible: (p) => p.estado === EstadoRegistro.INACTIVO,
            handler: (proveedor) => this.reactivar(proveedor)
        }
    ];

    // ... (rest of computed and methods) ...

    selectedProveedor = signal<Proveedor | null>(null);
    showModalDetalle = signal(false);
    showModalEdicion = signal(false);
    idProveedorEdicion = signal<number | null>(null);

    verDetalle(proveedor: Proveedor): void {
        this.selectedProveedor.set(proveedor);
        this.showModalDetalle.set(true);
    }

    cerrarDetalle(): void {
        this.showModalDetalle.set(false);
        setTimeout(() => this.selectedProveedor.set(null), 300);
    }

    filteredProveedores = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const status = this.statusFilter();
        let all = this.proveedoresService.proveedores();
        
        // Filtro por estado
        all = all.filter(p => p.estado === status);

        if (!term) return all;
        return all.filter(p => 
            p.nombreEmpresa.toLowerCase().includes(term) || 
            (p.ruc && p.ruc.toLowerCase().includes(term)) ||
            (p.nombreContacto && p.nombreContacto.toLowerCase().includes(term))
        );
    });

    async ngOnInit() {
        const savedSearch = this.persistenceService.get<string>('proveedores-search');
        if (savedSearch) this.searchTerm.set(savedSearch);
        
        const savedStatus = this.persistenceService.get<string>('proveedores-status');
        if (savedStatus) this.statusFilter.set(savedStatus);

        await this.proveedoresService.cargarProveedores();
    }

    onSearchChange(term: string): void {
        this.searchTerm.set(term);
        this.persistenceService.set('proveedores-search', term);
    }

    async onStatusFilterChange(status: string) {
        this.statusFilter.set(status);
        this.persistenceService.set('proveedores-status', status);
    }

    crearNuevo(): void {
        this.idProveedorEdicion.set(null);
        this.showModalEdicion.set(true);
    }

    editar(proveedor: Proveedor): void {
        this.idProveedorEdicion.set(proveedor.id!);
        this.showModalEdicion.set(true);
    }

    async onProveedorSaved() {
        this.showModalEdicion.set(false);
        await this.proveedoresService.cargarProveedores();
    }

    async darDeBaja(proveedor: Proveedor): Promise<void> {
        const confirmed = await this.confirmService.ask({
            title: 'Dar de Baja Proveedor',
            message: `¿Está seguro de desactivar a "${proveedor.nombreEmpresa}"? No se podrá usar en nuevas órdenes de compra.`,
            variant: 'danger',
            confirmText: 'Desactivar'
        });

        if (confirmed) {
            try {
                await this.proveedoresService.cambiarEstado(proveedor.id!, EstadoRegistro.INACTIVO);
                this.alertService.success('Proveedor desactivado correctamente');
            } catch (error: any) {
                this.alertService.error('Error al desactivar: ' + error.message);
            }
        }
    }

    async reactivar(proveedor: Proveedor): Promise<void> {
        const confirmed = await this.confirmService.ask({
            title: 'Reactivar Proveedor',
            message: `¿Está seguro de reactivar a "${proveedor.nombreEmpresa}"? Volverá a estar disponible para órdenes de compra.`,
            variant: 'primary',
            confirmText: 'Reactivar'
        });

        if (confirmed) {
            try {
                await this.proveedoresService.cambiarEstado(proveedor.id!, EstadoRegistro.ACTIVO);
                this.alertService.success('Proveedor reactivado correctamente');
            } catch (error: any) {
                this.alertService.error('Error al reactivar: ' + error.message);
            }
        }
    }

    async eliminar(proveedor: Proveedor): Promise<void> {
        // Redirigimos a darDeBaja para mantener consistencia
        return this.darDeBaja(proveedor);
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
                title: 'Importar Proveedores',
                message: `Se han encontrado ${rawData.length} registros. ¿Desea procesarlos e integrarlos a la base de datos?`,
                variant: 'primary',
                confirmText: 'Iniciar Importación'
            });

            if (!confirmed) return;

            let exitosos = 0;
            let errores = 0;

            for (const row of rawData) {
                try {
                    const proveedor: Partial<Proveedor> = {};
                    // Mapeo dinámico basado en las cabeceras definidas
                    Object.entries(this.IMPORT_MAPPING).forEach(([excelKey, modelKey]) => {
                        if (row[excelKey] !== undefined) {
                            (proveedor as any)[modelKey] = row[excelKey];
                        }
                    });

                    if (proveedor.nombreEmpresa) {
                        await this.proveedoresService.crear(proveedor);
                        exitosos++;
                    }
                } catch (e) {
                    errores++;
                }
            }

            this.alertService.success(`Importación finalizada: ${exitosos} exitosos, ${errores} errores.`);
            await this.proveedoresService.cargarProveedores();
        } catch (error: any) {
            this.alertService.error('Error durante la importación: ' + error.message);
        }
    }

    exportToExcel() {
        const data = this.filteredProveedores().map(p => ({
            'ID': p.id,
            'Nombre Empresa': p.nombreEmpresa,
            'RUC': p.ruc,
            'Dirección': p.direccion,
            'Teléfono Empresa': p.telefonoEmpresa,
            'Email Empresa': p.emailEmpresa,
            'Contacto': p.nombreContacto,
            'Cargo Contacto': p.cargoContacto,
            'Teléfono Contacto': p.telefonoContacto,
            'Email Contacto': p.emailContacto
        }));
        this.exportService.exportToExcel(data, 'Proveedores_MiFarmacia');
    }

    exportToPdf() {
        const data = this.filteredProveedores().map(p => [
            p.id?.toString() || '-',
            p.nombreEmpresa,
            p.ruc || '-',
            p.telefonoEmpresa || '-',
            p.nombreContacto || 'No asignado'
        ]);
        
        const columns = ['ID', 'Empresa', 'RUC', 'Teléfono', 'Contacto Principal'];
        this.exportService.exportToPdf('Reporte Maestro de Proveedores', columns, data, 'Proveedores_Reporte');
    }

    onDownloadTemplate() {
        const headers = Object.keys(this.IMPORT_MAPPING);
        this.exportService.downloadTemplate(headers, 'Plantilla_Proveedores');
    }
}
