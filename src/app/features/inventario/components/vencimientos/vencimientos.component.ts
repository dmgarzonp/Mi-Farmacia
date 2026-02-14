import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventarioService } from '../../services/inventario.service';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { TableComponent, TableColumn } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { TipoMovimiento } from '../../../../core/models';
import { TableAction } from '../../../../shared/components/table/table.component';

interface LoteVencimiento {
    id: number;
    productoNombre: string;
    principioActivo?: string;
    presentacionNombre: string;
    lote: string;
    fechaVencimiento: string;
    stockActual: number;
    unidadBase: string;
    diasRestantes?: number;
    diasVencido?: number;
}

@Component({
    selector: 'app-vencimientos',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TableComponent,
        ButtonComponent,
        ModalComponent,
        SafeHtmlPipe
    ],
    templateUrl: './vencimientos.component.html',
    styles: []
})
export class VencimientosComponent implements OnInit {
    private inventarioService = inject(InventarioService);
    private alertService = inject(AlertService);
    private confirmService = inject(ConfirmService);

    icons = APP_ICONS;
    loading = signal(false);
    diasFiltro = signal(30);
    mostrarModalVencido = signal(false);
    mostrarModalDevolucion = signal(false);
    mostrarModalCorreo = signal(false);
    loteSeleccionado = signal<LoteVencimiento | null>(null);
    motivoVencimiento = signal('');
    motivoDevolucion = signal('');
    cantidadDevolver = signal<number>(0);
    proveedorInfo = signal<any>(null);
    plantillaCorreo = signal('');
    emailDestino = signal('');

    productosProximos = signal<LoteVencimiento[]>([]);
    productosVencidos = signal<LoteVencimiento[]>([]);
    activaTab = signal<'proximos' | 'vencidos'>('proximos');

    columnsProximos: TableColumn<LoteVencimiento>[] = [
        {
            key: 'productoNombre',
            label: 'Producto',
            sortable: true,
            render: (row) => `
                <div>
                    <span class="font-black text-gray-900">${row.productoNombre}</span>
                    ${row.principioActivo ? `<p class="text-[10px] text-gray-500 font-bold uppercase">${row.principioActivo}</p>` : ''}
                </div>
            `
        },
        {
            key: 'presentacionNombre',
            label: 'Presentación',
            render: (row) => `<span class="text-xs font-bold text-gray-600">${row.presentacionNombre}</span>`
        },
        {
            key: 'lote',
            label: 'Lote',
            sortable: true,
            render: (row) => `<span class="font-mono text-sm font-black text-slate-700">${row.lote}</span>`
        },
        {
            key: 'fechaVencimiento',
            label: 'Fecha Vencimiento',
            sortable: true,
            render: (row) => `<span class="text-sm font-bold text-gray-700">${new Date(row.fechaVencimiento).toLocaleDateString('es-EC')}</span>`
        },
        {
            key: 'diasRestantes',
            label: 'Días Restantes',
            sortable: true,
            render: (row) => this.getDiasRestantesBadge(row.diasRestantes || 0)
        },
        {
            key: 'stockActual',
            label: 'Stock',
            sortable: true,
            render: (row) => `<span class="font-black text-primary-700">${row.stockActual} ${row.unidadBase}</span>`
        },
    ];

    columnsVencidos: TableColumn<LoteVencimiento>[] = [
        {
            key: 'productoNombre',
            label: 'Producto',
            sortable: true,
            render: (row) => `
                <div>
                    <span class="font-black text-gray-900">${row.productoNombre}</span>
                    ${row.principioActivo ? `<p class="text-[10px] text-gray-500 font-bold uppercase">${row.principioActivo}</p>` : ''}
                </div>
            `
        },
        {
            key: 'presentacionNombre',
            label: 'Presentación',
            render: (row) => `<span class="text-xs font-bold text-gray-600">${row.presentacionNombre}</span>`
        },
        {
            key: 'lote',
            label: 'Lote',
            sortable: true,
            render: (row) => `<span class="font-mono text-sm font-black text-slate-700">${row.lote}</span>`
        },
        {
            key: 'fechaVencimiento',
            label: 'Fecha Vencimiento',
            sortable: true,
            render: (row) => `<span class="text-sm font-bold text-red-700">${new Date(row.fechaVencimiento).toLocaleDateString('es-EC')}</span>`
        },
        {
            key: 'diasVencido',
            label: 'Días Vencido',
            sortable: true,
            render: (row) => `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-black rounded-lg border border-red-200 uppercase">${row.diasVencido || 0} días</span>`
        },
        {
            key: 'stockActual',
            label: 'Stock',
            sortable: true,
            render: (row) => `<span class="font-black text-red-700">${row.stockActual} ${row.unidadBase}</span>`
        },
    ];

    totalProximos = computed(() => this.productosProximos().length);
    totalVencidos = computed(() => this.productosVencidos().length);
    stockTotalProximos = computed(() => 
        this.productosProximos().reduce((sum, p) => sum + p.stockActual, 0)
    );
    stockTotalVencidos = computed(() => 
        this.productosVencidos().reduce((sum, p) => sum + p.stockActual, 0)
    );

    ngOnInit() {
        this.cargarDatos();
    }

    async cargarDatos() {
        this.loading.set(true);
        try {
            const [proximos, vencidos] = await Promise.all([
                this.inventarioService.obtenerProductosProximosAVencer(this.diasFiltro()),
                this.inventarioService.obtenerProductosVencidos()
            ]);

            this.productosProximos.set(proximos as LoteVencimiento[]);
            this.productosVencidos.set(vencidos as LoteVencimiento[]);
        } catch (err: any) {
            this.alertService.error('Error cargando datos: ' + err.message);
        } finally {
            this.loading.set(false);
        }
    }

    async cambiarDiasFiltro() {
        await this.cargarDatos();
    }

    onDiasFiltroChange(value: number | string) {
        this.diasFiltro.set(Number(value));
        this.cambiarDiasFiltro();
    }

    getDiasRestantesBadge(dias: number): string {
        if (dias < 0) {
            return `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-black rounded-lg border border-red-200 uppercase">Vencido</span>`;
        } else if (dias <= 7) {
            return `<span class="px-2 py-1 bg-red-50 text-red-600 text-xs font-black rounded-lg border border-red-200 uppercase">${dias} días</span>`;
        } else if (dias <= 15) {
            return `<span class="px-2 py-1 bg-amber-50 text-amber-600 text-xs font-black rounded-lg border border-amber-200 uppercase">${dias} días</span>`;
        } else {
            return `<span class="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-black rounded-lg border border-blue-200 uppercase">${dias} días</span>`;
        }
    }

    async prepararMarcarVencido(lote: LoteVencimiento) {
        const confirmado = await this.confirmService.ask({
            title: 'Marcar Lote como Vencido',
            message: `¿Está seguro de marcar este lote como vencido? Se ajustará el stock a 0.\n\nProducto: ${lote.productoNombre}\nLote: ${lote.lote}\nStock Actual: ${lote.stockActual} ${lote.unidadBase}`,
            confirmText: 'Marcar Vencido',
            cancelText: 'Cancelar',
            variant: 'warning'
        });

        if (confirmado) {
            this.loteSeleccionado.set(lote);
            this.motivoVencimiento.set('');
            this.mostrarModalVencido.set(true);
        }
    }

    async confirmarMarcarVencido() {
        const lote = this.loteSeleccionado();
        const motivo = this.motivoVencimiento().trim();

        if (!lote) return;

        if (!motivo || motivo.length < 5) {
            this.alertService.warning('Debe ingresar un motivo de al menos 5 caracteres');
            return;
        }

        this.loading.set(true);
        try {
            await this.inventarioService.marcarVencido(lote.id, motivo);
            this.alertService.success('Lote marcado como vencido correctamente');
            this.mostrarModalVencido.set(false);
            this.loteSeleccionado.set(null);
            this.motivoVencimiento.set('');
            await this.cargarDatos();
        } catch (err: any) {
            this.alertService.error('Error marcando lote como vencido: ' + err.message);
        } finally {
            this.loading.set(false);
        }
    }

    cancelarMarcarVencido() {
        this.mostrarModalVencido.set(false);
        this.loteSeleccionado.set(null);
        this.motivoVencimiento.set('');
    }

    cambiarTab(tab: 'proximos' | 'vencidos') {
        this.activaTab.set(tab);
    }

    getActionsProximos(): TableAction<LoteVencimiento>[] {
        return [
            {
                label: 'Devolver al Proveedor',
                iconName: 'TRUCK',
                variant: 'warning',
                handler: (row) => this.prepararDevolucion(row)
            },
            {
                label: 'Enviar Correo',
                iconName: 'UPLOAD',
                variant: 'primary',
                handler: (row) => this.prepararEnvioCorreo(row)
            },
            {
                label: 'Marcar Vencido',
                iconName: 'ERROR',
                variant: 'danger',
                handler: (row) => this.prepararMarcarVencido(row)
            }
        ];
    }

    getActionsVencidos(): TableAction<LoteVencimiento>[] {
        return [
            {
                label: 'Marcar Vencido',
                iconName: 'ERROR',
                variant: 'danger',
                handler: (row) => this.prepararMarcarVencido(row)
            }
        ];
    }

    async prepararDevolucion(lote: LoteVencimiento) {
        this.loteSeleccionado.set(lote);
        this.cantidadDevolver.set(lote.stockActual);
        this.motivoDevolucion.set('Devolución al proveedor por proximidad a vencimiento');
        
        // Obtener información del proveedor
        this.loading.set(true);
        try {
            const proveedor = await this.inventarioService.obtenerProveedorDelLote(lote.id);
            this.proveedorInfo.set(proveedor);
            
            if (!proveedor) {
                this.alertService.warning('No se encontró información del proveedor para este lote. Puede continuar con la devolución manualmente.');
            }
        } catch (err: any) {
            this.alertService.error('Error obteniendo información del proveedor: ' + err.message);
        } finally {
            this.loading.set(false);
        }
        
        this.mostrarModalDevolucion.set(true);
    }

    async confirmarDevolucion() {
        const lote = this.loteSeleccionado();
        const cantidad = this.cantidadDevolver();
        const motivo = this.motivoDevolucion().trim();

        if (!lote) return;

        if (!motivo || motivo.length < 5) {
            this.alertService.warning('Debe ingresar un motivo de al menos 5 caracteres');
            return;
        }

        if (cantidad <= 0 || cantidad > lote.stockActual) {
            this.alertService.error(`La cantidad debe estar entre 1 y ${lote.stockActual}`);
            return;
        }

        const confirmado = await this.confirmService.ask({
            title: 'Confirmar Devolución al Proveedor',
            message: `¿Está seguro de devolver ${cantidad} ${lote.unidadBase} de este lote al proveedor?\n\nProducto: ${lote.productoNombre}\nLote: ${lote.lote}\nStock Actual: ${lote.stockActual} ${lote.unidadBase}`,
            confirmText: 'Confirmar Devolución',
            variant: 'warning'
        });

        if (!confirmado) return;

        this.loading.set(true);
        try {
            const proveedor = this.proveedorInfo();
            await this.inventarioService.devolverAlProveedor(
                lote.id,
                cantidad,
                motivo,
                proveedor?.ordenCompraId
            );

            this.alertService.success('Devolución registrada correctamente');
            this.mostrarModalDevolucion.set(false);
            this.loteSeleccionado.set(null);
            this.motivoDevolucion.set('');
            this.cantidadDevolver.set(0);
            this.proveedorInfo.set(null);
            await this.cargarDatos();
        } catch (err: any) {
            this.alertService.error('Error registrando devolución: ' + err.message);
        } finally {
            this.loading.set(false);
        }
    }

    cancelarDevolucion() {
        this.mostrarModalDevolucion.set(false);
        this.loteSeleccionado.set(null);
        this.motivoDevolucion.set('');
        this.cantidadDevolver.set(0);
        this.proveedorInfo.set(null);
    }

    async prepararEnvioCorreo(lote: LoteVencimiento) {
        this.loteSeleccionado.set(lote);
        this.cantidadDevolver.set(lote.stockActual);
        
        // Obtener información del proveedor
        this.loading.set(true);
        try {
            const proveedor = await this.inventarioService.obtenerProveedorDelLote(lote.id);
            this.proveedorInfo.set(proveedor);
            
            if (!proveedor) {
                this.alertService.error('No se encontró información del proveedor para este lote. No se puede generar el correo.');
                return;
            }

            // Generar plantilla de correo
            const plantilla = this.inventarioService.generarPlantillaCorreoDevolucion(
                { ...lote, diasRestantes: lote.diasRestantes },
                proveedor,
                this.cantidadDevolver()
            );
            this.plantillaCorreo.set(plantilla);
            
            // Establecer email destino
            this.emailDestino.set(proveedor.emailContacto || proveedor.proveedorEmail || '');
            
            this.mostrarModalCorreo.set(true);
        } catch (err: any) {
            this.alertService.error('Error obteniendo información del proveedor: ' + err.message);
        } finally {
            this.loading.set(false);
        }
    }

    async enviarCorreo() {
        const email = this.emailDestino().trim();
        const asunto = `Solicitud de Devolución - Producto Próximo a Vencer`;
        const cuerpo = this.plantillaCorreo();

        if (!email) {
            this.alertService.error('Debe especificar un correo electrónico de destino');
            return;
        }

        // Usar mailto: para abrir el cliente de correo predeterminado
        const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
        window.location.href = mailtoLink;

        this.alertService.success('Se abrió su cliente de correo. Revise el mensaje antes de enviar.');
        this.mostrarModalCorreo.set(false);
    }

    copiarPlantilla() {
        const texto = this.plantillaCorreo();
        navigator.clipboard.writeText(texto).then(() => {
            this.alertService.success('Plantilla copiada al portapapeles');
        }).catch(() => {
            this.alertService.error('Error al copiar al portapapeles');
        });
    }

    cancelarCorreo() {
        this.mostrarModalCorreo.set(false);
        this.loteSeleccionado.set(null);
        this.plantillaCorreo.set('');
        this.emailDestino.set('');
        this.proveedorInfo.set(null);
    }
}
