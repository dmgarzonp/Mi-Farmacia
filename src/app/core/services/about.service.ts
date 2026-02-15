import { Injectable, signal } from '@angular/core';

/**
 * Servicio para abrir/cerrar el modal Acerca de desde cualquier parte de la app.
 */
@Injectable({
  providedIn: 'root'
})
export class AboutService {
  isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
