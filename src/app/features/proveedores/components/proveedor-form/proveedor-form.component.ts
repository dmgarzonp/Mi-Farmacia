import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProveedoresService } from '../../services/proveedores.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { Proveedor, EstadoRegistro } from '../../../../core/models';

/**
 * Formulario de Proveedor
 * Adaptado al nuevo esquema de base de datos detallado
 */
@Component({
    selector: 'app-proveedor-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent],
    templateUrl: './proveedor-form.component.html'
})
export class ProveedorFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private proveedoresService = inject(ProveedoresService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private alertService = inject(AlertService);

    form!: FormGroup;
    isEditMode = false;
    proveedorId?: number;
    guardando = false;

    ngOnInit(): void {
        this.initForm();
        this.checkEditMode();
    }

    private initForm(): void {
        this.form = this.fb.group({
            nombreEmpresa: ['', [Validators.required, Validators.minLength(3)]],
            ruc: ['', [Validators.pattern(/^\d+$/)]],
            direccion: [''],
            telefonoEmpresa: [''],
            emailEmpresa: ['', [Validators.email]],
            nombreContacto: [''],
            telefonoContacto: [''],
            emailContacto: ['', [Validators.email]],
            cargoContacto: ['']
        });
    }

    private async checkEditMode(): Promise<void> {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEditMode = true;
            this.proveedorId = parseInt(id, 10);
            await this.cargarProveedor();
        }
    }

    private async cargarProveedor(): Promise<void> {
        try {
            const proveedor = await this.proveedoresService.obtenerPorId(this.proveedorId!);
            if (proveedor) {
                this.form.patchValue({
                    nombreEmpresa: proveedor.nombreEmpresa,
                    ruc: proveedor.ruc || '',
                    direccion: proveedor.direccion || '',
                    telefonoEmpresa: proveedor.telefonoEmpresa || '',
                    emailEmpresa: proveedor.emailEmpresa || '',
                    nombreContacto: proveedor.nombreContacto || '',
                    telefonoContacto: proveedor.telefonoContacto || '',
                    emailContacto: proveedor.emailContacto || '',
                    cargoContacto: proveedor.cargoContacto || ''
                });
            } else {
                this.alertService.error('Proveedor no encontrado');
                this.volver();
            }
        } catch (error: any) {
            this.alertService.error('Error al cargar proveedor: ' + error.message);
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
            const proveedor: Partial<Proveedor> = {
                ...this.form.value,
                estado: EstadoRegistro.ACTIVO
            };

            if (this.isEditMode) {
                await this.proveedoresService.actualizar(this.proveedorId!, proveedor);
                this.alertService.success('Proveedor actualizado correctamente');
            } else {
                await this.proveedoresService.crear(proveedor);
                this.alertService.success('Proveedor creado correctamente');
            }

            this.volver();
        } catch (error: any) {
            this.alertService.error('Error al guardar proveedor: ' + error.message);
        } finally {
            this.guardando = false;
        }
    }

    volver(): void {
        this.router.navigate(['/proveedores']);
    }
}
