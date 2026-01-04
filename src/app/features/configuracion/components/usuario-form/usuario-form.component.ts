import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { Usuario, RolUsuario, EstadoRegistro } from '../../../../core/models';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { AlertService } from '../../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ButtonComponent, InputComponent, SafeHtmlPipe],
  templateUrl: './usuario-form.component.html'
})
export class UsuarioFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private usuariosService = inject(UsuariosService);
  private alertService = inject(AlertService);

  icons = APP_ICONS;
  loading = signal(false);
  editMode = signal(false);
  usuarioId = signal<number | null>(null);
  showPassword = signal(false);

  roles = [
    { value: RolUsuario.ADMINISTRADOR, label: 'Administrador (Acceso Total)' },
    { value: RolUsuario.FARMACEUTICO, label: 'Farmacéutico (Ventas y Compras)' },
    { value: RolUsuario.CAJERO, label: 'Cajero (Solo Ventas)' },
    { value: RolUsuario.ALMACEN, label: 'Almacén (Solo Inventario)' }
  ];

  estados = [
    { value: EstadoRegistro.ACTIVO, label: 'Activo' },
    { value: EstadoRegistro.INACTIVO, label: 'Inactivo' }
  ];

  usuarioForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', []], // Opcional en edición
    rol: [RolUsuario.CAJERO, [Validators.required]],
    estado: [EstadoRegistro.ACTIVO, [Validators.required]]
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editMode.set(true);
      this.usuarioId.set(Number(id));
      this.cargarUsuario(Number(id));
      // Password no es obligatorio en edición
      this.usuarioForm.get('password')?.setValidators(null);
    } else {
      // Password obligatorio en creación
      this.usuarioForm.get('password')?.setValidators([Validators.required, Validators.minLength(3)]);
    }
  }

  async cargarUsuario(id: number) {
    this.loading.set(true);
    try {
      const usuario = await this.usuariosService.obtenerPorId(id);
      if (usuario) {
        this.usuarioForm.patchValue({
          nombre: usuario.nombre,
          username: usuario.username,
          rol: usuario.rol,
          estado: usuario.estado
        });
      }
    } catch (error) {
      this.alertService.error('Error al cargar datos del usuario.');
    } finally {
      this.loading.set(false);
    }
  }

  async guardar() {
    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const data = this.usuarioForm.value;
      if (this.editMode()) {
        await this.usuariosService.actualizar(this.usuarioId()!, data);
        this.alertService.success('Usuario actualizado correctamente.');
      } else {
        await this.usuariosService.crear(data);
        this.alertService.success('Usuario creado correctamente.');
      }
      this.router.navigate(['/configuracion/usuarios']);
    } catch (error: any) {
      this.alertService.error('Error al guardar: ' + error.message);
    } finally {
      this.loading.set(false);
    }
  }

  volver() {
    this.router.navigate(['/configuracion/usuarios']);
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }
}

