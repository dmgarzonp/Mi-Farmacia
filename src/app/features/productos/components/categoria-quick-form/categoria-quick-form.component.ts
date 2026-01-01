import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CategoriasService } from '../../services/categorias.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-categoria-quick-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="guardar()" class="space-y-6 p-1">
      <app-input
        label="Nombre de la Categoría"
        formControlName="nombre"
        placeholder="Ej: Antibióticos, Vitaminas..."
        [required]="true"
        [hasError]="!!(form.get('nombre')?.invalid && form.get('nombre')?.touched)"
        errorMessage="El nombre es requerido (mín. 2 caracteres)"
      ></app-input>

      <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <app-button type="button" variant="secondary" (clicked)="cancelar.emit()" [disabled]="guardando()">
          Cancelar
        </app-button>
        <app-button type="submit" variant="primary" [disabled]="form.invalid || guardando()" iconNameLeft="SAVE">
          @if (guardando()) {
            Guardando...
          } @else {
            Registrar Categoría
          }
        </app-button>
      </div>
    </form>
  `
})
export class CategoriaQuickFormComponent {
  private fb = inject(FormBuilder);
  private categoriasService = inject(CategoriasService);
  private alertService = inject(AlertService);

  @Output() guardado = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  guardando = signal(false);
  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]]
  });

  async guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    try {
      await this.categoriasService.crear(this.form.value);
      this.alertService.success('Categoría creada con éxito');
      this.guardado.emit();
    } catch (error: any) {
      this.alertService.error('Error al crear categoría: ' + error.message);
    } finally {
      this.guardando.set(false);
    }
  }
}








