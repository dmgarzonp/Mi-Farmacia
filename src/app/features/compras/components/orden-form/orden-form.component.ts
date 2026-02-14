import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { ComprasService } from '../../services/compras.service';
import { ProveedoresService } from '../../../proveedores/services/proveedores.service';
import { ProductosService } from '../../../productos/services/productos.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { AutocompleteComponent } from '../../../../shared/components/autocomplete/autocomplete.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { APP_ICONS } from '../../../../core/constants/icons';
import { OrdenCompra, DetalleOrdenCompra, EstadoOrdenCompra, TipoCompra, PagoCompra, Producto, Proveedor } from '../../../../core/models';
import { CanComponentDeactivate } from '../../../../core/guards/save-draft-guard';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';

const STORAGE_KEY_ULTIMO_BORRADOR = 'compras_ultimo_borrador';
const BORRADOR_RECIENTE_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Componente formulario de orden de compra
 * Adaptado al nuevo esquema de trazabilidad total
 */
@Component({
    selector: 'app-orden-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, DatePickerComponent, AutocompleteComponent, ModalComponent, SafeHtmlPipe, CurrencyFormatPipe],
    templateUrl: './orden-form.component.html',
    styles: [`:host { display: block; }`]
})
export class OrdenFormComponent implements OnInit, CanComponentDeactivate {
    private fb = inject(FormBuilder);
    private comprasService = inject(ComprasService);
    proveedoresService = inject(ProveedoresService);
    productosService = inject(ProductosService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private alertService = inject(AlertService);
    icons = APP_ICONS;

    EstadoOrdenCompra = EstadoOrdenCompra;
    TipoCompra = { CONTADO: 'contado', CREDITO: 'credito' } as const;
    formasPago = [
        { value: 'efectivo', label: 'Efectivo' },
        { value: 'tarjeta', label: 'Tarjeta' },
        { value: 'transferencia', label: 'Transferencia' },
        { value: 'cheque', label: 'Cheque' },
        { value: 'otro', label: 'Otro' }
    ];
    /** Plazos de crédito del proveedor (30, 90, 120 días) */
    plazosCredito = [
        { value: 30, label: '30 días' },
        { value: 90, label: '90 días' },
        { value: 120, label: '120 días' }
    ];
    form!: FormGroup;
    isEditMode = false;
    ordenId?: number;
    guardando = false;
    autoGuardando = signal(false);
    ultimoGuardado = signal<Date | null>(null);
    totalOrden = 0;
    private yaGuardado = false;
    private autoSaveSubject = new Subject<void>();

    pagos = signal<PagoCompra[]>([]);
    ordenCargada = signal<OrdenCompra | null>(null);
    showModalPago = signal(false);
    guardandoPago = false;
    formPago!: FormGroup;
    /** Borrador reciente guardado al salir; al abrir Nueva orden se ofrece continuar. */
    borradorReciente = signal<{ id: number } | null>(null);

    /**
     * Determina si la orden está en un estado final y solo debe ser vista
     */
    get soloLectura(): boolean {
        const estado = this.form?.get('estado')?.value;
        return estado === EstadoOrdenCompra.RECIBIDA || estado === EstadoOrdenCompra.CANCELADA;
    }

    // Mapeos para Autocomplete
    get proveedoresItems() {
        return this.proveedoresService.proveedores().map(p => ({
            id: p.id,
            label: p.nombreEmpresa,
            sublabel: `RUC: ${p.ruc || 'S/R'}`
        }));
    }

    get productosItems() {
        const items: any[] = [];
        this.productosService.productos().forEach(p => {
            if (p.presentaciones) {
                p.presentaciones.forEach(pres => {
                    items.push({
                        id: pres.id,
                        label: `${p.nombreComercial} (${pres.nombreDescriptivo})`,
                        sublabel: `LAB: ${p.laboratorioNombre || 'S/L'} | SKU: ${p.codigoInterno || 'N/A'}`,
                        producto: p,
                        presentacion: pres
                    });
                });
            }
        });
        return items;
    }

    async canDeactivate(): Promise<boolean> {
        if (this.yaGuardado) return true;
        const tieneProveedor = this.form.get('proveedorId')?.value;
        const tieneProductos = this.detalles.length > 0;
        const esBorrador = this.form.get('estado')?.value === EstadoOrdenCompra.BORRADOR;
        const hayCambios = this.form.dirty || tieneProductos;

        if (esBorrador && tieneProductos && tieneProveedor) {
            if (hayCambios) {
                this.alertService.info('Guardando borrador antes de salir...');
                await this.procesarGuardado(EstadoOrdenCompra.BORRADOR, true);
            }
            if (this.ordenId) {
                this.guardarUltimoBorradorEnStorage(this.ordenId);
                this.alertService.success('Borrador guardado. Al volver a Compras podrás continuar desde la lista o al abrir "Nueva orden".');
            }
        }
        return true;
    }

    ngOnInit(): void {
        this.initForm();
        this.loadDependencies().then(() => {
            // Revisar si vienen parámetros de reposición inteligente
            this.checkQueryParams();
        });
        this.checkEditMode();
    }

    private checkQueryParams(): void {
        const proveedorId = this.route.snapshot.queryParamMap.get('proveedorId');
        const presentacionId = this.route.snapshot.queryParamMap.get('presentacionId');
        const precioSugerido = this.route.snapshot.queryParamMap.get('precioSugerido');

        if (proveedorId) {
            this.form.patchValue({ proveedorId: parseInt(proveedorId, 10) });
        }

        if (presentacionId) {
            const presId = parseInt(presentacionId, 10);
            const precio = precioSugerido ? parseFloat(precioSugerido) : 0;
            
            // Buscar la presentación para obtener sus datos
            let presData: any = null;
            for (const p of this.productosService.productos()) {
                const found = p.presentaciones?.find(pr => pr.id === presId);
                if (found) {
                    presData = found;
                    break;
                }
            }

            const item = this.fb.group({
                presentacionId: [presId, Validators.required],
                cantidad: [1, [Validators.required, Validators.min(0.01)]],
                precioUnitario: [precio || presData?.precioCompraCaja || 0, [Validators.required, Validators.min(0)]],
                subtotal: [precio || presData?.precioCompraCaja || 0],
                lote: [''],
                fechaVencimiento: ['']
            });
            
            this.detalles.push(item);
            this.recalcularTotal();
            
            this.alertService.success('Se ha cargado el producto y el mejor proveedor detectado.');
        }
    }

    private initForm(): void {
        this.form = this.fb.group({
            proveedorId: ['', Validators.required],
            fechaEmision: [new Date().toISOString().split('T')[0], Validators.required],
            tipoCompra: ['contado'],
            plazoDias: [null],
            formaPago: [''],
            fechaVencimientoPago: [''],
            observaciones: [''],
            estado: [EstadoOrdenCompra.BORRADOR],
            detalles: this.fb.array([])
        });

        // Configurar el debounce para el autoguardado
        this.autoSaveSubject.pipe(
            debounceTime(1000) // Esperar 1 segundo de inactividad antes de guardar
        ).subscribe(() => {
            this.ejecutarAutoGuardado();
        });

        this.form.get('detalles')?.valueChanges.subscribe(() => {
            this.recalcularTotal();
            this.autoSaveSubject.next();
        });

        // También autoguardar si cambia el proveedor o fecha
        this.form.get('proveedorId')?.valueChanges.subscribe(() => this.autoSaveSubject.next());
        this.form.get('fechaEmision')?.valueChanges.subscribe(() => {
            this.actualizarFechaVencimientoPorPlazo();
            this.autoSaveSubject.next();
        });
        this.form.get('plazoDias')?.valueChanges.subscribe(() => {
            this.actualizarFechaVencimientoPorPlazo();
            this.autoSaveSubject.next();
        });

        this.formPago = this.fb.group({
            monto: [null, [Validators.required, Validators.min(0.01)]],
            fechaPago: [new Date().toISOString().split('T')[0], Validators.required],
            formaPago: ['efectivo', Validators.required],
            referencia: ['']
        });
    }

    /**
     * Lógica de autoguardado frecuente al detectar cambios en productos
     */
    /** Calcula fecha_vencimiento_pago = fecha_emision + plazo_dias cuando tipo es crédito. */
    private actualizarFechaVencimientoPorPlazo(): void {
        const plazo = this.form.get('plazoDias')?.value;
        const fechaEmision = this.form.get('fechaEmision')?.value;
        if (!plazo || !fechaEmision) return;
        const d = new Date(fechaEmision);
        d.setDate(d.getDate() + Number(plazo));
        this.form.patchValue({
            fechaVencimientoPago: d.toISOString().split('T')[0]
        }, { emitEvent: false });
    }

    private ejecutarAutoGuardado(): void {
        // Solo autoguardar si es borrador o nueva orden, y tiene los datos mínimos
        const esBorrador = this.form.get('estado')?.value === EstadoOrdenCompra.BORRADOR;
        const tieneProveedor = this.form.get('proveedorId')?.value;
        const tieneProductos = this.detalles.length > 0;

        if (esBorrador && tieneProveedor && tieneProductos && !this.guardando && !this.autoGuardando()) {
            this.autoGuardando.set(true);
            this.procesarGuardado(EstadoOrdenCompra.BORRADOR, true)
                .finally(() => {
                    this.autoGuardando.set(false);
                    this.ultimoGuardado.set(new Date());
                });
        }
    }

    private async loadDependencies(): Promise<void> {
        this.alertService.info('Cargando catálogo de productos...');
        await Promise.all([
            this.proveedoresService.cargarProveedores(),
            this.productosService.cargarProductos()
        ]);
        console.log('Productos cargados:', this.productosService.productos().length);
    }

    private async checkEditMode(): Promise<void> {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEditMode = true;
            this.ordenId = parseInt(id, 10);
            await this.cargarOrden();
        } else {
            this.checkBorradorReciente();
        }
    }

    private async cargarOrden(): Promise<void> {
        try {
            const orden = await this.comprasService.obtenerPorId(this.ordenId!);
            if (orden) {
                this.form.patchValue({
                    proveedorId: orden.proveedorId,
                    fechaEmision: orden.fechaEmision,
                    tipoCompra: orden.tipoCompra || 'contado',
                    plazoDias: orden.plazoDias ?? null,
                    formaPago: orden.formaPago || '',
                    fechaVencimientoPago: orden.fechaVencimientoPago || '',
                    observaciones: orden.observaciones || '',
                    estado: orden.estado
                });
                
                if (this.soloLectura) {
                    this.form.disable();
                }

                if (orden.detalles) {
                    const detallesArray = this.form.get('detalles') as FormArray;
                    detallesArray.clear();
                    orden.detalles.forEach(d => {
                        detallesArray.push(this.fb.group({
                            presentacionId: [d.presentacionId, Validators.required],
                            cantidad: [d.cantidad, [Validators.required, Validators.min(0.01)]],
                            precioUnitario: [d.precioUnitario, [Validators.required, Validators.min(0)]],
                            subtotal: [d.subtotal],
                            lote: [d.lote || ''],
                            fechaVencimiento: [d.fechaVencimiento || '']
                        }));
                    });
                }
                this.ordenCargada.set(orden);
                if (orden.tipoCompra === 'credito' && this.ordenId) {
                    const lista = await this.comprasService.obtenerPagos(this.ordenId);
                    this.pagos.set(lista);
                } else {
                    this.pagos.set([]);
                }
            } else {
                this.alertService.error('Orden no encontrada');
                this.volver();
            }
        } catch (error: any) {
            this.alertService.error('Error al cargar orden: ' + error.message);
            this.volver();
        }
    }

    get detalles(): FormArray {
        return this.form.get('detalles') as FormArray;
    }

    agregarDetalle(): void {
        const item = this.fb.group({
            presentacionId: ['', Validators.required],
            cantidad: [1, [Validators.required, Validators.min(0.01)]],
            precioUnitario: [0, [Validators.required, Validators.min(0)]],
            subtotal: [0],
            lote: [''],
            fechaVencimiento: ['']
        });
        this.detalles.push(item);
    }

    limpiarLista(): void {
        this.detalles.clear();
    }

    onGlobalProductoSelected(event: any): void {
        console.log('Presentación seleccionada globalmente:', event);
        if (event && event.id) {
            const index = this.detalles.controls.findIndex(ctrl => ctrl.get('presentacionId')?.value === event.id);
            
            if (index >= 0) {
                this.alertService.info('La presentación ya está en la lista.');
                this.focusCantidadInput(index);
                return;
            }

            const item = this.fb.group({
                presentacionId: [event.id, Validators.required],
                cantidad: [1, [Validators.required, Validators.min(0.01)]],
                precioUnitario: [event.presentacion?.precioCompraCaja || 0, [Validators.required, Validators.min(0)]],
                subtotal: [0],
                lote: [''],
                fechaVencimiento: ['']
            });
            
            this.detalles.push(item);
            
            this.calcularSubtotal(this.detalles.length - 1);

            // Esperar un micro-momento a que Angular renderice la nueva fila y poner el foco
            setTimeout(() => {
                this.focusCantidadInput(this.detalles.length - 1);
            }, 50);
        }
    }

    private focusCantidadInput(index: number): void {
        const inputs = document.querySelectorAll('input[formControlName="cantidad"]');
        const targetInput = inputs[index] as HTMLInputElement;
        if (targetInput) {
            targetInput.focus();
            targetInput.select(); // Seleccionar el "1" por defecto para sobrescribir rápido
        }
    }

    getPresentacionNombre(id: number): string {
        for (const p of this.productosService.productos()) {
            const pres = p.presentaciones?.find(pr => pr.id === id);
            if (pres) return pres.nombreDescriptivo;
        }
        return 'Presentación no encontrada';
    }

    getProductoNombrePorPresentacion(id: number): string {
        for (const p of this.productosService.productos()) {
            const pres = p.presentaciones?.find(pr => pr.id === id);
            if (pres) return p.nombreComercial;
        }
        return 'Producto no encontrado';
    }

    removerDetalle(index: number): void {
        this.detalles.removeAt(index);
    }

    onProductoSelected(event: any, index: number): void {
        if (event && event.id) {
            this.calcularSubtotal(index);
        }
    }

    calcularSubtotal(index: number): void {
        const group = this.detalles.at(index);
        const cantidad = group.get('cantidad')?.value || 0;
        const precioUnitario = group.get('precioUnitario')?.value || 0;
        const subtotal = cantidad * precioUnitario;
        group.patchValue({ subtotal }, { emitEvent: true });
    }

    recalcularTotal(): void {
        this.totalOrden = this.detalles.controls.reduce((acc, curr) => {
            return acc + (curr.get('subtotal')?.value || 0);
        }, 0);
    }

    /** Generar orden: crea o confirma la orden y la deja en PENDIENTE. */
    async generarOrden(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        await this.procesarGuardado(EstadoOrdenCompra.PENDIENTE);
    }

    /** Actualizar orden: guarda cambios. Si es borrador mantiene BORRADOR; si es PENDIENTE/APROBADA mantiene el estado actual. */
    async actualizarOrden(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const estadoActual = this.form.value.estado;
        const mantenerEstado = estadoActual === EstadoOrdenCompra.BORRADOR
            ? EstadoOrdenCompra.BORRADOR
            : (estadoActual || EstadoOrdenCompra.PENDIENTE);
        await this.procesarGuardado(mantenerEstado);
    }

    /** Enter en el formulario: Generar Orden (nueva o borrador) o Actualizar Orden (resto). */
    onSubmit(): void {
        if (this.form.invalid || this.guardando || this.detalles.length === 0) return;
        if (!this.isEditMode) {
            this.generarOrden();
        } else if (this.form.get('estado')?.value === EstadoOrdenCompra.BORRADOR) {
            this.generarOrden();
        } else {
            this.actualizarOrden();
        }
    }

    async guardarComoBorrador(): Promise<void> {
        await this.procesarGuardado(EstadoOrdenCompra.BORRADOR);
    }

    private async procesarGuardado(estado: EstadoOrdenCompra, silent = false): Promise<void> {
        if (this.detalles.length === 0) {
            if (!silent) this.alertService.error('Debe agregar al menos un producto');
            return;
        }

        this.guardando = true;

        try {
            const formValue = this.form.value;
            
            // Validaciones adicionales de seguridad
            const proveedorId = parseInt(formValue.proveedorId, 10);
            if (isNaN(proveedorId)) {
                if (!silent) this.alertService.error('Debe seleccionar un proveedor válido');
                return;
            }

            const orden: Partial<OrdenCompra> = {
                ...formValue,
                proveedorId: proveedorId,
                estado,
                total: this.totalOrden,
                subtotal: this.totalOrden,
                detalles: formValue.detalles.map((d: any) => ({
                    ...d,
                    presentacionId: parseInt(d.presentacionId, 10),
                    cantidad: parseFloat(d.cantidad),
                    precioUnitario: parseFloat(d.precioUnitario),
                    subtotal: parseFloat(d.subtotal),
                    lote: d.lote || null,
                    fechaVencimiento: d.fechaVencimiento || null
                })).filter((d: any) => !isNaN(d.presentacionId)) // Evitar detalles inválidos
            };

            if (this.isEditMode) {
                await this.comprasService.actualizar(this.ordenId!, orden);
                if (estado === EstadoOrdenCompra.BORRADOR) this.guardarUltimoBorradorEnStorage(this.ordenId!);
                if (!silent) {
                    const msg = estado === EstadoOrdenCompra.BORRADOR ? 'guardada como borrador' : (estado === EstadoOrdenCompra.PENDIENTE ? 'generada correctamente' : 'actualizada');
                    this.alertService.success(`Orden ${msg}`);
                }
            } else {
                const newId = await this.comprasService.crear(orden);
                this.ordenId = newId;
                this.isEditMode = true;
                if (estado === EstadoOrdenCompra.BORRADOR) this.guardarUltimoBorradorEnStorage(newId);
                if (!silent) {
                    const msg = estado === EstadoOrdenCompra.BORRADOR ? 'guardada como borrador' : 'generada correctamente';
                    this.alertService.success(`Orden ${msg}`);
                }
            }

            this.form.markAsPristine(); // Marcar como limpio tras guardar
            if (!silent) {
                this.yaGuardado = true;
                this.volver();
            }
        } catch (error: any) {
            if (!silent) this.alertService.error('Error al guardar: ' + error.message);
        } finally {
            this.guardando = false;
        }
    }

    volver(): void {
        this.router.navigate(['/compras']);
    }

    private guardarUltimoBorradorEnStorage(ordenId: number): void {
        try {
            sessionStorage.setItem(STORAGE_KEY_ULTIMO_BORRADOR, JSON.stringify({ id: ordenId, ts: Date.now() }));
        } catch (_) {}
    }

    private checkBorradorReciente(): void {
        if (this.isEditMode) return;
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY_ULTIMO_BORRADOR);
            if (!raw) return;
            const data = JSON.parse(raw) as { id: number; ts: number };
            if (Date.now() - data.ts > BORRADOR_RECIENTE_MS) return;
            this.borradorReciente.set({ id: data.id });
        } catch (_) {}
    }

    continuarBorradorReciente(): void {
        const b = this.borradorReciente();
        if (b) this.router.navigate(['/compras', b.id]);
    }

    descartarBorradorReciente(): void {
        try {
            sessionStorage.removeItem(STORAGE_KEY_ULTIMO_BORRADOR);
        } catch (_) {}
        this.borradorReciente.set(null);
    }

    openModalPago(): void {
        const orden = this.ordenCargada();
        const saldo = orden?.saldoPendiente ?? orden?.total ?? 0;
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
    }

    async submitPago(): Promise<void> {
        if (this.formPago.invalid || !this.ordenId) return;
        this.guardandoPago = true;
        try {
            await this.comprasService.registrarPago(this.ordenId, {
                ordenCompraId: this.ordenId,
                monto: Number(this.formPago.get('monto')?.value),
                fechaPago: this.formPago.get('fechaPago')?.value,
                formaPago: this.formPago.get('formaPago')?.value || 'efectivo',
                referencia: this.formPago.get('referencia')?.value || undefined
            });
            this.alertService.success('Pago registrado correctamente');
            const orden = await this.comprasService.obtenerPorId(this.ordenId);
            if (orden) this.ordenCargada.set(orden);
            this.pagos.set(await this.comprasService.obtenerPagos(this.ordenId));
            this.closeModalPago();
        } catch (error: any) {
            this.alertService.error('Error al registrar pago: ' + error.message);
        } finally {
            this.guardandoPago = false;
        }
    }
}
