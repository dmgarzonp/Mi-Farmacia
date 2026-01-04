import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { APP_ICONS } from '../../core/constants/icons';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
    label: string;
    icon: string;
    route: string;
    children?: NavItem[];
}

/**
 * Componente de sidebar profesional y colapsable
 * Incluye navegación jerárquica, estado activo, y animaciones suaves
 */
@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterModule, SafeHtmlPipe],
    templateUrl: './sidebar.component.html',
    styles: []
})
export class SidebarComponent {
    authService = inject(AuthService);
    isCollapsed = signal(false);
    icons = APP_ICONS;

    get sidebarClasses(): string {
        const baseClasses = 'h-full bg-primary-900/95 backdrop-blur-md text-white flex flex-col transition-all duration-500 shadow-premium z-40 border-r border-primary-800/20';
        const widthClass = this.isCollapsed() ? 'w-20' : 'w-72';
        return `${baseClasses} ${widthClass}`;
    }

    get navItemClasses(): string {
        return 'flex items-center gap-3 px-4 py-3 rounded-xl text-primary-100 hover:bg-primary-700/50 hover:text-white transition-all duration-300 cursor-pointer group';
    }

    toggleSidebar(): void {
        this.isCollapsed.update(collapsed => !collapsed);
    }
}
