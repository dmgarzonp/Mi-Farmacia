import { Injectable, inject, signal, computed } from '@angular/core';
import { DatabaseService } from './database.service';
import { AuthService } from './auth.service';
import { CajaSesion } from '../models';
import { AlertService } from '../../shared/components/alert/alert.component';

@Injectable({
  providedIn: 'root'
})
export class CajaService {
  private db = inject(DatabaseService);
  private auth = inject(AuthService);
  private alertService = inject(AlertService);

  sesionActiva = signal<CajaSesion | null>(null);
  hayCajaAbierta = computed(() => !!this.sesionActiva());

  constructor() {
    this.verificarSesionActiva();
  }

  async verificarSesionActiva() {
    const usuario = this.auth.usuarioActual();
    if (!usuario) return;

    try {
      const sql = `
        SELECT * FROM cajas_sesiones 
        WHERE usuario_id = ? AND estado = 'abierta' 
        ORDER BY fecha_apertura DESC LIMIT 1
      `;
      const res = await this.db.get(sql, [usuario.id]);
      if (res) {
        this.sesionActiva.set(this.db.toCamelCase(res));
      } else {
        this.sesionActiva.set(null);
      }
    } catch (error) {
      console.error('Error al verificar sesión de caja:', error);
    }
  }

  async abrirCaja(montoInicial: number): Promise<boolean> {
    const usuario = this.auth.usuarioActual();
    if (!usuario) return false;

    try {
      const sql = `
        INSERT INTO cajas_sesiones (usuario_id, monto_inicial, estado)
        VALUES (?, ?, 'abierta')
      `;
      const res = await this.db.run(sql, [usuario.id, montoInicial]);
      if (res.lastInsertRowid) {
        await this.verificarSesionActiva();
        this.alertService.success('Caja abierta correctamente');
        return true;
      }
      return false;
    } catch (error: any) {
      this.alertService.error('Error al abrir caja: ' + error.message);
      return false;
    }
  }

  async obtenerResumenVentas(sesionId: number): Promise<any[]> {
    const sql = `
      SELECT metodo_pago, SUM(total) as total
      FROM ventas
      WHERE sesion_caja_id = ?
      AND estado = 'completada'
      GROUP BY metodo_pago
    `;
    const res = await this.db.query(sql, [sesionId]);
    return this.db.toCamelCase(res);
  }

  async cerrarCaja(params: {
    montoFinalEfectivo: number;
    montoFinalTarjeta: number;
    montoFinalTransferencia: number;
    observaciones?: string;
  }): Promise<boolean> {
    const sesion = this.sesionActiva();
    if (!sesion || !sesion.id) return false;

    try {
      // Calcular esperado (Efectivo)
      const ventas = await this.obtenerResumenVentas(sesion.id);
      const ventaEfectivo = ventas.find((v: any) => v.metodoPago === 'efectivo')?.total || 0;
      const montoEsperadoEfectivo = sesion.montoInicial + ventaEfectivo;

      const sql = `
        UPDATE cajas_sesiones SET 
          fecha_cierre = CURRENT_TIMESTAMP,
          monto_final_efectivo = ?,
          monto_final_tarjeta = ?,
          monto_final_transferencia = ?,
          monto_esperado_efectivo = ?,
          observaciones = ?,
          estado = 'cerrada'
        WHERE id = ?
      `;
      
      await this.db.run(sql, [
        params.montoFinalEfectivo,
        params.montoFinalTarjeta,
        params.montoFinalTransferencia,
        montoEsperadoEfectivo,
        params.observaciones || '',
        sesion.id
      ]);

      this.sesionActiva.set(null);
      this.alertService.success('Caja cerrada y arqueada correctamente');
      return true;
    } catch (error: any) {
      this.alertService.error('Error al cerrar caja: ' + error.message);
      return false;
    }
  }
}

