import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { APP_ICONS } from '../../core/constants/icons';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-title-bar',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe],
  template: `
    <div class="h-8 bg-primary-900 border-b border-primary-800 flex items-center justify-between px-3 drag-region z-50 select-none shadow-sm">
      <!-- App Name con contraste máximo -->
      <div class="flex items-center gap-2 no-drag-region">
        <div class="w-4 h-4 bg-emerald-400 rounded flex items-center justify-center text-[7px] text-primary-950 font-black shadow-inner">
          MF
        </div>
        <span class="text-[10px] font-bold text-white uppercase tracking-[0.2em]">
          Mi Farmacia
          <span class="text-emerald-400 ml-1 font-semibold lowercase tracking-normal">| salud & bienestar</span>
        </span>
      </div>

      <!-- Window Controls con Colores Sólidos y Visibles -->
      <div class="flex items-center no-drag-region h-full">
        <button 
          (click)="minimize()"
          class="h-full px-4 text-white hover:bg-primary-800 transition-all flex items-center"
          title="Minimizar"
        >
          <span class="w-4 h-4 block" [innerHTML]="icons.MINIMIZE | safeHtml"></span>
        </button>
        
        <button 
          (click)="maximize()"
          class="h-full px-4 text-white hover:bg-primary-800 transition-all flex items-center"
          title="Maximizar"
        >
          <span class="w-3.5 h-3.5 block" [innerHTML]="icons.MAXIMIZE | safeHtml"></span>
        </button>
        
        <button 
          (click)="close()"
          class="h-full px-5 text-white hover:bg-primary-800 transition-all flex items-center group"
          title="Cerrar"
        >
          <span class="w-4 h-4 block transition-transform duration-300 group-hover:rotate-90" [innerHTML]="icons.CLOSE | safeHtml"></span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 100;
    }
  `]
})
export class TitleBarComponent {
  icons = APP_ICONS;

  minimize(): void {
    (window as any).electronAPI?.windowMinimize();
  }

  maximize(): void {
    (window as any).electronAPI?.windowMaximize();
  }

  close(): void {
    (window as any).electronAPI?.windowClose();
  }
}

