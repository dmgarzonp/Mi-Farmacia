import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor() { }

  /**
   * Exporta datos a un archivo Excel (.xlsx)
   * @param data Array de objetos con los datos
   * @param fileName Nombre del archivo (sin extensión)
   * @param sheetName Nombre de la hoja
   */
  exportToExcel(data: any[], fileName: string, sheetName: string = 'Datos'): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const workbook: XLSX.WorkBook = { 
      Sheets: { [sheetName]: worksheet }, 
      SheetNames: [sheetName] 
    };
    
    // Generar buffer y descargar
    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
  }

  /**
   * Exporta datos a un archivo PDF profesional
   * @param title Título del reporte
   * @param columns Columnas (headers)
   * @param data Datos formateados para la tabla
   * @param fileName Nombre del archivo
   */
  exportToPdf(title: string, columns: string[], data: any[][], fileName: string): void {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Estilos del encabezado
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(title, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 30);
    
    // Línea decorativa
    doc.setDrawColor(16, 185, 129); // Verde esmeralda
    doc.setLineWidth(1);
    doc.line(14, 35, 196, 35);

    // Generar Tabla
    autoTable(doc, {
      head: [columns],
      body: data,
      startY: 40,
      theme: 'grid',
      headStyles: {
        fillColor: [16, 185, 129], // Emerald 500
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [245, 255, 250]
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      margin: { top: 40 }
    });

    doc.save(`${fileName}_${new Date().getTime()}.pdf`);
  }

  /**
   * Lee un archivo Excel y lo convierte a JSON
   * @param file Archivo obtenido del input type="file"
   */
  async importFromExcel<T>(file: File): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as T[];
          resolve(jsonData);
        } catch (err) {
          reject(new Error('Error al procesar el archivo Excel'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Descarga una plantilla CSV/Excel para importación
   * @param headers Cabeceras de la plantilla
   * @param fileName Nombre del archivo
   */
  downloadTemplate(headers: string[], fileName: string): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook: XLSX.WorkBook = { 
      Sheets: { 'Plantilla': worksheet }, 
      SheetNames: ['Plantilla'] 
    };
    XLSX.writeFile(workbook, `${fileName}_Plantilla.xlsx`);
  }
}

