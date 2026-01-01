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
    this.locale = await this.db.getLocale();
    this.formatter = new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency: this.getCurrencyForLocale(this.locale),
      currencyDisplay: 'symbol', // Forzar el uso de símbolos como $ en lugar de códigos como USD
      minimumFractionDigits: 2
    });
  }

  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';

    // Si aún no se ha inicializado el formateador, usamos un fallback básico sin moneda quemada
    if (!this.formatter) {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    
    // Extraer la región de forma más robusta (ej: de es-PE, es_PE.UTF-8 o en-US extraer PE o US)
    // Buscamos cualquier par de letras mayúsculas que representen el país
    const match = locale.match(/([a-z]{2})[-_]([a-z]{2})/i);
    if (match && match[2]) {
      const region = match[2].toUpperCase();
      if (map[region]) return map[region];
    }
    
    // Fallback por si el locale es solo la región o algo no estándar
    const cleanLocale = locale.split(/[-_.]/)[0].toUpperCase();
    if (map[cleanLocale]) return map[cleanLocale];
    
    return 'PEN'; // Fallback final
  }
}


