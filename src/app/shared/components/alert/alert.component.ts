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

    success(message: string, duration = 5000): void {
        this.show('success', message, duration);
    }

    error(message: string, duration = 7000): void {
        this.show('error', message, duration);
    }

    warning(message: string, duration = 5500): void {
        this.show('warning', message, duration);
    }

    info(message: string, duration = 5000): void {
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
        const baseClasses = 'w-full p-4 rounded-xl shadow-xl backdrop-blur-md border';

        const typeClasses = {
            success: 'bg-emerald-50/95 text-emerald-900 border-emerald-200 border-l-4 border-l-emerald-500',
            error: 'bg-red-50/95 text-red-900 border-red-200 border-l-4 border-l-red-500',
            warning: 'bg-amber-50/95 text-amber-900 border-amber-200 border-l-4 border-l-amber-500',
            info: 'bg-sky-50/95 text-sky-900 border-sky-200 border-l-4 border-l-sky-500',
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
