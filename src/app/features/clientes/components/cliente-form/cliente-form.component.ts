import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ClientesService } from '../../services/clientes.service';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SafeHtmlPipe],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center gap-4 mb-2">
        <div class="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shadow-sm">
          <span class="w-6 h-6" [innerHTML]="icons.USERS | safeHtml"></span>
        </div>
        <div>
          <h2 class="text-lg font-black text-slate-800 uppercase tracking-tight">Registro de Cliente</h2>
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Datos para Facturación Electrónica</p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="guardar()" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <app-input 
            label="Identificación (Cédula/RUC)" 
            formControlName="documento" 
            placeholder="Ej: 1712345678001" 
            [required]="true"
          ></app-input>
          
          <app-input 
            label="Nombre Completo / Razón Social" 
            formControlName="nombreCompleto" 
            placeholder="Ej: Juan Pérez" 
            [required]="true"
          ></app-input>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <app-input 
            label="Correo Electrónico" 
            formControlName="email" 
            placeholder="ejemplo@correo.com" 
            type="email"
          ></app-input>
          
          <app-input 
            label="Teléfono" 
            formControlName="telefono" 
            placeholder="Ej: 0991234567"
          ></app-input>
        </div>

        <app-input 
          label="Dirección" 
          formControlName="direccion" 
          placeholder="Calle Principal y Secundaria"
        ></app-input>

        <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <app-button variant="secondary" (clicked)="cancelar.emit()">
            Cancelar
          </app-button>
          <app-button variant="success" [disabled]="form.invalid || cargando" [loading]="cargando" type="submit">
            Guardar y Seleccionar
          </app-button>
        </div>
      </form>
    </div>
  `
})
export class ClienteFormComponent {
  private fb = inject(FormBuilder);
  private clientesService = inject(ClientesService);
  private alertService = inject(AlertService);

  @Output() saved = new EventEmitter<number>();
  @Output() cancelar = new EventEmitter<void>();

  icons = APP_ICONS;
  cargando = false;

  form: FormGroup = this.fb.group({
    documento: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(13)]],
    nombreCompleto: ['', Validators.required],
    email: ['', [Validators.email]],
    telefono: [''],
    direccion: ['']
  });

  async guardar() {
    if (this.form.invalid) return;

    this.cargando = true;
    try {
      const clienteId = await this.clientesService.crear(this.form.value);
      this.alertService.success('Cliente registrado correctamente');
      this.saved.emit(clienteId);
    } catch (error: any) {
      this.alertService.error('Error al registrar cliente: ' + error.message);
    } finally {
      this.cargando = false;
    }
  }
}

