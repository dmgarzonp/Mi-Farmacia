import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ProveedoresService } from '../../services/proveedores.service';
import { ComprasService } from '../../../compras/services/compras.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Proveedor } from '../../../../core/models';
import { OrdenCompra } from '../../../../core/models';

type OrdenConSaldo = OrdenCompra & { diasRestantes?: number; diasVencido?: number };
type MovKardex = { fecha: string; tipo: 'compra' | 'pago'; ordenId: number; numeroOrden: string; concepto: string; entrega?: string; debito: number; credito: number; saldo: number };

/**
 * Ficha del proveedor: datos en solo lectura + Saldos y deudas (órdenes a crédito, kardex, registrar pagos).
 * Acceso: listado → Ver Ficha. Editar lleva al formulario de edición.
 */
@Component({
    selector: 'app-proveedor-ficha',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        ButtonComponent,
        ModalComponent,
        InputComponent,
        DatePickerComponent,
        SafeHtmlPipe,
        CurrencyFormatPipe
    ],
    templateUrl: './proveedor-ficha.component.html'
})
export class ProveedorFichaComponent implements OnInit {
    private proveedoresService = inject(ProveedoresService);
    private comprasService = inject(ComprasService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private alertService = inject(AlertService);
    private fb = inject(FormBuilder);

    icons = APP_ICONS;
    proveedorId?: number;
    proveedor = signal<Proveedor | null>(null);
    totalDeuda = signal<number>(0);
    ordenesCredito = signal<OrdenConSaldo[]>([]);
    kardex = signal<MovKardex[]>([]);
    loadingCredito = signal(false);
    showModalPago = signal(false);
    guardandoPago = false;
    selectedOrdenPago = signal<OrdenConSaldo | null>(null);
    formPago!: FormGroup;
    formasPago = [
        { value: 'efectivo', label: 'Efectivo' },
        { value: 'tarjeta', label: 'Tarjeta' },
        { value: 'transferencia', label: 'Transferencia' },
        { value: 'cheque', label: 'Cheque' },
        { value: 'otro', label: 'Otro' }
    ];

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.proveedorId = parseInt(id, 10);
            this.cargarProveedor();
            this.cargarDatosCredito();
        }
        this.formPago = this.fb.group({
            monto: [null, [Validators.required, Validators.min(0.01)]],
            fechaPago: [new Date().toISOString().split('T')[0], Validators.required],
            formaPago: ['efectivo', Validators.required],
            referencia: ['']
        });
    }

    async cargarProveedor(): Promise<void> {
        if (!this.proveedorId) return;
        try {
            const p = await this.proveedoresService.obtenerPorId(this.proveedorId);
            this.proveedor.set(p);
        } catch (e) {
            this.alertService.error('Error al cargar proveedor');
            this.volver();
        }
    }

    async cargarDatosCredito(): Promise<void> {
        if (!this.proveedorId) return;
        this.loadingCredito.set(true);
        try {
            const [deuda, ordenes, movs] = await Promise.all([
                this.comprasService.obtenerTotalDeudaProveedor(this.proveedorId),
                this.comprasService.obtenerOrdenesCreditoPorProveedor(this.proveedorId),
                this.comprasService.obtenerMovimientosKardexProveedor(this.proveedorId)
            ]);
            this.totalDeuda.set(deuda);
            this.ordenesCredito.set(ordenes);
            this.kardex.set(movs);
        } catch (e) {
            console.error(e);
        } finally {
            this.loadingCredito.set(false);
        }
    }

    volver(): void {
        this.router.navigate(['/proveedores']);
    }

    editar(): void {
        this.router.navigate(['/proveedores', this.proveedorId, 'editar']);
    }

    openModalPago(orden: OrdenConSaldo): void {
        const saldo = orden.saldoPendiente ?? orden.total ?? 0;
        this.selectedOrdenPago.set(orden);
        this.formPago.patchValue({
            monto: saldo > 0 ? saldo : null,
            fechaPago: new Date().toISOString().split('T')[0],
            formaPago: 'efectivo',
            referencia: ''
        });
        this.showModalPago.set(true);
    }

    closeModalPago(): void {
        this.showModalPago.set(false);
        this.selectedOrdenPago.set(null);
    }

    async submitPago(): Promise<void> {
        const orden = this.selectedOrdenPago();
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
            this.closeModalPago();
            await this.cargarDatosCredito();
        } catch (error: any) {
            this.alertService.error('Error al registrar pago: ' + error.message);
        } finally {
            this.guardandoPago = false;
        }
    }

    irAOrden(ordenId: number): void {
        this.router.navigate(['/compras', ordenId]);
    }
}
