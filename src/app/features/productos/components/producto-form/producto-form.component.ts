import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductosService } from '../../services/productos.service';
import { CategoriasService } from '../../services/categorias.service';
import { LaboratoriosService } from '../../services/laboratorios.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { Producto, EstadoRegistro } from '../../../../core/models';

/**
 * Formulario de Producto (Catálogo Maestro)
 * Adaptado al esquema de Ecuador (Laboratorios y Categorías)
 */
@Component({
    selector: 'app-producto-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent],
    templateUrl: './producto-form.component.html',
    styles: []
})
export class ProductoFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private productosService = inject(ProductosService);
    categoriasService = inject(CategoriasService);
    laboratoriosService = inject(LaboratoriosService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private alertService = inject(AlertService);

    form!: FormGroup;
    isEditMode = false;
    productoId?: number;
    guardando = false;

    ngOnInit(): void {
        this.initForm();
        this.loadDependencies();
        this.checkEditMode();
    }

    private initForm(): void {
        this.form = this.fb.group({
            nombreComercial: ['', [Validators.required, Validators.minLength(2)]],
            principioActivo: [''],
            presentacion: [''],
            laboratorioId: ['', Validators.required],
            codigoBarras: [''],
            codigoInterno: [''],
            categoriaId: ['', Validators.required],
            precioVenta: [0, [Validators.required, Validators.min(0.01)]],
            stockMinimo: [0, [Validators.min(0)]],
            requiereReceta: [false],
            esControlado: [false]
        });
    }

    private async loadDependencies(): Promise<void> {
        await Promise.all([
            this.categoriasService.cargarCategorias(),
            this.laboratoriosService.cargarLaboratorios()
        ]);
    }

    private async checkEditMode(): Promise<void> {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEditMode = true;
            this.productoId = parseInt(id, 10);
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
                    presentacion: producto.presentacion || '',
                    laboratorioId: producto.laboratorioId,
                    codigoBarras: producto.codigoBarras || '',
                    codigoInterno: producto.codigoInterno || '',
                    categoriaId: producto.categoriaId,
                    precioVenta: producto.precioVenta,
                    stockMinimo: producto.stockMinimo,
                    requiereReceta: producto.requiereReceta,
                    esControlado: producto.esControlado
                });
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

        this.guardando = true;

        try {
            const formValue = this.form.value;
            const producto: Partial<Producto> = {
                ...formValue,
                laboratorioId: parseInt(formValue.laboratorioId, 10),
                categoriaId: parseInt(formValue.categoriaId, 10),
                precioVenta: parseFloat(formValue.precioVenta),
                stockMinimo: parseInt(formValue.stockMinimo, 10),
                estado: EstadoRegistro.ACTIVO
            };

            if (this.isEditMode) {
                await this.productosService.actualizar(this.productoId!, producto);
                this.alertService.success('Producto actualizado correctamente');
            } else {
                await this.productosService.crear(producto);
                this.alertService.success('Producto creado correctamente');
            }

            this.volver();
        } catch (error: any) {
            this.alertService.error('Error al guardar producto: ' + error.message);
        } finally {
            this.guardando = false;
        }
    }

    volver(): void {
        this.router.navigate(['/productos']);
    }
}
