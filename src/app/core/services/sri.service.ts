import { Injectable, signal, inject } from '@angular/core';
import { SriConfig, Venta, Cliente } from '../../core/models';
import { PersistenceService } from '../../shared/services/persistence.service';

@Injectable({
  providedIn: 'root'
})
export class SriService {
  private persistence = inject(PersistenceService);
  
  private readonly CONFIG_KEY = 'sri-config';
  
  // Configuración predeterminada (Ambiente de Pruebas)
  config = signal<SriConfig>({
    ruc: '9999999999001',
    razonSocial: 'EMPRESA PRUEBA',
    nombreComercial: 'MI FARMACIA PRUEBA',
    establecimiento: '001',
    puntoEmision: '001',
    direccionMatriz: 'Dirección de Pruebas',
    ambiente: '1', // 1: Pruebas, 2: Producción
    tipoEmision: '1',
    obligadoContabilidad: 'NO'
  });

  constructor() {
    this.cargarConfiguracion();
  }

  private cargarConfiguracion() {
    const saved = this.persistence.get<SriConfig>(this.CONFIG_KEY);
    if (saved) {
      this.config.set(saved);
    }
  }

  guardarConfiguracion(newConfig: SriConfig) {
    this.config.set(newConfig);
    this.persistence.set(this.CONFIG_KEY, newConfig);
  }

  /**
   * Genera la Clave de Acceso de 49 dígitos requerida por el SRI
   * Formato: fecha(8) + tipo(2) + ruc(13) + ambiente(1) + serie( establishment(3)+point(3) ) + secuencial(9) + codigo(8) + emision(1) + digitoVerificador(1)
   */
  generarClaveAcceso(fecha: Date, tipoComprobante: string, secuencial: number): string {
    const cfg = this.config();
    
    // 1. Fecha (ddMMyyyy)
    const d = String(fecha.getDate()).padStart(2, '0');
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const y = fecha.getFullYear();
    const fechaStr = `${d}${m}${y}`;

    // 2. Tipo Comprobante (01: Factura)
    const tipo = tipoComprobante.padStart(2, '0');

    // 3. RUC
    const ruc = cfg.ruc.padStart(13, '0');

    // 4. Ambiente (1 o 2)
    const ambiente = cfg.ambiente;

    // 5. Serie (Establecimiento + Punto Emisión)
    const serie = `${cfg.establecimiento.padStart(3, '0')}${cfg.puntoEmision.padStart(3, '0')}`;

    // 6. Secuencial (9 dígitos)
    const secStr = String(secuencial).padStart(9, '0');

    // 7. Código Numérico (8 dígitos, podemos usar el mismo secuencial o aleatorio)
    const codigo = String(secuencial).padStart(8, '0');

    // 8. Tipo Emisión (Siempre 1)
    const emision = '1';

    // 9. Clave Parcial (48 dígitos)
    const claveParcial = `${fechaStr}${tipo}${ruc}${ambiente}${serie}${secStr}${codigo}${emision}`;

    // 10. Dígito Verificador (Módulo 11)
    const dv = this.calcularModulo11(claveParcial);

    return `${claveParcial}${dv}`;
  }

  private calcularModulo11(clave: string): number {
    let factor = 2;
    let suma = 0;
    
    for (let i = clave.length - 1; i >= 0; i--) {
      suma += parseInt(clave[i]) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }

    const residuo = suma % 11;
    let verificador = 11 - residuo;

    if (verificador === 11) verificador = 0;
    if (verificador === 10) verificador = 1;

    return verificador;
  }

  /**
   * Genera el XML de la factura (Llamada a proceso Electron)
   */
  async generarXmlFactura(venta: Venta, cliente?: Cliente): Promise<string> {
    const res = await (window as any).electron.invoke('sri:generar-xml', {
      venta,
      config: this.config(),
      cliente
    });
    if (!res.success) throw new Error(res.error);
    return res.data;
  }

  /**
   * Firma el XML usando el archivo .p12 (Llamada a proceso Electron)
   */
  async firmarXml(xml: string): Promise<string> {
    const cfg = this.config();
    if (!cfg.rutaFirmaP12 || !cfg.passwordFirma) {
      throw new Error('Configuración de firma incompleta (ruta o contraseña faltante)');
    }
    const res = await (window as any).electron.invoke('sri:firmar-xml', {
      xml,
      rutaP12: cfg.rutaFirmaP12,
      password: cfg.passwordFirma
    });
    if (!res.success) throw new Error(res.error);
    return res.data;
  }
}

