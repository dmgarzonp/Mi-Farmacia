import { Pipe, PipeTransform, inject } from '@angular/core';
import { DatabaseService } from '../../core/services/database.service';

/**
 * Pipe para formatear moneda de forma dinámica según la región del sistema operativo.
 * Uso: {{ valor | currencyFormat }}
 */
@Pipe({
  name: 'currencyFormat',
  standalone: true,
  pure: false // Necesario para que se actualice cuando cambie el locale (aunque suele ser estático)
})
export class CurrencyFormatPipe implements PipeTransform {
  private db = inject(DatabaseService);
  private locale: string = 'es-PE'; // Default
  private formatter?: Intl.NumberFormat;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      this.locale = await this.db.getLocale();
    } catch (e) {
      this.locale = 'es-EC';
    }
    
    // Forzar siempre USD para Ecuador
    this.formatter = new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2
    });
  }

  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return '$ 0.00';
    let num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) num = 0;

    if (!this.formatter) {
      return `$ ${num.toFixed(2)}`;
    }

    return this.formatter.format(num);
  }

  /**
   * Mapeo básico de locales a monedas comunes si Intl no lo detecta automáticamente
   * (Nota: Intl.NumberFormat con style: 'currency' requiere el código de moneda)
   */
  private getCurrencyForLocale(locale: string): string {
    const map: Record<string, string> = {
      'PE': 'PEN',
      'EC': 'USD',
      'ES': 'EUR',
      'US': 'USD',
      'CO': 'COP',
      'CL': 'CLP',
      'AR': 'ARS',
      'MX': 'MXN'
    };
    
    // Extraer la región
    const match = locale.match(/([a-z]{2})[-_]([a-z]{2})/i);
    if (match && match[2]) {
      const region = match[2].toUpperCase();
      if (map[region]) return map[region];
    }
    
    // Si el locale contiene EC es Ecuador (USD)
    if (locale.toUpperCase().includes('EC')) return 'USD';
    
    return 'USD'; // Fallback a Dólares por defecto para Ecuador
  }
}


