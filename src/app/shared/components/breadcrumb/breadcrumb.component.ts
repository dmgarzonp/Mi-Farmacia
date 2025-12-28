import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BreadcrumbService } from '../../services/breadcrumb.service';
import { APP_ICONS } from '../../../core/constants/icons';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule, SafeHtmlPipe],
  template: `
    <nav *ngIf="breadcrumbService.breadcrumbs().length > 0" class="flex mb-6 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide animate-fade-in" aria-label="Breadcrumb">
      <ol class="flex items-center space-x-3 text-sm font-semibold bg-white/40 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/40 shadow-sm">
        <li>
          <a routerLink="/dashboard" class="text-gray-400 hover:text-primary-600 transition-all duration-300 flex items-center hover:scale-110">
            <span class="w-4 h-4" [innerHTML]="icons.DASHBOARD | safeHtml"></span>
            <span class="sr-only">Dashboard</span>
          </a>
        </li>
        
        <li *ngFor="let breadcrumb of breadcrumbService.breadcrumbs(); let last = last" class="flex items-center space-x-3">
          <span class="text-gray-300 w-3 h-3 flex items-center opacity-50" [innerHTML]="icons.CHEVRON_RIGHT | safeHtml"></span>
          
          <a 
            *ngIf="!last" 
            [routerLink]="breadcrumb.url" 
            class="text-gray-400 hover:text-primary-600 transition-all duration-300 hover:translate-x-0.5"
          >
            {{ breadcrumb.label }}
          </a>
          
          <span 
            *ngIf="last" 
            class="text-primary-600 font-black tracking-tight"
          >
            {{ breadcrumb.label }}
          </span>
        </li>
      </ol>
    </nav>
  `,
  styles: [`
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `]
})
export class BreadcrumbComponent {
  breadcrumbService = inject(BreadcrumbService);
  icons = APP_ICONS;
}

