import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { APP_ICONS } from '../../../core/constants/icons';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

@Component({
  selector: 'app-table-tools',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe],
  template: `
    <div class="flex items-center gap-2">
      <!-- Grupo: Importar -->
      <div class="flex bg-white rounded-2xl border border-gray-100 shadow-sm p-1">
        <button 
          (click)="fileInput.click()"
          class="flex items-center gap-2 px-4 py-2 text-xs font-black text-gray-600 hover:bg-primary-50 hover:text-primary-600 rounded-xl transition-all group"
          title="Importar desde Excel"
        >
          <span class="w-4 h-4 block group-hover:scale-110 transition-transform" [innerHTML]="icons.UPLOAD | safeHtml"></span>
          <span class="hidden md:block uppercase tracking-wider">Importar</span>
        </button>
        <input #fileInput type="file" (change)="onFileSelected($event)" accept=".xlsx, .xls" class="hidden">
      </div>

      <!-- Grupo: Exportar -->
      <div class="flex bg-white rounded-2xl border border-gray-100 shadow-sm p-1 relative">
        <button 
          (click)="showExportMenu.set(!showExportMenu())"
          class="flex items-center gap-2 px-4 py-2 text-xs font-black text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all group border-r border-gray-50"
        >
          <span class="w-4 h-4 block group-hover:scale-110 transition-transform" [innerHTML]="icons.DOWNLOAD | safeHtml"></span>
          <span class="hidden md:block uppercase tracking-wider">Exportar</span>
        </button>

        <button 
          (click)="downloadTemplate.emit()"
          class="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-gray-400 hover:text-primary-500 rounded-xl transition-all"
          title="Descargar Plantilla Excel"
        >
          <span class="w-4 h-4 block" [innerHTML]="icons.CLIPBOARD | safeHtml"></span>
          <span class="hidden lg:block uppercase tracking-tighter">Plantilla</span>
        </button>

        <!-- Dropdown de Exportación -->
        <div *ngIf="showExportMenu()" 
             class="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden animate-fade-in"
        >
          <button (click)="onExportXlsx(); showExportMenu.set(false)" 
                  class="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors border-b border-gray-50">
            <span class="w-5 h-5 text-emerald-500" [innerHTML]="icons.FILE_XLSX | safeHtml"></span>
            Excel (.xlsx)
          </button>
          <button (click)="onExportPdf(); showExportMenu.set(false)" 
                  class="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            <span class="w-5 h-5 text-red-500" [innerHTML]="icons.FILE_PDF | safeHtml"></span>
            Reporte PDF
          </button>
        </div>
      </div>
    </div>

    <!-- Backdrop para cerrar el menú -->
    <div *ngIf="showExportMenu()" 
         (click)="showExportMenu.set(false)" 
         class="fixed inset-0 z-40 bg-transparent">
    </div>
  `
})
export class TableToolsComponent {
  @Output() importExcel = new EventEmitter<File>();
  @Output() exportExcel = new EventEmitter<void>();
  @Output() exportPdf = new EventEmitter<void>();
  @Output() downloadTemplate = new EventEmitter<void>();

  icons = APP_ICONS;
  showExportMenu = signal(false);

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.importExcel.emit(file);
      // Reset input para permitir subir el mismo archivo
      event.target.value = '';
    }
  }

  onExportXlsx(): void {
    this.exportExcel.emit();
  }

  onExportPdf(): void {
    this.exportPdf.emit();
  }
}

