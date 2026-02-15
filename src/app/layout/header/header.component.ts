import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { APP_ICONS } from '../../core/constants/icons';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { ConfirmService } from '../../shared/services/confirm.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';

/**
 * Componente de header/barra superior moderno
 */
@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule, RouterModule, SafeHtmlPipe, TooltipDirective],
    templateUrl: './header.component.html',
    styles: []
})
export class HeaderComponent implements OnInit {
    authService = inject(AuthService);
    confirmService = inject(ConfirmService);
    notificationsService = inject(NotificationsService);
    title = 'Mi Farmacia';
    icons = APP_ICONS;
    notificationsOpen = signal(false);

    ngOnInit() {
        this.notificationsService.loadAlerts();
    }

    async toggleNotifications() {
        this.notificationsOpen.update((v) => !v);
        if (this.notificationsOpen()) {
            await this.notificationsService.loadAlerts();
        }
    }

    closeNotifications() {
        this.notificationsOpen.set(false);
    }

    get currentDate(): string {
        return new Date().toLocaleDateString('es-ES', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    async logout() {
        const confirmado = await this.confirmService.ask({
            title: 'Cerrar Sesión',
            message: '¿Está seguro de que desea salir del sistema?',
            confirmText: 'Sí, Salir',
            variant: 'danger'
        });

        if (confirmado) {
            this.authService.logout();
        }
    }
}
