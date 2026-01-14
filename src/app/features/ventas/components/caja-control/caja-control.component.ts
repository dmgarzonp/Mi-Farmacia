import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CajaService } from '../../../../core/services/caja.service';
import { AuthService } from '../../../../core/services/auth.service';
import { RideService } from '../../../../core/services/ride.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { APP_ICONS } from '../../../../core/constants/icons';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';

@Component({
  selector: 'app-caja-control',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    InputComponent,
    CurrencyFormatPipe,
    SafeHtmlPipe,
    ModalComponent
  ],
  templateUrl: './caja-control.component.html'
})
export class CajaControlComponent implements OnInit {
  private cajaService = inject(CajaService);
  private confirmService = inject(ConfirmService);
  private rideService = inject(RideService);
  protected authService = inject(AuthService);
  
  icons = APP_ICONS;
  sesionActiva = computed(() => this.cajaService.sesionActiva());
  loading = signal(false);
  resumenVentas = signal<any[]>([]);
  
  // Formulario Arqueo
  montoEfectivo = signal(0);
  montoTarjeta = signal(0);
  montoTransferencia = signal(0);
  observaciones = signal('');
  
  // Monto Apertura
  montoApertura = signal(0);
  showModalApertura = signal(false);

  async ngOnInit() {
    await this.cajaService.verificarSesionActiva();
    if (this.sesionActiva()) {
      await this.cargarResumen();
    }
  }

  async cargarResumen() {
    const sesion = this.sesionActiva();
    if (sesion?.id) {
      const res = await this.cajaService.obtenerResumenVentas(sesion.id);
      this.resumenVentas.set(res || []);
    }
  }

  get totalVentasEfectivo() {
    return this.resumenVentas().find((v: any) => v.metodoPago === 'efectivo')?.total || 0;
  }

  get totalVentasTarjeta() {
    return this.resumenVentas().find((v: any) => v.metodoPago === 'tarjeta' || v.metodoPago?.includes('tarjeta'))?.total || 0;
  }

  get totalVentasTransferencia() {
    return this.resumenVentas().find((v: any) => v.metodoPago === 'transferencia' || v.metodoPago?.includes('transferencia'))?.total || 0;
  }

  get montoEsperadoTotal() {
    const sesion = this.sesionActiva();
    return (sesion?.montoInicial || 0) + this.totalVentasEfectivo;
  }

  async abrirCaja() {
    this.loading.set(true);
    const success = await this.cajaService.abrirCaja(this.montoApertura());
    if (success) {
      this.showModalApertura.set(false);
      await this.cargarResumen();
    }
    this.loading.set(false);
  }

  async realizarCierre() {
    const confirmado = await this.confirmService.ask({
      title: 'Cerrar Caja y Terminar Turno',
      message: '¿Está seguro de que desea cerrar la caja? Esta acción no se puede deshacer y el turno quedará finalizado para auditoría.',
      confirmText: 'Sí, Cerrar Caja',
      variant: 'warning'
    });

    if (confirmado) {
      this.loading.set(true);
      const sesion = this.sesionActiva();
      if (!sesion) return;

      const success = await this.cajaService.cerrarCaja({
        montoFinalEfectivo: this.montoEfectivo(),
        montoFinalTarjeta: this.montoTarjeta(),
        montoFinalTransferencia: this.montoTransferencia(),
        observaciones: this.observaciones()
      });

      if (success) {
        // Generar Ticket de Cierre
        try {
          const sesionFinalizada = {
            ...sesion,
            montoFinalEfectivo: this.montoEfectivo(),
            montoFinalTarjeta: this.montoTarjeta(),
            montoFinalTransferencia: this.montoTransferencia(),
            montoEsperadoEfectivo: this.montoEsperadoTotal,
            observaciones: this.observaciones()
          };
          await this.rideService.generarCierreCajaPDF(sesionFinalizada, this.resumenVentas());
        } catch (e) {
          console.error('Error al generar ticket de cierre:', e);
        }

        // Reset local state
        this.montoEfectivo.set(0);
        this.montoTarjeta.set(0);
        this.montoTransferencia.set(0);
        this.observaciones.set('');
        this.resumenVentas.set([]);
      }
      this.loading.set(false);
    }
  }
}

