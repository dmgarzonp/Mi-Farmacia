import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { SriService } from '../../../../core/services/sri.service';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-sri-config-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SafeHtmlPipe],
  template: `
    <div class="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <!-- Header -->
      <div class="flex items-center justify-between bg-white p-6 rounded-[0.5rem] border border-slate-200 shadow-sm">
        <div class="flex items-center gap-5">
          <div class="w-14 h-14 rounded-[0.5rem] bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
            <span class="w-7 h-7" [innerHTML]="icons.VERIFIED | safeHtml"></span>
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Configuración SRI</h1>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Facturación Electrónica Ecuador</p>
          </div>
        </div>
        <app-button variant="success" iconNameLeft="SAVE" [disabled]="form.invalid" (clicked)="guardar()">
          Guardar Configuración
        </app-button>
      </div>

      <form [formGroup]="form" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Panel 1: Datos de la Empresa -->
        <div class="bg-white border border-slate-200 rounded-[0.5rem] p-6 shadow-sm space-y-5">
          <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span class="w-1.5 h-3 bg-indigo-500 rounded-full"></span>
            1. Datos del Emisor
          </h2>
          
          <app-input label="RUC de la Empresa" formControlName="ruc" placeholder="Ej: 1712345678001" [required]="true"></app-input>
          <app-input label="Razón Social" formControlName="razonSocial" placeholder="Ej: Farmacia La Esperanza S.A." [required]="true"></app-input>
          <app-input label="Nombre Comercial" formControlName="nombreComercial" placeholder="Ej: Mi Farmacia"></app-input>
          <app-input label="Dirección Matriz" formControlName="direccionMatriz" [required]="true"></app-input>
          
          <div class="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <span class="text-xs font-bold text-slate-600 uppercase">Obligado a llevar Contabilidad</span>
            <select formControlName="obligadoContabilidad" class="bg-white border border-slate-200 rounded px-3 py-1 text-xs font-black focus:ring-2 focus:ring-indigo-500/20 outline-none">
              <option value="SI">SÍ</option>
              <option value="NO">NO</option>
            </select>
          </div>
        </div>

        <!-- Panel 2: Punto de Emisión y Ambiente -->
        <div class="space-y-6">
          <div class="bg-white border border-slate-200 rounded-[0.5rem] p-6 shadow-sm space-y-5">
            <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span class="w-1.5 h-3 bg-emerald-500 rounded-full"></span>
              2. Punto de Emisión
            </h2>
            
            <div class="grid grid-cols-2 gap-4">
              <app-input label="Establecimiento" formControlName="establecimiento" placeholder="001" [required]="true"></app-input>
              <app-input label="Punto Emisión" formControlName="puntoEmision" placeholder="001" [required]="true"></app-input>
            </div>

            <div class="space-y-2">
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ambiente SRI</label>
              <div class="grid grid-cols-2 gap-2">
                <button type="button" 
                  (click)="form.get('ambiente')?.setValue('1')"
                  [class]="form.get('ambiente')?.value === '1' ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-slate-500 border-slate-200'"
                  class="flex flex-col items-center justify-center p-3 rounded-[0.5rem] border transition-all">
                  <span class="text-xs font-black">PRUEBAS</span>
                  <span class="text-[8px] uppercase font-bold opacity-80">Sin valor legal</span>
                </button>
                <button type="button" 
                  (click)="form.get('ambiente')?.setValue('2')"
                  [class]="form.get('ambiente')?.value === '2' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-500 border-slate-200'"
                  class="flex flex-col items-center justify-center p-3 rounded-[0.5rem] border transition-all">
                  <span class="text-xs font-black">PRODUCCIÓN</span>
                  <span class="text-[8px] uppercase font-bold opacity-80">Validez Tributaria</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Panel 3: Firma Electrónica -->
          <div class="bg-slate-900 text-white rounded-[0.5rem] p-6 shadow-xl space-y-5">
            <h2 class="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span class="w-1.5 h-3 bg-indigo-500 rounded-full"></span>
              3. Firma Electrónica (.p12)
            </h2>
            
            <p class="text-[10px] text-slate-400 leading-relaxed uppercase font-bold">
              Para emitir facturas reales, debes cargar tu archivo .p12 y su contraseña. Estos datos se cifran localmente.
            </p>

            <app-input label="Ruta del Archivo .p12" formControlName="rutaFirmaP12" placeholder="C:/MisDoc/firma.p12" class="dark-input"></app-input>
            <app-input label="Contraseña de la Firma" type="password" formControlName="passwordFirma" placeholder="••••••••" class="dark-input"></app-input>
          </div>
        </div>
      </form>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .dark-input ::ng-deep label { color: #94a3b8 !important; }
    .dark-input ::ng-deep input { background-color: #1e293b !important; border-color: #334155 !important; color: white !important; }
  `]
})
export class SriConfigFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private sriService = inject(SriService);
  private alertService = inject(AlertService);
  
  icons = APP_ICONS;
  form!: FormGroup;

  ngOnInit() {
    const currentConfig = this.sriService.config();
    
    this.form = this.fb.group({
      ruc: [currentConfig.ruc, [Validators.required, Validators.pattern(/^[0-9]{13}$/)]],
      razonSocial: [currentConfig.razonSocial, Validators.required],
      nombreComercial: [currentConfig.nombreComercial],
      establecimiento: [currentConfig.establecimiento, [Validators.required, Validators.pattern(/^[0-9]{3}$/)]],
      puntoEmision: [currentConfig.puntoEmision, [Validators.required, Validators.pattern(/^[0-9]{3}$/)]],
      direccionMatriz: [currentConfig.direccionMatriz, Validators.required],
      ambiente: [currentConfig.ambiente, Validators.required],
      tipoEmision: ['1'],
      obligadoContabilidad: [currentConfig.obligadoContabilidad || 'NO', Validators.required],
      rutaFirmaP12: [currentConfig.rutaFirmaP12 || ''],
      passwordFirma: [currentConfig.passwordFirma || '']
    });
  }

  guardar() {
    if (this.form.invalid) return;
    this.sriService.guardarConfiguracion(this.form.value);
    this.alertService.success('Configuración SRI guardada correctamente.');
  }
}




