import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { APP_ICONS } from '../../../core/constants/icons';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type AppIconName = keyof typeof APP_ICONS;

/**
 * Componente de botón reutilizable con variantes y tamaños
 * 
 * @example
 * <app-button variant="primary" size="md" (clicked)="handleClick()">
 *   Guardar
 * </app-button>
 */
@Component({
    selector: 'app-button',
    standalone: true,
    imports: [CommonModule, SafeHtmlPipe],
    templateUrl: './button.component.html',
    styles: []
})
export class ButtonComponent {
    @Input() variant: ButtonVariant = 'primary';
    @Input() size: ButtonSize = 'md';
    @Input() type: 'button' | 'submit' | 'reset' = 'button';
    @Input() disabled = false;
    @Input() loading = false;
    @Input() iconLeft?: string;
    @Input() iconRight?: string;
    @Input() iconNameLeft?: AppIconName;
    @Input() iconNameRight?: AppIconName;
    @Input() fullWidth = false;

    @Output() clicked = new EventEmitter<Event>();

    get leftIconHtml(): string | undefined {
        if (this.iconNameLeft && APP_ICONS[this.iconNameLeft]) {
            return APP_ICONS[this.iconNameLeft];
        }
        return this.iconLeft;
    }

    get rightIconHtml(): string | undefined {
        if (this.iconNameRight && APP_ICONS[this.iconNameRight]) {
            return APP_ICONS[this.iconNameRight];
        }
        return this.iconRight;
    }

    get iconSizeClass(): string {
        switch (this.size) {
            case 'sm': return 'w-4 h-4';
            case 'lg': return 'w-6 h-6';
            default: return 'w-5 h-5';
        }
    }

    get buttonClasses(): string {
        const baseClasses = 'inline-flex items-center justify-center font-bold rounded-2xl transition-all duration-500 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed border-0';

        const variantClasses = {
            primary: 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-premium-hover hover:-translate-y-1 focus:ring-primary-500/20 shadow-premium',
            secondary: 'bg-white text-gray-700 border border-gray-100 hover:bg-gray-50 hover:shadow-md focus:ring-gray-300/20 shadow-sm',
            outline: 'bg-transparent text-primary-600 border-2 border-primary-600 hover:bg-primary-50 focus:ring-primary-500/20',
            danger: 'bg-red-500 text-white hover:bg-red-600 hover:shadow-red-500/20 hover:-translate-y-1 focus:ring-red-500/20 shadow-premium',
            success: 'bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-emerald-500/20 hover:-translate-y-1 focus:ring-emerald-500/20 shadow-premium',
            warning: 'bg-amber-500 text-white hover:bg-amber-600 hover:shadow-amber-500/20 hover:-translate-y-1 focus:ring-amber-500/20 shadow-premium',
        };

        const sizeClasses = {
            sm: 'px-4 py-2 text-sm gap-2',
            md: 'px-6 py-2.5 text-base gap-2.5',
            lg: 'px-8 py-3 text-lg gap-3',
        };

        const widthClass = this.fullWidth ? 'w-full' : '';

        return `${baseClasses} ${variantClasses[this.variant]} ${sizeClasses[this.size]} ${widthClass}`;
    }

    handleClick(event: Event): void {
        if (!this.disabled && !this.loading) {
            this.clicked.emit(event);
        }
    }
}
