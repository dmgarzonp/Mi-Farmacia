import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AboutService } from '../../../core/services/about.service';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { APP_INFO } from '../../../core/constants/app-info';

@Component({
  selector: 'app-about-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, ButtonComponent],
  template: `
    <app-modal
      [isOpen]="aboutService.isOpen()"
      title="Acerca de Mi Farmacia"
      size="md"
      (closed)="aboutService.close()"
    >
      <div class="flex flex-col">
        <div class="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div class="w-14 h-14 bg-primary-500 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
            MF
          </div>
          <div>
            <h2 class="text-xl font-black text-gray-900">{{ appInfo.appName }}</h2>
            <p class="text-sm text-gray-500 font-medium">Versión {{ appInfo.version }}</p>
          </div>
        </div>

        <p class="text-sm text-gray-600 mb-6 leading-relaxed">
          {{ appInfo.description }}
        </p>

        <dl class="space-y-3 text-sm">
          <div class="flex justify-between gap-4 py-2 border-b border-gray-50">
            <dt class="font-bold text-gray-500 uppercase tracking-wider">Autor</dt>
            <dd class="font-semibold text-gray-900 text-right">{{ appInfo.author }}</dd>
          </div>
          <div class="flex justify-between gap-4 py-2 border-b border-gray-50">
            <dt class="font-bold text-gray-500 uppercase tracking-wider">Versión</dt>
            <dd class="font-semibold text-gray-900">{{ appInfo.version }}</dd>
          </div>
          <div class="flex justify-between gap-4 py-2 border-b border-gray-50">
            <dt class="font-bold text-gray-500 uppercase tracking-wider">Licencia</dt>
            <dd class="font-semibold text-gray-900 text-right">{{ appInfo.license }}</dd>
          </div>
          <div class="py-2" *ngIf="logPath">
            <dt class="font-bold text-gray-500 uppercase tracking-wider mb-1">Archivo de log</dt>
            <dd class="text-gray-700 text-xs font-mono break-all leading-relaxed">{{ logPath }}</dd>
            <p class="text-[10px] text-gray-400 mt-1">En Windows: abra esta ruta para revisar errores del sistema.</p>
          </div>
          <div class="py-2">
            <dt class="font-bold text-gray-500 uppercase tracking-wider mb-1">Copyright</dt>
            <dd class="text-gray-700 text-xs leading-relaxed">{{ appInfo.copyright }}</dd>
          </div>
        </dl>

        <div class="mt-8 pt-6 border-t border-gray-100 flex justify-end">
          <app-button variant="primary" (clicked)="aboutService.close()" iconNameLeft="CHECK">
            Cerrar
          </app-button>
        </div>
      </div>
    </app-modal>
  `
})
export class AboutModalComponent implements OnInit {
  aboutService = inject(AboutService);
  appInfo = APP_INFO;
  logPath = '';

  ngOnInit() {
    if (typeof window !== 'undefined' && window.electronAPI?.getLogPath) {
      window.electronAPI.getLogPath().then((p) => (this.logPath = p || ''));
    }
  }
}
