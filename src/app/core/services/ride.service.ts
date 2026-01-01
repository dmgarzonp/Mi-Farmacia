import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Venta, SriConfig, Cliente } from '../models';
import { SriService } from './sri.service';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';

@Injectable({
  providedIn: 'root'
})
export class RideService {
  private sriService = inject(SriService);
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
}

