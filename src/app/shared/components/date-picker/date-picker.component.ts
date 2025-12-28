import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

/**
 * Componente selector de fecha con formato local
 * Implementa ControlValueAccessor para integración con Angular Forms
 * 
 * @example
 * <app-date-picker
 *   label="Fecha de vencimiento"
 *   [formControl]="fechaControl"
 *   [min]="minDate"
 *   [max]="maxDate"
 * ></app-date-picker>
 */
@Component({
    selector: 'app-date-picker',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => DatePickerComponent),
            multi: true
        }
    ],
    templateUrl: './date-picker.component.html',
    styles: []
})
export class DatePickerComponent implements ControlValueAccessor {
    @Input() label?: string;
    @Input() required = false;
    @Input() disabled = false;
    @Input() isReadOnly = false;
    @Input() min?: string;
    @Input() max?: string;
    @Input() errorMessage?: string;
    @Input() helpText?: string;
    @Input() hasError = false;

    inputId = `date-picker-${Math.random().toString(36).substr(2, 9)}`;
    value: string = '';

    onChange: any = () => { };
    onTouched: any = () => { };

    get inputClasses(): string {
        const baseClasses = 'w-full px-4 py-3 bg-white border rounded-2xl transition-all duration-500 focus:outline-none text-sm appearance-none shadow-sm';
        const stateClasses = this.hasError
            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'border-gray-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 hover:border-primary-200 hover:shadow-md';
        const disabledClasses = (this.disabled || this.isReadOnly) ? 'bg-gray-50/50 backdrop-blur-sm text-gray-500 cursor-not-allowed border-gray-200 shadow-none' : '';

        return `${baseClasses} ${stateClasses} ${disabledClasses}`;
    }

    onInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.value = input.value;
        this.onChange(this.value);
    }

    writeValue(value: any): void {
        if (value instanceof Date) {
            this.value = this.formatDate(value);
        } else if (typeof value === 'string') {
            this.value = value;
        } else {
            this.value = '';
        }
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled;
    }

    /**
     * Formatea una fecha a YYYY-MM-DD para el input type="date"
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
