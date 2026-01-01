import { Component, OnInit, inject, Input, Output, EventEmitter, ViewChild, ElementRef, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductosService } from '../../services/productos.service';
import { CategoriasService } from '../../services/categorias.service';
import { LaboratoriosService } from '../../services/laboratorios.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { AutocompleteComponent } from '../../../../shared/components/autocomplete/autocomplete.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { Producto, Presentacion, EstadoRegistro } from '../../../../core/models';

/**
 * Formulario de Producto (Catálogo Maestro)
 * Rediseñado para ser ultra-rápido y visualmente ágil
 */
@Component({
    selector: 'app-producto-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, AutocompleteComponent, SafeHtmlPipe],
    templateUrl: './producto-form.component.html',
    styles: [`
        :host { display: block; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
    `]
})
export class ProductoFormComponent implements OnInit {
    @Input() id?: number;
    @Input() isModalMode = false;
    @Output() saved = new EventEmitter<void>();
    @Output() cancelled = new EventEmitter<void>();

    @ViewChild('nombreInput') nombreInput?: ElementRef;

    private fb = inject(FormBuilder);
    private productosService = inject(ProductosService);
    categoriasService = inject(CategoriasService);
    laboratoriosService = inject(LaboratoriosService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private alertService = inject(AlertService);
    
    icons = APP_ICONS;
    form!: FormGroup;
    isEditMode = false;
    productoId?: number;
    guardando = false;

    laboratoriosItems = computed(() => 
        this.laboratoriosService.laboratorios().map(l => ({ id: l.id, label: l.nombre }))
    );

    categoriasItems = computed(() => 
        this.categoriasService.categorias().map(c => ({ id: c.id, label: c.nombre }))
    );

    @HostListener('window:keydown', ['$event'])
    handleKeyboardEvents(event: KeyboardEvent) {
        // Ctrl + S para Guardar
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            this.guardar();
        }
        // ESC para Volver/Cancelar
        if (event.key === 'Escape') {
            this.volver();
        }
    }

    ngOnInit(): void {
        this.initForm();
        this.loadDependencies();
        this.checkEditMode();
        
        // Autofocus al inicio
        setTimeout(() => {
            const input = document.querySelector('input[formControlName="nombreComercial"]') as HTMLInputElement;
            input?.focus();
        }, 500);

        // Auto-generar SKU si el nombre cambia y no hay SKU
        this.form.get('nombreComercial')?.valueChanges.subscribe(name => {
            if (!this.isEditMode && name && !this.form.get('codigoInterno')?.value) {
                this.generarSKU(name);
            }
        });
    }

    public generarSKU(nombre: string): void {
        const prefix = nombre.substring(0, 3).toUpperCase();
        const random = Math.floor(1000 + Math.random() * 9000);
        this.form.get('codigoInterno')?.setValue(`${prefix}-${random}`, { emitEvent: false });
    }

    /**
     * Aplica una plantilla predefinida a una presentación
     */
    public aplicarPlantilla(index: number, tipo: 'caja100' | 'caja30' | 'frasco' | 'ampolla'): void {
        const group = this.presentaciones.at(index);
        const plantillas = {
            caja100: { nombre: 'Caja x 100 tab.', unidad: 'tableta', unidades: 100 },
            caja30: { nombre: 'Caja x 30 tab.', unidad: 'tableta', unidades: 30 },
            frasco: { nombre: 'Frasco x 100ml', unidad: 'ml', unidades: 1 },
            ampolla: { nombre: 'Ampolla x 5ml', unidad: 'ml', unidades: 1 }
        };

        const p = plantillas[tipo];
        group.patchValue({
            nombreDescriptivo: p.nombre,
            unidadBase: p.unidad,
            unidadesPorCaja: p.unidades
        });
    }

    /**
     * Copia una presentación existente
     */
    public copiarPresentacion(index: number): void {
        const original = this.presentaciones.at(index).value;
        const copy = this.fb.group({
            ...original,
            id: null, // No copiar ID
            nombreDescriptivo: `${original.nombreDescriptivo} (Copia)`,
            codigoBarras: '' // No copiar código de barras
        }, { validators: this.validarPrecios() });

        this.setupPriceListeners(copy);
        this.presentaciones.push(copy);
        this.alertService.info('Presentación copiada. Ajuste los detalles necesarios.');
    }

    private initForm(): void {
        this.form = this.fb.group({
            nombreComercial: ['', [Validators.required, Validators.minLength(2)]],
            principioActivo: [''],
            laboratorioId: [''],
            codigoInterno: [''],
            categoriaId: ['', Validators.required],
            tarifaIva: [0, Validators.required], // 0% por defecto (medicamentos)
            requiereReceta: [false],
            esControlado: [false],
            presentaciones: this.fb.array([])
        });

        // Agregar una presentación inicial por defecto si es nuevo
        if (!this.id && !this.route.snapshot.paramMap.get('id')) {
            this.agregarPresentacion();
        }
    }

    get presentaciones(): FormArray {
        return this.form.get('presentaciones') as FormArray;
    }

    agregarPresentacion(): void {
        const item = this.fb.group({
            nombreDescriptivo: ['', Validators.required],
            unidadBase: ['tableta', Validators.required],
            unidadesPorCaja: [1, [Validators.required, Validators.min(1)]],
            precioCompraCaja: [0, [Validators.required, Validators.min(0)]],
            precioVentaUnidad: [0, [Validators.required, Validators.min(0)]],
            precioVentaCaja: [0, [Validators.required, Validators.min(0)]],
            stockMinimo: [5, [Validators.required, Validators.min(0)]],
            codigoBarras: [''],
            vencimientoPredeterminadoMeses: [0, [Validators.min(0)]],
            precioVentaUnidadManual: [false]
        }, { validators: this.validarPrecios() });

        // Suscribirse a cambios para cálculo automático
        this.setupPriceListeners(item);

        this.presentaciones.push(item);
    }

    /**
     * Configura los listeners para el cálculo automático de precios
     */
    private setupPriceListeners(group: FormGroup): void {
        const unitsCtrl = group.get('unidadesPorCaja');
        const boxPriceCtrl = group.get('precioVentaCaja');
        const unitPriceCtrl = group.get('precioVentaUnidad');
        const manualFlagCtrl = group.get('precioVentaUnidadManual');

        // Al cambiar precio de caja o unidades, recalcular unitario si NO es manual
        const recalculate = () => {
            if (!manualFlagCtrl?.value) {
                const boxPrice = boxPriceCtrl?.value || 0;
                const units = unitsCtrl?.value || 1;
                unitPriceCtrl?.setValue(parseFloat((boxPrice / units).toFixed(4)), { emitEvent: false });
            }
        };

        unitsCtrl?.valueChanges.subscribe(recalculate);
        boxPriceCtrl?.valueChanges.subscribe(recalculate);

        // Si el usuario edita el precio unitario directamente, marcar como manual
        unitPriceCtrl?.valueChanges.subscribe(() => {
            manualFlagCtrl?.setValue(true, { emitEvent: false });
        });
    }

    /**
     * Permite al usuario resetear el precio al valor sugerido
     */
    resetPrecioSugerido(index: number): void {
        const group = this.presentaciones.at(index) as FormGroup;
        group.get('precioVentaUnidadManual')?.setValue(false);
        const boxPrice = group.get('precioVentaCaja')?.value || 0;
        const units = group.get('unidadesPorCaja')?.value || 1;
        group.get('precioVentaUnidad')?.setValue(parseFloat((boxPrice / units).toFixed(4)));
    }

    /**
     * Validador personalizado para asegurar consistencia de precios
     */
    private validarPrecios() {
        return (group: FormGroup): { [key: string]: any } | null => {
            const precioCompraCaja = group.get('precioCompraCaja')?.value || 0;
            const unidadesPorCaja = group.get('unidadesPorCaja')?.value || 1;
            const precioVentaUnidad = group.get('precioVentaUnidad')?.value || 0;
            const precioVentaCaja = group.get('precioVentaCaja')?.value || 0;

            const costoPorUnidad = precioCompraCaja / unidadesPorCaja;

            const errors: any = {};

            // 1. Precio Venta < Costo
            if (precioVentaUnidad > 0 && precioVentaUnidad < costoPorUnidad) {
                errors.precioVentaBajo = true;
            }

            // 2. Precio Caja < Precio Compra
            if (precioVentaCaja > 0 && precioVentaCaja < precioCompraCaja) {
                errors.precioCajaBajo = true;
            }

            // 3. Unidad * Cantidad > Caja (Alerta de inconsistencia solicitada)
            if (precioVentaUnidad > 0 && precioVentaCaja > 0) {
                const totalPorUnidades = precioVentaUnidad * unidadesPorCaja;
                if (totalPorUnidades > (precioVentaCaja + 0.01)) { // Margen de error por decimales
                    errors.unidadMasCaraQueCaja = true;
                }
            }

            return Object.keys(errors).length ? errors : null;
        };
    }

    /**
     * Calcula el costo por unidad para una presentación
     */
    getCostoPorUnidad(index: number): number {
        const group = this.presentaciones.at(index);
        const precioCompraCaja = group.get('precioCompraCaja')?.value || 0;
        const unidadesPorCaja = group.get('unidadesPorCaja')?.value || 1;
        return precioCompraCaja / unidadesPorCaja;
    }

    /**
     * Calcula el margen por unidad para una presentación
     */
    getMargenPorUnidad(index: number): number {
        const group = this.presentaciones.at(index);
        const precioVentaUnidad = group.get('precioVentaUnidad')?.value || 0;
        return precioVentaUnidad - this.getCostoPorUnidad(index);
    }

    removerPresentacion(index: number): void {
        if (this.presentaciones.length > 1) {
            this.presentaciones.removeAt(index);
        } else {
            this.alertService.warning('El producto debe tener al menos una presentación');
        }
    }

    private async loadDependencies(): Promise<void> {
        await Promise.all([
            this.categoriasService.cargarCategorias(),
            this.laboratoriosService.cargarLaboratorios()
        ]);
    }

    private async checkEditMode(): Promise<void> {
        if (this.id) {
            this.isEditMode = true;
            this.productoId = this.id;
            await this.cargarProducto();
            return;
        }

        const urlId = this.route.snapshot.paramMap.get('id');
        if (urlId) {
            this.isEditMode = true;
            this.productoId = parseInt(urlId, 10);
            await this.cargarProducto();
        }
    }

    private async cargarProducto(): Promise<void> {
        try {
            const producto = await this.productosService.obtenerPorId(this.productoId!);
            if (producto) {
                this.form.patchValue({
                    nombreComercial: producto.nombreComercial,
                    principioActivo: producto.principioActivo || '',
                    laboratorioId: producto.laboratorioId,
                    codigoInterno: producto.codigoInterno || '',
                    categoriaId: producto.categoriaId,
                    tarifaIva: producto.tarifaIva || 0,
                    requiereReceta: producto.requiereReceta,
                    esControlado: producto.esControlado
                });

                if (producto.presentaciones) {
                    this.presentaciones.clear();
                    producto.presentaciones.forEach(p => {
                        const group = this.fb.group({
                            id: [p.id],
                            nombreDescriptivo: [p.nombreDescriptivo, Validators.required],
                            unidadBase: [p.unidadBase, Validators.required],
                            unidadesPorCaja: [p.unidadesPorCaja, [Validators.required, Validators.min(1)]],
                            precioCompraCaja: [p.precioCompraCaja || 0, [Validators.required, Validators.min(0)]],
                            precioVentaUnidad: [p.precioVentaUnidad, [Validators.required, Validators.min(0)]],
                            precioVentaCaja: [p.precioVentaCaja, [Validators.required, Validators.min(0)]],
                            stockMinimo: [p.stockMinimo, [Validators.required, Validators.min(0)]],
                            codigoBarras: [p.codigoBarras || ''],
                            vencimientoPredeterminadoMeses: [p.vencimientoPredeterminadoMeses || 0, [Validators.min(0)]],
                            precioVentaUnidadManual: [true] // Al cargar, asumimos manual para no sobreescribir datos reales
                        }, { validators: this.validarPrecios() });
                        
                        this.setupPriceListeners(group);
                        this.presentaciones.push(group);
                    });
                }
            } else {
                this.alertService.error('Producto no encontrado');
                this.volver();
            }
        } catch (error: any) {
            this.alertService.error('Error al cargar producto: ' + error.message);
            this.volver();
        }
    }

    async guardar(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        if (this.presentaciones.length === 0) {
            this.alertService.error('Debe agregar al menos una presentación');
            return;
        }

        this.guardando = true;

        try {
            const formValue = this.form.value;
            const producto: Partial<Producto> = {
                ...formValue,
                laboratorioId: formValue.laboratorioId ? parseInt(formValue.laboratorioId, 10) : null,
                categoriaId: parseInt(formValue.categoriaId, 10),
                estado: EstadoRegistro.ACTIVO,
                presentaciones: formValue.presentaciones.map((p: any) => ({
                    ...p,
                    unidadesPorCaja: parseInt(p.unidadesPorCaja, 10),
                    precioCompraCaja: parseFloat(p.precioCompraCaja),
                    precioVentaUnidad: parseFloat(p.precioVentaUnidad),
                    precioVentaCaja: parseFloat(p.precioVentaCaja),
                    stockMinimo: parseInt(p.stockMinimo, 10),
                    vencimientoPredeterminadoMeses: parseInt(p.vencimientoPredeterminadoMeses, 10)
                }))
            };

            if (this.isEditMode) {
                await this.productosService.actualizar(this.productoId!, producto);
                this.alertService.success('Producto actualizado correctamente');
            } else {
                await this.productosService.crear(producto);
                this.alertService.success('Producto creado correctamente');
            }

            if (this.isModalMode) {
                this.saved.emit();
            } else {
                this.volver();
            }
        } catch (error: any) {
            this.alertService.error('Error al guardar producto: ' + error.message);
        } finally {
            this.guardando = false;
        }
    }

    volver(): void {
        if (this.isModalMode) {
            this.cancelled.emit();
        } else {
            this.router.navigate(['/productos']);
        }
    }
}
