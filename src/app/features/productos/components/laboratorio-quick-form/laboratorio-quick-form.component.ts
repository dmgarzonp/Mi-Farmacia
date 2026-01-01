import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { LaboratoriosService } from '../../services/laboratorios.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-laboratorio-quick-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="guardar()" class="space-y-6 p-1">
      <app-input
        label="Nombre del Laboratorio"
        formControlName="nombre"
        placeholder="Ej: Pfizer, Genfar, Bayer..."
        [required]="true"
        [hasError]="!!(form.get('nombre')?.invalid && form.get('nombre')?.touched)"
        errorMessage="El nombre es obligatorio"
      ></app-input>

      <app-input
        label="País de Origen"
        formControlName="pais"
        placeholder="Ej: Ecuador, Colombia, Alemania..."
        [required]="true"
        [hasError]="!!(form.get('pais')?.invalid && form.get('pais')?.touched)"
        errorMessage="El país es obligatorio"
      ></app-input>

      <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <app-button type="button" variant="secondary" (clicked)="cancelar.emit()" [disabled]="guardando()">
          Cancelar
        </app-button>
        <app-button type="submit" variant="primary" [disabled]="form.invalid || guardando()" iconNameLeft="SAVE">
          {{ guardando() ? 'Guardando...' : 'Registrar Laboratorio' }}
        </app-button>
      </div>
    </form>
  `
})
export class LaboratorioQuickFormComponent {
  private fb = inject(FormBuilder);
  private laboratoriosService = inject(LaboratoriosService);
  private alertService = inject(AlertService);

  @Output() guardado = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  guardando = signal(false);
  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    pais: ['Ecuador', Validators.required]
  });

  async guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    try {
      await this.laboratoriosService.crear(this.form.value);
      this.alertService.success('Laboratorio registrado con éxito');
      this.guardado.emit();
    } catch (error: any) {
      this.alertService.error('Error al registrar laboratorio: ' + error.message);
    } finally {
      this.guardando.set(false);
    }
  }
}










