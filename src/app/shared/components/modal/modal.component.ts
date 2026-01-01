import { Component, Input, Output, EventEmitter, signal, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

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
export class ModalComponent implements OnChanges, OnDestroy {
    @Input() isOpen = false;
    @Input() title?: string;
    @Input() size: ModalSize = 'md';
    @Input() closeOnBackdrop = false;
    @Input() showCloseButton = true;

    @Output() closed = new EventEmitter<void>();

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isOpen']) {
            this.handleOverflow(this.isOpen);
        }
    }

    ngOnDestroy(): void {
        this.handleOverflow(false);
    }

    private handleOverflow(isOpen: boolean): void {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = isOpen ? 'hidden' : 'auto';
        }
    }

    get modalClasses(): string {
        const baseClasses = 'relative bg-white shadow-lg transform transition-all rounded-lg overflow-hidden border border-gray-100';

        const sizeClasses = {
            sm: 'max-w-md w-full',
            md: 'max-w-lg w-full',
            lg: 'max-w-2xl w-full',
            xl: 'max-w-5xl w-full',
            '2xl': 'max-w-[1400px] w-full',
            full: 'max-w-[95vw] w-full',
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
