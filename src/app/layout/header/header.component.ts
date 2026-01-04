import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { APP_ICONS } from '../../core/constants/icons';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';
import { AuthService } from '../../core/services/auth.service';

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
}
