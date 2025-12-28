import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

/**
 * Componente de input reutilizable con validación y label
 * Implementa ControlValueAccessor para integración con Angular Forms
 * 
 * @example
 * <app-input
 *   label="Nombre"
 *   placeholder="Ingrese el nombre"
 *   [formControl]="nombreControl"
 *   errorMessage="El nombre es requerido"
 * ></app-input>
 */
@Component({
    selector: 'app-input',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputComponent),
            multi: true
        }
    ],
    templateUrl: './input.component.html',
    styles: []
})
export class InputComponent implements ControlValueAccessor {
    @Input() label?: string;
    @Input() placeholder = '';
    @Input() type: 'text' | 'number' | 'email' | 'password' | 'tel' | 'date' = 'text';
    @Input() required = false;
    @Input() disabled = false;
    @Input() isReadOnly = false;
    @Input() errorMessage?: string;
    @Input() helpText?: string;
    @Input() hasError = false;

    inputId = `input-${Math.random().toString(36).substr(2, 9)}`;
    value: any = '';

    onChange: any = () => { };
    onTouched: any = () => { };

    get inputClasses(): string {
        const baseClasses = 'w-full px-4 py-3 bg-white border rounded-2xl transition-all duration-500 focus:outline-none text-sm placeholder-gray-400 shadow-sm';
        const stateClasses = this.hasError
            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'border-gray-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 hover:border-primary-200 hover:shadow-md';
        const disabledClasses = (this.disabled || this.isReadOnly) ? 'bg-gray-50/50 backdrop-blur-sm text-gray-500 cursor-not-allowed border-gray-200 shadow-none' : '';

        return `${baseClasses} ${stateClasses} ${disabledClasses}`;
    }

    onInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.value = this.type === 'number' ? input.valueAsNumber : input.value;
        this.onChange(this.value);
    }

    writeValue(value: any): void {
        this.value = value || '';
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
}
