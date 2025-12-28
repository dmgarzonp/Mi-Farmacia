import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../services/confirm.service';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { APP_ICONS } from '../../../core/constants/icons';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, ButtonComponent, SafeHtmlPipe],
  template: `
    <app-modal
      [isOpen]="confirmService.isOpen()"
      [title]="confirmService.options().title"
      size="sm"
      (closed)="confirmService.cancel()"
    >
      <div class="flex flex-col items-center p-8 text-center bg-white/40 backdrop-blur-xl">
        <!-- Icono de Advertencia / Variante -->
        <div 
          [class]="iconBgClass"
          class="w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 animate-bounce-subtle shadow-premium border border-white/40"
        >
          <span 
            class="w-12 h-12" 
            [innerHTML]="getIcon() | safeHtml"
          ></span>
        </div>

        <h2 class="text-2xl font-black text-gray-900 mb-2 leading-tight">
          {{ confirmService.options().title }}
        </h2>

        <p class="text-gray-500 text-base font-bold leading-relaxed mb-10 px-4">
          {{ confirmService.options().message }}
        </p>

        <div class="flex gap-4 w-full">
          <app-button
            variant="secondary"
            class="flex-1"
            (clicked)="confirmService.cancel()"
            [fullWidth]="true"
          >
            {{ confirmService.options().cancelText }}
          </app-button>
          
          <app-button
            [variant]="confirmService.options().variant || 'primary'"
            class="flex-1"
            (clicked)="confirmService.confirm()"
            [fullWidth]="true"
          >
            {{ confirmService.options().confirmText }}
          </app-button>
        </div>
      </div>
    </app-modal>
  `
})
export class ConfirmModalComponent {
  confirmService = inject(ConfirmService);

  get iconBgClass(): string {
    const variant = this.confirmService.options().variant;
    switch (variant) {
      case 'danger': return 'bg-red-50 text-red-500 shadow-red-500/20';
      case 'warning': return 'bg-amber-50 text-amber-500 shadow-amber-500/20';
      case 'success': return 'bg-emerald-50 text-emerald-500 shadow-emerald-500/20';
      default: return 'bg-primary-50 text-primary-500 shadow-primary-500/20';
    }
  }

  getIcon(): string {
    const variant = this.confirmService.options().variant;
    switch (variant) {
      case 'danger': return APP_ICONS.ERROR;
      case 'warning': return APP_ICONS.ALERT;
      case 'success': return APP_ICONS.CHECK;
      default: return APP_ICONS.INFO;
    }
  }
}

