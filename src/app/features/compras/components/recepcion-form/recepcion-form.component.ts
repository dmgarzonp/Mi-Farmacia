import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { OrdenCompra, DetalleOrdenCompra } from '../../../../core/models';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';
import { ProductosService } from '../../../productos/services/productos.service';

@Component({
  selector: 'app-recepcion-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, DatePickerComponent, SafeHtmlPipe, CurrencyFormatPipe],
  template: `
    <div class="space-y-6">
      <div class="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-blue-500 shadow-sm">
          <span class="w-6 h-6 block" [innerHTML]="icons.BOXES | safeHtml"></span>
        </div>
        <div>
          <h4 class="text-sm font-black text-blue-900 uppercase tracking-wider">Recepción de Mercancía</h4>
          <p class="text-[11px] text-blue-700 font-bold uppercase tracking-tighter">Verifique cantidades y precios finales, e ingrese lotes/vencimientos</p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <div formArrayName="detalles" class="max-h-[50vh] overflow-y-auto pr-2 space-y-6">
          <div *ngFor="let det of detalles.controls; let i = index" [formGroupName]="i" 
               class="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-5">
            
            <div class="flex items-center justify-between border-b border-gray-50 pb-3">
              <div class="flex flex-col">
                <span class="text-xs font-black text-gray-800 uppercase tracking-widest">
                  {{ orden?.detalles?.[i]?.productoNombre }}
                </span>
                <span class="text-[10px] text-primary-600 font-bold uppercase tracking-tighter">
                  Presentación: {{ orden?.detalles?.[i]?.presentacionNombre }}
                </span>
                <span class="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter mt-1">
                  Pedido original: {{ orden?.detalles?.[i]?.cantidad }} CAJAS
                </span>
              </div>
              <div class="text-right">
                <span class="text-[9px] text-gray-400 font-bold uppercase tracking-widest block">Subtotal</span>
                <span class="text-sm font-black text-primary-600">
                  {{ (det.get('cantidad')?.value * det.get('precioUnitario')?.value) | currencyFormat }}
                </span>
              </div>
            </div>

            <!-- Fila 1: Cantidad y Precio (Editables en recepción) -->
            <div class="grid grid-cols-2 gap-4">
              <app-input
                label="Cant. Cajas Recibidas"
                type="number"
                formControlName="cantidad"
                [required]="true"
                [hasError]="!!(det.get('cantidad')?.invalid && det.get('cantidad')?.touched)"
              ></app-input>

              <app-input
                label="Precio x Caja Real"
                type="number"
                formControlName="precioUnitario"
                [required]="true"
                [hasError]="!!(det.get('precioUnitario')?.invalid && det.get('precioUnitario')?.touched)"
              ></app-input>
            </div>

            <!-- Fila 2: Lote y Vencimiento -->
            <div class="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
              <app-input
                label="Nº de Lote"
                formControlName="lote"
                placeholder="Obligatorio"
                [required]="true"
                [hasError]="!!(det.get('lote')?.invalid && det.get('lote')?.touched)"
              ></app-input>

              <app-date-picker
                label="Fecha Vencimiento"
                formControlName="fechaVencimiento"
                [required]="true"
                [hasError]="!!(det.get('fechaVencimiento')?.invalid && det.get('fechaVencimiento')?.touched)"
              ></app-date-picker>
            </div>
          </div>
        </div>

        <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-center justify-between">
          <div>
            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nuevo Total Recepción</p>
            <p class="text-2xl font-black text-gray-900">{{ totalRecepcion | currencyFormat }}</p>
          </div>
          <div class="flex gap-3">
            <app-button variant="secondary" (clicked)="cancel.emit()">Cancelar</app-button>
            <app-button type="submit" variant="primary" [disabled]="form.invalid || loading" [loading]="loading">
              Confirmar Ingreso Total
            </app-button>
          </div>
        </div>
      </form>
    </div>
  `,
  styles: [`
    :host { display: block; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
  `]
})
export class RecepcionFormComponent implements OnInit {
  @Input() orden?: OrdenCompra;
  @Input() loading = false;
  @Output() saved = new EventEmitter<{detalles: DetalleOrdenCompra[], total: number}>();
  @Output() cancel = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private productosService = inject(ProductosService);
  icons = APP_ICONS;
  form!: FormGroup;
  totalRecepcion = 0;

  async ngOnInit() {
    this.form = this.fb.group({
      detalles: this.fb.array([])
    });

    if (this.orden?.detalles) {
      for (const d of this.orden.detalles) {
        // Buscar meses de vencimiento predeterminados
        let fechaSugerida = '';
        try {
          const prod = await this.productosService.obtenerPorId(d.presentacionId); // Realmente necesitamos la presentación
          // Nota: d.presentacionId es el ID de la presentación en el nuevo modelo
          // Buscamos la presentación directamente para obtener los meses
          const presSql = `SELECT vencimiento_predeterminado_meses FROM presentaciones WHERE id = ?`;
          const pres = await this.productosService.db.get<any>(presSql, [d.presentacionId]);
          fechaSugerida = this.productosService.sugerirFechaVencimiento(pres?.vencimiento_predeterminado_meses || 24);
        } catch (e) {
          fechaSugerida = this.productosService.sugerirFechaVencimiento(24);
        }

        const group = this.fb.group({
          presentacionId: [d.presentacionId],
          cantidad: [d.cantidad, [Validators.required, Validators.min(0.01)]],
          precioUnitario: [d.precioUnitario, [Validators.required, Validators.min(0)]],
          lote: [d.lote || '', Validators.required],
          fechaVencimiento: [d.fechaVencimiento || fechaSugerida, Validators.required]
        });
        
        group.valueChanges.subscribe(() => this.recalcularTotal());
        this.detalles.push(group);
      }
    }
    this.recalcularTotal();
  }

  get detalles(): FormArray {
    return this.form.get('detalles') as FormArray;
  }

  recalcularTotal() {
    this.totalRecepcion = this.detalles.controls.reduce((acc, curr) => {
      const cant = curr.get('cantidad')?.value || 0;
      const price = curr.get('precioUnitario')?.value || 0;
      return acc + (cant * price);
    }, 0);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    // Devolvemos tanto los detalles actualizados como el nuevo total
    this.saved.emit({
      detalles: this.form.value.detalles,
      total: this.totalRecepcion
    });
  }
}
