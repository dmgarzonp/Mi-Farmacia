import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Venta, SriConfig, Cliente, CajaSesion } from '../models';
import { SriService } from './sri.service';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class RideService {
  private sriService = inject(SriService);
  private authService = inject(AuthService);
  private currencyPipe = new CurrencyFormatPipe();

  /**
   * Genera y descarga el RIDE (PDF) de una factura
   */
  async generarFacturaPDF(venta: Venta, cliente?: Cliente) {
    const config = this.sriService.config();
    const doc = new jsPDF();
    const margin = 15;
    let currentY = 20;

    // --- ENCABEZADO (DATOS DE LA EMPRESA) ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(config.razonSocial, margin, currentY);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    currentY += 7;
    doc.text(`Dirección Matriz: ${config.direccionMatriz}`, margin, currentY);
    currentY += 5;
    doc.text(`RUC: ${config.ruc}`, margin, currentY);
    currentY += 5;
    doc.text(`Obligado a llevar Contabilidad: ${config.obligadoContabilidad}`, margin, currentY);

    // --- RECUADRO DERECHO (DATOS DE LA FACTURA) ---
    const rightColX = 110;
    let rightY = 20;
    doc.setDrawColor(200);
    doc.roundedRect(rightColX - 5, 12, 90, 45, 3, 3);
    
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURA', rightColX, rightY);
    doc.setFont('helvetica', 'normal');
    rightY += 6;
    doc.text(`No. ${config.establecimiento}-${config.puntoEmision}-${String(venta.id).padStart(9, '0')}`, rightColX, rightY);
    rightY += 6;
    doc.text(`AMBIENTE: ${config.ambiente === '1' ? 'PRUEBAS' : 'PRODUCCIÓN'}`, rightColX, rightY);
    rightY += 6;
    doc.text(`EMISIÓN: NORMAL`, rightColX, rightY);
    rightY += 8;
    doc.setFontSize(8);
    doc.text('CLAVE DE ACCESO:', rightColX, rightY);
    rightY += 4;
    doc.setFont('courier', 'normal');
    doc.text(venta.claveAcceso || 'PENDIENTE', rightColX, rightY);

    currentY = 65;

    // --- DATOS DEL CLIENTE ---
    doc.setDrawColor(230);
    doc.line(margin, currentY, 195, currentY);
    currentY += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Razón Social / Nombres y Apellidos:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(cliente ? cliente.nombreCompleto : 'CONSUMIDOR FINAL', margin + 60, currentY);
    
    currentY += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Identificación:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(cliente?.documento || '9999999999999', margin + 60, currentY);
    
    currentY += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha Emisión:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(venta.fechaVenta).toLocaleDateString(), margin + 60, currentY);
    
    currentY += 10;

    // --- TABLA DE DETALLES ---
    const tableData = (venta.detalles || []).map(det => [
      String(det.presentacionId),
      String(det.cantidad.toFixed(2)),
      det.presentacionNombre || 'Producto',
      this.currencyPipe.transform(det.precioUnitario),
      '0.00',
      this.currencyPipe.transform(det.subtotal)
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Cod. Principal', 'Cant', 'Descripción', 'Precio Unitario', 'Descuento', 'Precio Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 15, halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // --- TOTALES Y PAGOS ---
    const finalX = 130;
    doc.setFontSize(9);
    
    const drawTotal = (label: string, value: number) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, finalX, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(this.currencyPipe.transform(value), 195, currentY, { align: 'right' });
      currentY += 6;
    };

    drawTotal('SUBTOTAL 0%', venta.subtotal - (venta.total - venta.impuestoTotal));
    drawTotal('SUBTOTAL 15%', venta.total - venta.impuestoTotal);
    drawTotal('IVA 15%', venta.impuestoTotal);
    currentY += 2;
    doc.setFontSize(11);
    drawTotal('TOTAL', venta.total);

    // --- INFORMACIÓN ADICIONAL ---
    currentY += 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Información Adicional', margin, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`Email: ${cliente?.email || 'S/D'}`, margin, currentY);
    currentY += 4;
    doc.text(`Forma de Pago: ${venta.metodoPago?.toUpperCase() || 'EFECTIVO'}`, margin, currentY);

    // --- GUARDAR / DESCARGAR ---
    doc.save(`Factura-${String(venta.id).padStart(9, '0')}.pdf`);
  }

  /**
   * Genera el ticket de cierre de caja (Arqueo)
   */
  async generarCierreCajaPDF(sesion: CajaSesion, resumenVentas: any[]) {
    const config = this.sriService.config();
    const usuario = this.authService.usuarioActual();
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 200] // Formato Ticket (80mm)
    });
    
    const margin = 5;
    let currentY = 10;

    // --- ENCABEZADO TICKET ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(config.razonSocial, 40, currentY, { align: 'center' });
    
    doc.setFontSize(8);
    currentY += 5;
    doc.text('CIERRE DE CAJA / ARQUEO', 40, currentY, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    currentY += 8;
    doc.text(`ID Sesión: #${sesion.id}`, margin, currentY);
    currentY += 4;
    doc.text(`Cajero: ${usuario?.nombre}`, margin, currentY);
    currentY += 4;
    doc.text(`Apertura: ${sesion.fechaApertura}`, margin, currentY);
    currentY += 4;
    doc.text(`Cierre: ${new Date().toLocaleString()}`, margin, currentY);

    doc.setDrawColor(200);
    currentY += 4;
    doc.line(margin, currentY, 75, currentY);
    currentY += 6;

    // --- BALANCE DEL SISTEMA ---
    doc.setFont('helvetica', 'bold');
    doc.text('BALANCE DEL SISTEMA', margin, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 5;
    
    const drawRow = (label: string, value: number) => {
      doc.text(label, margin, currentY);
      doc.text(this.currencyPipe.transform(value), 75, currentY, { align: 'right' });
      currentY += 4;
    };

    drawRow('Fondo Inicial:', sesion.montoInicial);
    
    let totalVentas = 0;
    resumenVentas.forEach(v => {
      drawRow(`Venta ${v.metodoPago || 'S/M'}:`, v.total);
      totalVentas += v.total;
    });

    currentY += 2;
    doc.setFont('helvetica', 'bold');
    drawRow('EFECTIVO ESPERADO:', sesion.montoEsperadoEfectivo || 0);
    
    currentY += 4;
    doc.line(margin, currentY, 75, currentY);
    currentY += 6;

    // --- ARQUEO FÍSICO ---
    doc.text('ARQUEO FÍSICO (DECLARADO)', margin, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    
    drawRow('Efectivo contado:', sesion.montoFinalEfectivo || 0);
    drawRow('Vouchers tarjeta:', sesion.montoFinalTarjeta || 0);
    drawRow('Transferencias:', sesion.montoFinalTransferencia || 0);

    const diferencia = (sesion.montoFinalEfectivo || 0) - (sesion.montoEsperadoEfectivo || 0);
    currentY += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('DIFERENCIA EFECTIVO:', margin, currentY);
    if (diferencia < 0) doc.setTextColor(200, 0, 0);
    else if (diferencia > 0) doc.setTextColor(0, 150, 0);
    doc.text(this.currencyPipe.transform(diferencia), 75, currentY, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    // --- OBSERVACIONES ---
    if (sesion.observaciones) {
      currentY += 8;
      doc.setFontSize(7);
      doc.text('OBSERVACIONES:', margin, currentY);
      currentY += 4;
      const splitObs = doc.splitTextToSize(sesion.observaciones, 70);
      doc.text(splitObs, margin, currentY);
      currentY += (splitObs.length * 3);
    }

    currentY += 15;
    doc.line(20, currentY, 60, currentY);
    currentY += 4;
    doc.setFontSize(8);
    doc.text('FIRMA RESPONSABLE', 40, currentY, { align: 'center' });

    doc.save(`Cierre-Caja-${sesion.id}.pdf`);
  }
}

