import { Component, OnInit, inject, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProveedoresService } from '../../services/proveedores.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { Proveedor, EstadoRegistro } from '../../../../core/models';

/**
 * Formulario de Proveedor
 * Adaptado al nuevo esquema de base de datos detallado
 */
@Component({
    selector: 'app-proveedor-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SafeHtmlPipe],
    templateUrl: './proveedor-form.component.html'
})
export class ProveedorFormComponent implements OnInit {
    @Input() id?: number;
    @Input() isModalMode = false;
    @Output() saved = new EventEmitter<void>();
    @Output() cancelled = new EventEmitter<void>();

    private fb = inject(FormBuilder);
    public proveedoresService = inject(ProveedoresService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private alertService = inject(AlertService);

    icons = APP_ICONS;
    form!: FormGroup;
    isEditMode = false;
    proveedorId?: number;
    guardando = false;
    activeTab = signal<'empresa' | 'contacto'>('empresa');

    ngOnInit(): void {
        this.initForm();
        this.checkEditMode();
    }

    private initForm(): void {
        this.form = this.fb.group({
            nombreEmpresa: ['', [Validators.required, Validators.minLength(3)]],
            ruc: [''],
            direccion: [''],
            telefonoEmpresa: [''],
            emailEmpresa: [''],
            nombreContacto: [''],
            telefonoContacto: [''],
            emailContacto: [''],
            cargoContacto: ['']
        });
    }

    private async checkEditMode(): Promise<void> {
        // Checar si viene por Input (Modal)
        if (this.id) {
            this.isEditMode = true;
            this.proveedorId = this.id;
            await this.cargarProveedor();
            return;
        }

        // Si no, checar si viene por URL (Página)
        const urlId = this.route.snapshot.paramMap.get('id');
        if (urlId) {
            this.isEditMode = true;
            this.proveedorId = parseInt(urlId, 10);
            await this.cargarProveedor();
        }
    }

    private async cargarProveedor(): Promise<void> {
        try {
            const proveedor = await this.proveedoresService.obtenerPorId(this.proveedorId!);
            if (proveedor) {
                // Limpieza de datos (quitar .0 de números importados de Excel)
                const clean = (val: any) => {
                    if (val === null || val === undefined) return '';
                    let str = String(val);
                    return str.endsWith('.0') ? str.slice(0, -2) : str;
                };

                this.form.patchValue({
                    nombreEmpresa: proveedor.nombreEmpresa,
                    ruc: clean(proveedor.ruc),
                    direccion: clean(proveedor.direccion),
                    telefonoEmpresa: clean(proveedor.telefonoEmpresa),
                    emailEmpresa: clean(proveedor.emailEmpresa),
                    nombreContacto: clean(proveedor.nombreContacto),
                    telefonoContacto: clean(proveedor.telefonoContacto),
                    emailContacto: clean(proveedor.emailContacto),
                    cargoContacto: clean(proveedor.cargoContacto)
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

            if (this.isModalMode) {
                this.saved.emit();
            } else {
                this.volver();
            }
        } catch (error: any) {
            this.alertService.error('Error al guardar proveedor: ' + error.message);
        } finally {
            this.guardando = false;
        }
    }

    volver(): void {
        if (this.isModalMode) {
            this.cancelled.emit();
        } else {
            this.router.navigate(['/proveedores']);
        }
    }
}
