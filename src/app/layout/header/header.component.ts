import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { APP_ICONS } from '../../core/constants/icons';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../shared/services/confirm.service';

/**
 * Componente de header/barra superior moderno
 */
@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule, SafeHtmlPipe],
    templateUrl: './header.component.html',
    styles: []
})
export class HeaderComponent {
    authService = inject(AuthService);
    confirmService = inject(ConfirmService);
    title = 'Mi Farmacia';
    icons = APP_ICONS;

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
