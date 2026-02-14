import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InventarioService } from '../../services/inventario.service';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { AutocompleteComponent } from '../../../../shared/components/autocomplete/autocomplete.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TableComponent, TableColumn } from '../../../../shared/components/table/table.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { TipoMovimiento } from '../../../../core/models';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

interface LoteSeleccionado {
    id: number;
    productoNombre: string;
    presentacionNombre: string;
    lote: string;
    fechaVencimiento: string;
    stockActual: number;
    unidadBase: string;
}

@Component({
    selector: 'app-ajuste-stock',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        AutocompleteComponent,
        InputComponent,
        ButtonComponent,
        ModalComponent,
        TableComponent,
        SafeHtmlPipe,
        TooltipDirective
    ],
    templateUrl: './ajuste-stock.component.html',
    styles: []
})
export class AjusteStockComponent implements OnInit {
    private inventarioService = inject(InventarioService);
    private alertService = inject(AlertService);
    private fb = inject(FormBuilder);

    icons = APP_ICONS;
    loading = signal(false);
    loteSeleccionado = signal<LoteSeleccionado | null>(null);
    mostrarModalConfirmacion = signal(false);
    ajustePendiente = signal<{ tipo: TipoMovimiento.AJUSTE_POSITIVO | TipoMovimiento.AJUSTE_NEGATIVO; cantidad: number; motivo: string } | null>(null);
    lotesItems = signal<any[]>([]);
    buscandoLotes = signal(false);

    formAjuste: FormGroup = this.fb.group({
        lote: [null, Validators.required],
        tipoAjuste: ['positivo', Validators.required],
        cantidad: [0, [Validators.required, Validators.min(0.01)]],
        motivo: ['', [Validators.required, Validators.minLength(5)]]
    });

    historialMovimientos = signal<any[]>([]);
    loadingHistorial = signal(false);

    columns: TableColumn<any>[] = [
        {
            key: 'fechaMovimiento',
            label: 'Fecha',
            sortable: true,
            render: (row) => `<span class="text-xs text-gray-600">${new Date(row.fechaMovimiento).toLocaleString('es-EC')}</span>`
        },
        {
            key: 'tipo',
            label: 'Tipo',
            render: (row) => this.getTipoMovimientoBadge(row.tipo)
        },
        {
            key: 'cantidad',
            label: 'Cantidad',
            render: (row) => {
                const esEntrada = [TipoMovimiento.ENTRADA_COMPRA, TipoMovimiento.AJUSTE_POSITIVO, TipoMovimiento.DEVOLUCION].includes(row.tipo);
                return `<span class="font-black ${esEntrada ? 'text-emerald-600' : 'text-red-600'}">${esEntrada ? '+' : ''}${row.cantidad}</span>`;
            }
        },
        {
            key: 'observaciones',
            label: 'Motivo/Observaciones',
            render: (row) => `<span class="text-xs text-gray-700">${row.observaciones || 'Sin observaciones'}</span>`
        },
        {
            key: 'usuarioNombre',
            label: 'Usuario',
            render: (row) => `<span class="text-xs text-gray-500">${row.usuarioNombre || 'Sistema'}</span>`
        }
    ];

    ngOnInit() {
        // Cargar lotes iniciales (todos los que tienen stock)
        this.cargarLotes('');

        // Cargar historial si hay un lote seleccionado
        this.formAjuste.get('lote')?.valueChanges.subscribe(lote => {
            if (lote && typeof lote === 'object' && 'id' in lote) {
                const loteObj = lote as any;
                this.loteSeleccionado.set({
                    id: loteObj.id,
                    productoNombre: loteObj.productoNombre,
                    presentacionNombre: loteObj.presentacionNombre,
                    lote: loteObj.lote,
                    fechaVencimiento: loteObj.fechaVencimiento,
                    stockActual: loteObj.stockActual,
                    unidadBase: loteObj.unidadBase
                });
                this.cargarHistorial(loteObj.id);
            } else {
                this.loteSeleccionado.set(null);
                this.historialMovimientos.set([]);
            }
        });
    }

    async cargarLotes(termino: string = '') {
        this.buscandoLotes.set(true);
        try {
            // Si hay término, buscar; si no, cargar todos los lotes con stock
            const lotes = termino && termino.length >= 2 
                ? await this.inventarioService.buscarLotes(termino)
                : await this.inventarioService.buscarLotes('*'); // Buscar todos si no hay término
            
            const items = lotes.map(l => ({
                id: l.id,
                label: `${l.productoNombre} - ${l.presentacionNombre}`,
                sublabel: `Lote: ${l.lote} | Stock: ${l.stockActual} ${l.unidadBase} | Vence: ${new Date(l.fechaVencimiento).toLocaleDateString('es-EC')}`,
                ...l
            }));
            this.lotesItems.set(items);
        } catch (err: any) {
            this.alertService.error('Error buscando lotes: ' + err.message);
            this.lotesItems.set([]);
        } finally {
            this.buscandoLotes.set(false);
        }
    }

    onLoteSeleccionado(item: any) {
        if (item && item.id) {
            this.loteSeleccionado.set({
                id: item.id,
                productoNombre: item.productoNombre,
                presentacionNombre: item.presentacionNombre,
                lote: item.lote,
                fechaVencimiento: item.fechaVencimiento,
                stockActual: item.stockActual,
                unidadBase: item.unidadBase
            });
            this.cargarHistorial(item.id);
        }
    }

    async cargarHistorial(loteId: number) {
        this.loadingHistorial.set(true);
        try {
            const movimientos = await this.inventarioService.obtenerMovimientosLote(loteId);
            this.historialMovimientos.set(movimientos);
        } catch (err: any) {
            this.alertService.error('Error cargando historial: ' + err.message);
        } finally {
            this.loadingHistorial.set(false);
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

    stockDespuesAjuste = computed(() => {
        const lote = this.loteSeleccionado();
        const tipo = this.formAjuste.get('tipoAjuste')?.value;
        const cantidad = this.formAjuste.get('cantidad')?.value || 0;

        if (!lote) return null;

        if (tipo === 'positivo') {
            return lote.stockActual + cantidad;
        } else {
            return Math.max(0, lote.stockActual - cantidad);
        }
    });

    validarAjuste(): boolean {
        const lote = this.loteSeleccionado();
        const tipo = this.formAjuste.get('tipoAjuste')?.value;
        const cantidad = this.formAjuste.get('cantidad')?.value;

        if (!lote) {
            this.alertService.warning('Debe seleccionar un lote');
            return false;
        }

        if (tipo === 'negativo' && cantidad > lote.stockActual) {
            this.alertService.error(`No se puede descontar más de lo disponible. Stock actual: ${lote.stockActual}`);
            return false;
        }

        if (!this.formAjuste.valid) {
            this.alertService.warning('Complete todos los campos requeridos');
            return false;
        }

        return true;
    }

    prepararAjuste() {
        if (!this.validarAjuste()) return;

        const tipoAjuste = this.formAjuste.get('tipoAjuste')?.value === 'positivo' 
            ? TipoMovimiento.AJUSTE_POSITIVO 
            : TipoMovimiento.AJUSTE_NEGATIVO;
        const cantidad = this.formAjuste.get('cantidad')?.value;
        const motivo = this.formAjuste.get('motivo')?.value;

        this.ajustePendiente.set({ 
            tipo: tipoAjuste as TipoMovimiento.AJUSTE_POSITIVO | TipoMovimiento.AJUSTE_NEGATIVO, 
            cantidad, 
            motivo 
        });
        this.mostrarModalConfirmacion.set(true);
    }

    async confirmarAjuste() {
        const ajuste = this.ajustePendiente();
        const lote = this.loteSeleccionado();

        if (!ajuste || !lote) return;

        this.loading.set(true);
        try {
            await this.inventarioService.ajustarStock(
                lote.id,
                ajuste.cantidad,
                ajuste.tipo,
                ajuste.motivo
            );

            this.alertService.success('Ajuste de stock realizado correctamente');
            
            // Recargar datos
            const loteActualizado = await this.inventarioService.obtenerLotePorId(lote.id);
            this.loteSeleccionado.set({
                ...loteActualizado,
                productoNombre: loteActualizado.productoNombre,
                presentacionNombre: loteActualizado.presentacionNombre
            });
            
            await this.cargarHistorial(lote.id);
            
            // Limpiar formulario
            this.formAjuste.patchValue({
                cantidad: 0,
                motivo: ''
            });
            
            this.mostrarModalConfirmacion.set(false);
            this.ajustePendiente.set(null);
        } catch (err: any) {
            this.alertService.error('Error realizando ajuste: ' + err.message);
        } finally {
            this.loading.set(false);
        }
    }

    cancelarAjuste() {
        this.mostrarModalConfirmacion.set(false);
        this.ajustePendiente.set(null);
    }
}
