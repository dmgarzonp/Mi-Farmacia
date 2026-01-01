import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VentasService } from '../../services/ventas.service';
import { SriService } from '../../../../core/services/sri.service';
import { ClientesService } from '../../../clientes/services/clientes.service';
import { TableComponent, TableColumn, TableAction } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';
import { Venta } from '../../../../core/models';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { RideService } from '../../../../core/services/ride.service';

@Component({
  selector: 'app-ventas-list',
  standalone: true,
  imports: [CommonModule, TableComponent, ButtonComponent, SafeHtmlPipe, CurrencyFormatPipe],
  templateUrl: './ventas-list.component.html'
})
export class VentasListComponent implements OnInit {
  ventasService = inject(VentasService);
  sriService = inject(SriService);
  clientesService = inject(ClientesService);
  alertService = inject(AlertService);
  rideService = inject(RideService);
  icons = APP_ICONS;

  columns: TableColumn<Venta>[] = [
    {
      key: 'id',
      label: 'Nº Factura',
      render: (row) => `<span class="font-black text-slate-700">#${String(row.id).padStart(9, '0')}</span>`
    },
    {
      key: 'fechaVenta',
      label: 'Fecha',
      sortable: true,
      render: (row) => `<span class="text-xs text-slate-500">${new Date(row.fechaVenta).toLocaleString()}</span>`
    },
    {
      key: 'clienteNombre',
      label: 'Cliente',
      render: (row) => `<span class="font-bold text-slate-800">${row.clienteNombre || 'Consumidor Final'}</span>`
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      render: (row) => `<span class="text-sm font-black text-primary-700">$${row.total.toFixed(2)}</span>`
    },
    {
      key: 'estadoSri',
      label: 'Estado SRI',
      render: (row) => this.getEstadoSriBadge(row)
    },
    {
      key: 'claveAcceso',
      label: 'Clave de Acceso',
      render: (row) => row.claveAcceso 
        ? `<div class="flex flex-col">
             <span class="text-[8px] font-mono text-slate-400 bg-slate-50 px-1 py-0.5 rounded border border-slate-100">${row.claveAcceso}</span>
           </div>`
        : '<span class="text-[9px] italic text-slate-300">No generada</span>'
    }
  ];

  actions: TableAction<Venta>[] = [
    {
      label: 'Ver RIDE',
      iconName: 'VIEW',
      variant: 'secondary',
      handler: (venta) => this.verRide(venta)
    },
    {
      label: 'Enviar al SRI',
      iconName: 'SAVE',
      variant: 'primary',
      visible: (v) => v.estadoSre === 'pendiente' || v.estadoSre === 'rechazado',
      handler: (venta) => this.enviarSri(venta)
    }
  ];

  ngOnInit() {
    this.ventasService.cargarVentas();
  }

  getEstadoSriBadge(venta: Venta): string {
    const estado = venta.estadoSre || 'pendiente';
    const config: any = {
      'pendiente': { label: 'Pendiente', class: 'bg-slate-100 text-slate-500 border-slate-200' },
      'recibido': { label: 'Recibido', class: 'bg-blue-50 text-blue-600 border-blue-100' },
      'autorizado': { label: 'Autorizado', class: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
      'rechazado': { label: 'Rechazado', class: 'bg-red-50 text-red-600 border-red-100' },
      'devuelto': { label: 'Devuelto', class: 'bg-amber-50 text-amber-600 border-amber-100' }
    };

    const { label, class: cssClass } = config[estado] || config['pendiente'];
    return `<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${cssClass}">${label}</span>`;
  }

  async verRide(venta: Venta) {
    try {
      this.alertService.info('Generando visualización del RIDE...');
      
      // 1. Obtener datos del cliente
      let cliente;
      if (venta.clienteId) {
        cliente = await this.clientesService.obtenerPorId(venta.clienteId);
      }

      // 2. Cargar detalles si no los tiene
      if (!venta.detalles || venta.detalles.length === 0) {
        venta.detalles = await this.ventasService.obtenerDetallesVenta(venta.id!);
      }

      // 3. Generar PDF
      await this.rideService.generarFacturaPDF(venta, cliente || undefined);
      
    } catch (error: any) {
      this.alertService.error('Error al generar RIDE: ' + error.message);
    }
  }

  async enviarSri(venta: Venta) {
    try {
      this.alertService.info('Generando XML y firmando comprobante...');
      
      // 1. Obtener datos del cliente si existe
      let cliente: any = undefined;
      if (venta.clienteId) {
        const res = await this.clientesService.obtenerPorId(venta.clienteId);
        cliente = res || undefined;
      }

      // 2. Cargar detalles
      if (!venta.detalles || venta.detalles.length === 0) {
        venta.detalles = await this.ventasService.obtenerDetallesVenta(venta.id!);
      }

      // 3. Generar XML
      const xml = await this.sriService.generarXmlFactura(venta, cliente);
      
      // 4. Firmar XML
      const xmlFirmado = await this.sriService.firmarXml(xml);

      this.alertService.success('XML Generado y Firmado exitosamente.');
      console.log('XML Firmado listo para envío:', xmlFirmado);
      
      // El siguiente paso será el envío al Web Service del SRI
      this.alertService.warning('El envío al SRI está en fase de pruebas. El XML ha sido guardado localmente.');
      
    } catch (error: any) {
      this.alertService.error('Error en proceso SRI: ' + error.message);
    }
  }
}

