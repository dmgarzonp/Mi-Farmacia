import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Componente modal reutilizable con content projection
 * 
 * @example
 * <app-modal
 *   [isOpen]="showModal"
 *   title="Confirmar acción"
 *   size="md"
 *   (closed)="showModal = false"
 * >
 *   <div class="modal-body">Contenido del modal</div>
 *   <div class="modal-footer">
 *     <app-button (clicked)="handleConfirm()">Confirmar</app-button>
 *   </div>
 * </app-modal>
 */
@Component({
    selector: 'app-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './modal.component.html',
    styles: []
})
export class ModalComponent {
    @Input() isOpen = false;
    @Input() title?: string;
    @Input() size: ModalSize = 'md';
    @Input() closeOnBackdrop = true;
    @Input() showCloseButton = true;

    @Output() closed = new EventEmitter<void>();

    get modalClasses(): string {
        const baseClasses = 'relative bg-white shadow-lg transform transition-all rounded-2xl overflow-hidden border border-gray-100';

        const sizeClasses = {
            sm: 'max-w-md w-full',
            md: 'max-w-lg w-full',
            lg: 'max-w-2xl w-full',
            xl: 'max-w-5xl w-full',
        };

        return `${baseClasses} ${sizeClasses[this.size]}`;
    }

    onBackdropClick(): void {
        if (this.closeOnBackdrop) {
            this.close();
        }
    }

    close(): void {
        this.closed.emit();
    }
}
