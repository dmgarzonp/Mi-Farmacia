import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { LaboratoriosService } from '../../services/laboratorios.service';
import { TableComponent, TableColumn, TableAction } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { Laboratorio } from '../../../../core/models';

@Component({
    selector: 'app-laboratorios-list',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, TableComponent, ButtonComponent, ModalComponent, InputComponent],
    templateUrl: './laboratorios-list.component.html'
})
export class LaboratoriosListComponent implements OnInit {
    laboratoriosService = inject(LaboratoriosService);
    private fb = inject(FormBuilder);
    private alertService = inject(AlertService);
    private confirmService = inject(ConfirmService);

    form: FormGroup;
    mostrarModal = false;
    editando = false;
    laboratorioId?: number;
    guardando = false;

    columns: TableColumn<Laboratorio>[] = [
        { key: 'id', label: 'ID', width: '80px' },
        { key: 'nombre', label: 'Nombre del Laboratorio', sortable: true },
        { key: 'pais', label: 'País', width: '150px' }
    ];

    actions: TableAction<Laboratorio>[] = [
        {
            label: 'Editar',
            iconName: 'EDIT',
            variant: 'secondary',
            handler: (lab) => this.abrirModal(lab)
        },
        {
            label: 'Eliminar',
            iconName: 'DELETE',
            variant: 'danger',
            handler: (lab) => this.eliminar(lab)
        }
    ];

    constructor() {
        this.form = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(2)]],
            pais: ['Ecuador', Validators.required]
        });
    }

    ngOnInit(): void {
        this.laboratoriosService.cargarLaboratorios();
    }

    abrirModal(laboratorio?: Laboratorio): void {
        this.editando = !!laboratorio;
        this.laboratorioId = laboratorio?.id;
        if (laboratorio) {
            this.form.patchValue({
                nombre: laboratorio.nombre,
                pais: laboratorio.pais
            });
        } else {
            this.form.reset({ pais: 'Ecuador' });
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
            if (this.editando && this.laboratorioId) {
                await this.laboratoriosService.actualizar(this.laboratorioId, this.form.value);
                this.alertService.success('Laboratorio actualizado correctamente');
            } else {
                await this.laboratoriosService.crear(this.form.value);
                this.alertService.success('Laboratorio creado correctamente');
            }
            this.cerrarModal();
        } catch (error: any) {
            this.alertService.error('Error al guardar: ' + error.message);
        } finally {
            this.guardando = false;
        }
    }

    async eliminar(laboratorio: Laboratorio): Promise<void> {
        const confirmed = await this.confirmService.ask({
            title: 'Eliminar Laboratorio',
            message: `¿Está seguro de eliminar el laboratorio "${laboratorio.nombre}"?`,
            variant: 'danger',
            confirmText: 'Eliminar'
        });

        if (confirmed) {
            try {
                await this.laboratoriosService.eliminar(laboratorio.id!);
                this.alertService.success('Laboratorio eliminado correctamente');
            } catch (error: any) {
                this.alertService.error(error.message);
            }
        }
    }
}

