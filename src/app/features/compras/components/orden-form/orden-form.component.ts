import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
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

/**
 * Componente formulario de orden de compra
 * Adaptado al nuevo esquema de trazabilidad total
 */
@Component({
    selector: 'app-orden-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, DatePickerComponent, AutocompleteComponent, SafeHtmlPipe],
    templateUrl: './orden-form.component.html',
    styles: [`:host { display: block; }`]
})
export class OrdenFormComponent implements OnInit {
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
    totalOrden = 0;

    // Mapeos para Autocomplete
    get proveedoresItems() {
        return this.proveedoresService.proveedores().map(p => ({
            id: p.id,
            label: p.nombreEmpresa,
            sublabel: `RUC: ${p.ruc || 'S/R'}`
        }));
    }

    get productosItems() {
        return this.productosService.productos().map(p => ({
            id: p.id,
            label: p.nombreComercial,
            sublabel: `LAB: ${p.laboratorioNombre || 'S/L'} | STOCK: ${p.stockTotal || 0}`
        }));
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
            estado: [EstadoOrdenCompra.PENDIENTE],
            detalles: this.fb.array([])
        });

        this.form.get('detalles')?.valueChanges.subscribe(() => {
            this.recalcularTotal();
        });
    }

    private async loadDependencies(): Promise<void> {
        await Promise.all([
            this.proveedoresService.cargarProveedores(),
            this.productosService.cargarProductos()
        ]);
    }

    private async checkEditMode(): Promise<void> {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEditMode = true;
            this.ordenId = parseInt(id, 10);
            await this.cargarOrden();
        } else {
            this.agregarDetalle();
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

                if (orden.detalles) {
                    const detallesArray = this.form.get('detalles') as FormArray;
                    detallesArray.clear();
                    orden.detalles.forEach(d => {
                        detallesArray.push(this.fb.group({
                            productoId: [d.productoId, Validators.required],
                            cantidad: [d.cantidad, [Validators.required, Validators.min(1)]],
                            precioUnitario: [d.precioUnitario, [Validators.required, Validators.min(0)]],
                            subtotal: [d.subtotal],
                            lote: [d.lote, Validators.required],
                            fechaVencimiento: [d.fechaVencimiento, Validators.required]
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
            productoId: ['', Validators.required],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            precioUnitario: [0, [Validators.required, Validators.min(0)]],
            subtotal: [0],
            lote: ['', Validators.required],
            fechaVencimiento: ['', Validators.required]
        });
        this.detalles.push(item);
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

        if (this.detalles.length === 0) {
            this.alertService.error('Debe agregar al menos un producto a la orden');
            return;
        }

        this.guardando = true;

        try {
            const formValue = this.form.value;
            const orden: Partial<OrdenCompra> = {
                ...formValue,
                total: this.totalOrden,
                subtotal: this.totalOrden, // Por ahora simplificado
                detalles: formValue.detalles.map((d: any) => ({
                    ...d,
                    productoId: parseInt(d.productoId, 10),
                    cantidad: parseFloat(d.cantidad),
                    precioUnitario: parseFloat(d.precioUnitario),
                    subtotal: parseFloat(d.subtotal)
                }))
            };

            if (this.isEditMode) {
                await this.comprasService.actualizar(this.ordenId!, orden);
                this.alertService.success('Orden actualizada correctamente');
            } else {
                await this.comprasService.crear(orden);
                this.alertService.success('Orden creada correctamente');
            }

            this.volver();
        } catch (error: any) {
            this.alertService.error('Error al guardar la orden: ' + error.message);
        } finally {
            this.guardando = false;
        }
    }

    volver(): void {
        this.router.navigate(['/compras']);
    }
}
