import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'warning' | 'success';
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  private resolveConfirm?: (value: boolean) => void;
  
  isOpen = signal(false);
  options = signal<ConfirmOptions>({
    title: '¿Estás seguro?',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'primary'
  });

  ask(options: ConfirmOptions): Promise<boolean> {
    this.options.set({
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      variant: 'primary',
      ...options
    });
    
    this.isOpen.set(true);
    
    return new Promise((resolve) => {
      this.resolveConfirm = resolve;
    });
  }

  confirm(): void {
    this.isOpen.set(false);
    this.resolveConfirm?.(true);
  }

  cancel(): void {
    this.isOpen.set(false);
    this.resolveConfirm?.(false);
  }
}

