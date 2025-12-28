import { Injectable, signal } from '@angular/core';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { APP_ICONS } from '../../../core/constants/icons';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface Alert {
    id: string;
    type: AlertType;
    message: string;
    duration?: number;
}

/**
 * Servicio para mostrar notificaciones toast
 */
@Injectable({
    providedIn: 'root'
})
export class AlertService {
    alerts = signal<Alert[]>([]);

    show(type: AlertType, message: string, duration = 3000): void {
        const id = Math.random().toString(36).substr(2, 9);
        const alert: Alert = { id, type, message, duration };

        this.alerts.update(alerts => [...alerts, alert]);

        if (duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, duration);
        }
    }

    success(message: string, duration = 3000): void {
        this.show('success', message, duration);
    }

    error(message: string, duration = 4000): void {
        this.show('error', message, duration);
    }

    warning(message: string, duration = 3500): void {
        this.show('warning', message, duration);
    }

    info(message: string, duration = 3000): void {
        this.show('info', message, duration);
    }

    remove(id: string): void {
        this.alerts.update(alerts => alerts.filter(a => a.id !== id));
    }
}

/**
 * Componente de notificaciones toast
 * Debe incluirse en el app.component.html
 * 
 * @example
 * <app-alert></app-alert>
 */
@Component({
    selector: 'app-alert',
    standalone: true,
    imports: [CommonModule, SafeHtmlPipe],
    templateUrl: './alert.component.html',
    styles: []
})
export class AlertComponent {
    constructor(public alertService: AlertService) { }

    getAlertClasses(type: AlertType): string {
        const baseClasses = 'min-w-[320px] max-w-md p-4 rounded-2xl shadow-premium backdrop-blur-md border border-white/20';

        const typeClasses = {
            success: 'bg-emerald-50/90 text-emerald-900 border-l-4 border-emerald-500',
            error: 'bg-red-50/90 text-red-900 border-l-4 border-red-500',
            warning: 'bg-amber-50/90 text-amber-900 border-l-4 border-amber-500',
            info: 'bg-primary-50/90 text-primary-900 border-l-4 border-primary-500',
        };

        return `${baseClasses} ${typeClasses[type]}`;
    }

    getIcon(type: AlertType): string {
        const icons = {
            success: APP_ICONS.CHECK,
            error: APP_ICONS.ERROR,
            warning: APP_ICONS.ALERT,
            info: APP_ICONS.INFO,
        };
        return icons[type];
    }
}
