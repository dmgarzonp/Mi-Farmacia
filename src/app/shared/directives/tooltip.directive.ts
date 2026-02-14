import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  Renderer2,
  inject,
} from '@angular/core';

/**
 * Directiva de tooltip unificada para la aplicación.
 * Muestra un tooltip con el estilo de la UI (esmeralda/slate) en lugar del tooltip nativo del navegador.
 * Uso: [appTooltip]="'Texto del tooltip'" o appTooltip="Texto del tooltip"
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnInit, OnDestroy {
  @Input() appTooltip = '';

  private el = inject(ElementRef);
  private renderer = inject(Renderer2);

  private tooltipEl: HTMLElement | null = null;
  private showTimeout: ReturnType<typeof setTimeout> | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly SHOW_DELAY_MS = 400;
  private readonly HIDE_DELAY_MS = 100;

  ngOnInit(): void {
    const host = this.el.nativeElement as HTMLElement;
    // Evitar tooltip nativo (negro); usar aria-label solo si hay texto
    host.setAttribute('title', '');
    const text = (this.appTooltip ?? '').toString().trim();
    if (text) host.setAttribute('aria-label', text);

    this.renderer.listen(host, 'mouseenter', () => this.scheduleShow());
    this.renderer.listen(host, 'mouseleave', () => this.scheduleHide());
  }

  ngOnDestroy(): void {
    this.clearShowTimeout();
    this.clearHideTimeout();
    this.removeTooltip();
  }

  private scheduleShow(): void {
    this.clearHideTimeout();
    this.showTimeout = setTimeout(() => this.show(), this.SHOW_DELAY_MS);
  }

  private scheduleHide(): void {
    this.clearShowTimeout();
    this.hideTimeout = setTimeout(() => this.hide(), this.HIDE_DELAY_MS);
  }

  private clearShowTimeout(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
  }

  private clearHideTimeout(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  private show(): void {
    if (!this.appTooltip?.trim()) return;
    this.removeTooltip();

    const host = this.el.nativeElement as HTMLElement;
    const rect = host.getBoundingClientRect();

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'app-tooltip';
    this.tooltipEl.textContent = this.appTooltip.trim();
    document.body.appendChild(this.tooltipEl);

    const tipRect = this.tooltipEl.getBoundingClientRect();
    const gap = 8;
    let top = rect.top - tipRect.height - gap;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;

    const margin = 8;
    if (left < margin) left = margin;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tipRect.width - margin;
    }
    if (top < margin) {
      top = rect.bottom + gap;
    }

    this.tooltipEl.style.position = 'fixed';
    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.zIndex = '9999';
  }

  private hide(): void {
    this.removeTooltip();
  }

  private removeTooltip(): void {
    if (this.tooltipEl?.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
    }
    this.tooltipEl = null;
  }
}
