import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      [class]="skeletonClasses" 
      [style.width]="width" 
      [style.height]="height"
    ></div>
  `,
  styles: [`
    @keyframes pulse-emerald {
      0%, 100% { opacity: 1; background-color: #f3f4f6; }
      50% { opacity: 0.5; background-color: #e5e7eb; }
    }
    .animate-skeleton {
      animation: pulse-emerald 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  `]
})
export class SkeletonComponent {
  @Input() width: string = '100%';
  @Input() height: string = '1rem';
  @Input() variant: 'rect' | 'circle' | 'text' = 'rect';
  @Input() className: string = '';

  get skeletonClasses(): string {
    const base = 'animate-skeleton bg-gray-200';
    const rounded = {
      'rect': 'rounded-lg',
      'circle': 'rounded-full',
      'text': 'rounded'
    }[this.variant];
    
    return `${base} ${rounded} ${this.className}`;
  }
}

