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
import { OrdenCompra, DetalleOrdenCompra, EstadoOrdenCompra, Producto, Proveedor } from '../../../../core/models';
import { CanComponentDeactivate } from '../../../../core/guards/save-draft-guard';

import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';

/**
 * Componente formulario de orden de compra
 * Adaptado al nuevo esquema de trazabilidad total
 */
@Component({
    selector: 'app-orden-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, DatePickerComponent, AutocompleteComponent, SafeHtmlPipe, CurrencyFormatPipe],
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
    form!: FormGroup;
    isEditMode = false;
    ordenId?: number;
    guardando = false;
    autoGuardando = signal(false);
    ultimoGuardado = signal<Date | null>(null);
    totalOrden = 0;
    private yaGuardado = false;
    private autoSaveSubject = new Subject<void>();

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
        
        // Si el estado es borrador y hay cambios, guardar automáticamente
        // Solo guardamos si el formulario tiene al menos el proveedor y algún producto
        if (this.form.get('estado')?.value === EstadoOrdenCompra.BORRADOR && 
            this.form.dirty && 
            this.detalles.length > 0 &&
            this.form.get('proveedorId')?.value) {
            
            this.alertService.info('Guardando borrador automáticamente...');
            await this.procesarGuardado(EstadoOrdenCompra.BORRADOR, true);
        }
        return true;
    }

    ngOnInit(): void {
        this.initForm();
        this.loadDependencies();
        this.checkEditMode();
    }

    private initForm(): void {
        this.form = this.fb.group({
            proveedorId: ['', Validators.required],
            fechaEmision: [new Date().toISOString().split('T')[0], Validators.required],
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
        this.form.get('fechaEmision')?.valueChanges.subscribe(() => this.autoSaveSubject.next());
    }

    /**
     * Lógica de autoguardado frecuente al detectar cambios en productos
     */
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
        }
    }

    private async cargarOrden(): Promise<void> {
        try {
            const orden = await this.comprasService.obtenerPorId(this.ordenId!);
            if (orden) {
                this.form.patchValue({
                    proveedorId: orden.proveedorId,
                    fechaEmision: orden.fechaEmision,
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

    async guardar(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        
        // Si estaba en borrador y confirmamos, pasa a pendiente
        let nuevoEstado = this.form.value.estado;
        if (!this.isEditMode || nuevoEstado === EstadoOrdenCompra.BORRADOR) {
            nuevoEstado = EstadoOrdenCompra.PENDIENTE;
        }
        
        await this.procesarGuardado(nuevoEstado);
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
                if (!silent) this.alertService.success(`Orden ${estado === EstadoOrdenCompra.BORRADOR ? 'guardada como borrador' : 'actualizada'}`);
            } else {
                const newId = await this.comprasService.crear(orden);
                this.ordenId = newId;
                this.isEditMode = true;
                if (!silent) this.alertService.success(`Orden ${estado === EstadoOrdenCompra.BORRADOR ? 'guardada como borrador' : 'creada correctamente'}`);
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
}
