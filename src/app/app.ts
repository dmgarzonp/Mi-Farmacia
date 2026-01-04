import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { HeaderComponent } from './layout/header/header.component';
import { AlertComponent } from './shared/components/alert/alert.component';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';
import { BreadcrumbComponent } from './shared/components/breadcrumb/breadcrumb.component';
import { TitleBarComponent } from './layout/title-bar/title-bar.component';
import { AuthService } from './core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent, AlertComponent, ConfirmModalComponent, BreadcrumbComponent, TitleBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App { 
  authService = inject(AuthService);
}
