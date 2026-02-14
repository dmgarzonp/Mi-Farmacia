import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ComprasService } from '../../services/compras.service';
import { ProveedoresService } from '../../../proveedores/services/proveedores.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';
import { OrdenCompra } from '../../../../core/models';
import { PagoCompra } from '../../../../core/models';

type OrdenConSaldo = OrdenCompra & { diasRestantes?: number; diasVencido?: number };

@Component({
    selector: 'app-saldos-credito',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        ButtonComponent,
        ModalComponent,
        InputComponent,
        DatePickerComponent,
        SafeHtmlPipe,
        CurrencyFormatPipe
    ],
    templateUrl: './saldos-credito.component.html',
    styles: []
})
export class SaldosCreditoComponent implements OnInit {
    private comprasService = inject(ComprasService);
    private fb = inject(FormBuilder);
    private alertService = inject(AlertService);
    proveedoresService = inject(ProveedoresService);
    router = inject(Router);

    icons = APP_ICONS;
    loading = signal(false);
    listado = signal<OrdenConSaldo[]>([]);

    showModalPago = signal(false);
    selectedOrden = signal<OrdenConSaldo | null>(null);
    pagosOrden = signal<PagoCompra[]>([]);
    guardandoPago = false;
    formPago!: FormGroup;
    formasPago = [
        { value: 'efectivo', label: 'Efectivo' },
        { value: 'tarjeta', label: 'Tarjeta' },
        { value: 'transferencia', label: 'Transferencia' },
        { value: 'cheque', label: 'Cheque' },
        { value: 'otro', label: 'Otro' }
    ];

    filtroProveedorId: number | null = null;
    filtroPlazoDias: number | null = null;
    plazos = [
        { value: null, label: 'Todos los plazos' },
        { value: 30, label: '30 días' },
        { value: 90, label: '90 días' },
        { value: 120, label: '120 días' }
    ];

    proveedoresItems = computed(() =>
        this.proveedoresService.proveedores().map(p => ({
            id: p.id,
            nombre: p.nombreEmpresa
        }))
    );

    totalSaldoPendiente = computed(() =>
        this.listado().reduce((acc, o) => acc + (o.saldoPendiente ?? 0), 0)
    );

    async ngOnInit() {
        this.formPago = this.fb.group({
            monto: [null, [Validators.required, Validators.min(0.01)]],
            fechaPago: [new Date().toISOString().split('T')[0], Validators.required],
            formaPago: ['efectivo', Validators.required],
            referencia: ['']
        });
        await this.proveedoresService.cargarProveedores();
        await this.cargar();
    }

    async cargar() {
        this.loading.set(true);
        try {
            const filtros: { proveedorId?: number; plazoDias?: number } = {};
            if (this.filtroProveedorId != null) filtros.proveedorId = this.filtroProveedorId;
            if (this.filtroPlazoDias != null) filtros.plazoDias = this.filtroPlazoDias;
            const data = await this.comprasService.obtenerOrdenesConSaldoPendiente(filtros);
            this.listado.set(data);
        } catch (e) {
            console.error(e);
        } finally {
            this.loading.set(false);
        }
    }

    onFiltroChange() {
        this.cargar();
    }

    async openModalPago(orden: OrdenConSaldo) {
        this.selectedOrden.set(orden);
        const saldo = orden.saldoPendiente ?? orden.total ?? 0;
        this.formPago.patchValue({
            monto: saldo > 0 ? saldo : null,
            fechaPago: new Date().toISOString().split('T')[0],
            formaPago: 'efectivo',
            referencia: ''
        });
        try {
            const pagos = await this.comprasService.obtenerPagos(orden.id!);
            this.pagosOrden.set(pagos);
        } catch (e) {
            this.pagosOrden.set([]);
        }
        this.showModalPago.set(true);
    }

    closeModalPago() {
        this.showModalPago.set(false);
        this.selectedOrden.set(null);
        this.pagosOrden.set([]);
    }

    async submitPago() {
        const orden = this.selectedOrden();
        if (!orden?.id || this.formPago.invalid) return;
        this.guardandoPago = true;
        try {
            await this.comprasService.registrarPago(orden.id, {
                ordenCompraId: orden.id,
                monto: Number(this.formPago.get('monto')?.value),
                fechaPago: this.formPago.get('fechaPago')?.value,
                formaPago: this.formPago.get('formaPago')?.value || 'efectivo',
                referencia: this.formPago.get('referencia')?.value || undefined
            });
            this.alertService.success('Pago registrado correctamente');
            const pagos = await this.comprasService.obtenerPagos(orden.id);
            this.pagosOrden.set(pagos);
            const ordenActualizada = await this.comprasService.obtenerPorId(orden.id);
            if (ordenActualizada) this.selectedOrden.set({ ...orden, saldoPendiente: ordenActualizada.saldoPendiente });
            await this.cargar();
            if ((this.selectedOrden()?.saldoPendiente ?? 0) <= 0) {
                this.closeModalPago();
            } else {
                const nuevoSaldo = this.selectedOrden()?.saldoPendiente ?? orden.total ?? 0;
                this.formPago.patchValue({ monto: nuevoSaldo > 0 ? nuevoSaldo : null });
            }
        } catch (error: any) {
            this.alertService.error('Error al registrar pago: ' + error.message);
        } finally {
            this.guardandoPago = false;
        }
    }

    verOrdenCompleta(orden: OrdenConSaldo) {
        this.closeModalPago();
        this.router.navigate(['/compras', orden.id]);
    }

    getDiasTexto(o: OrdenConSaldo): string {
        if (o.diasVencido != null && o.diasVencido > 0) return `Vencido hace ${o.diasVencido} días`;
        if (o.diasRestantes != null) return `${o.diasRestantes} días`;
        return '—';
    }

    getDiasClase(o: OrdenConSaldo): string {
        if (o.diasVencido != null && o.diasVencido > 0) return 'text-red-600 font-black';
        if (o.diasRestantes != null && o.diasRestantes <= 7) return 'text-amber-600 font-bold';
        return 'text-slate-600';
    }
}
