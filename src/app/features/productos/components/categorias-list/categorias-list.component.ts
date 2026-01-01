import { Component, OnInit, inject, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CategoriasService } from '../../services/categorias.service';
import { TableComponent, TableColumn, TableAction } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { Categoria } from '../../../../core/models';

/**
 * Gestión de Categorías de Productos
 * Adaptado al nuevo esquema de base de datos
 */
@Component({
    selector: 'app-categorias-list',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, TableComponent, ButtonComponent, ModalComponent, InputComponent],
    templateUrl: './categorias-list.component.html'
})
export class CategoriasListComponent implements OnInit {
    @Input() isModalMode = false;

    categoriasService = inject(CategoriasService);
    private fb = inject(FormBuilder);
    private alertService = inject(AlertService);
    private confirmService = inject(ConfirmService);

    form: FormGroup;
    mostrarModal = false;
    editando = false;
    categoriaId?: number;
    guardando = false;

    columns: TableColumn<Categoria>[] = [
        { key: 'id', label: 'ID', width: '80px' },
        { key: 'nombre', label: 'Nombre de Categoría', sortable: true }
    ];

    actions: TableAction<Categoria>[] = [
        {
            label: 'Editar',
            iconName: 'EDIT',
            variant: 'secondary',
            handler: (cat) => this.abrirModal(cat)
        },
        {
            label: 'Eliminar',
            iconName: 'DELETE',
            variant: 'danger',
            handler: (cat) => this.eliminar(cat)
        }
    ];

    constructor() {
        this.form = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(2)]]
        });
    }

    ngOnInit(): void {
        this.categoriasService.cargarCategorias();
    }

    abrirModal(categoria?: Categoria): void {
        this.editando = !!categoria;
        this.categoriaId = categoria?.id;
        if (categoria) {
            this.form.patchValue({
                nombre: categoria.nombre
            });
        } else {
            this.form.reset();
        }
        this.mostrarModal = true;
    }

    cerrarModal(): void {
        this.mostrarModal = false;
        this.form.reset();
    }

    async guardar(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.guardando = true;
        try {
            if (this.editando && this.categoriaId) {
                await this.categoriasService.actualizar(this.categoriaId, this.form.value);
                this.alertService.success('Categoría actualizada correctamente');
            } else {
                await this.categoriasService.crear(this.form.value);
                this.alertService.success('Categoría creada correctamente');
            }
            this.cerrarModal();
        } catch (error: any) {
            this.alertService.error('Error al guardar: ' + error.message);
        } finally {
            this.guardando = false;
        }
    }

    async eliminar(categoria: Categoria): Promise<void> {
        const confirmed = await this.confirmService.ask({
            title: 'Eliminar Categoría',
            message: `¿Está seguro de eliminar la categoría "${categoria.nombre}"? Esta acción solo se permitirá si no hay productos asociados.`,
            variant: 'danger',
            confirmText: 'Eliminar'
        });

        if (confirmed) {
            try {
                await this.categoriasService.eliminar(categoria.id!);
                this.alertService.success('Categoría eliminada correctamente');
            } catch (error: any) {
                this.alertService.error(error.message);
            }
        }
    }
}
