import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VentasService } from '../../services/ventas.service';
import { TableComponent, TableColumn } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ExportService } from '../../../../shared/services/export.service';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

@Component({
    selector: 'app-arcsa-report',
    standalone: true,
    imports: [CommonModule, FormsModule, TableComponent, ButtonComponent, InputComponent, SafeHtmlPipe],
    templateUrl: './arcsa-report.component.html'
})
export class ArcsaReportComponent implements OnInit {
    private ventasService = inject(VentasService);
    private exportService = inject(ExportService);
    
    icons = APP_ICONS;
    recetas = signal<any[]>([]);
    loading = signal(false);

    filtros = {
        inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        fin: new Date().toISOString().split('T')[0]
    };

    columns: TableColumn<any>[] = [
        {
            key: 'fechaVenta',
            label: 'Fecha Venta',
            sortable: true,
            render: (row) => new Date(row.fechaVenta).toLocaleDateString()
        },
        {
            key: 'recetaNumero',
            label: 'No. Receta',
            sortable: true
        },
        {
            key: 'medicoNombre',
            label: 'Médico / Registro',
            render: (row) => `
                <div class="flex flex-col">
                    <span class="font-bold text-slate-700">${row.medicoNombre}</span>
                    <span class="text-[9px] text-slate-400 font-black uppercase tracking-widest">${row.medicoRegistro}</span>
                </div>
            `
        },
        {
            key: 'clienteNombre',
            label: 'Paciente / Cédula',
            render: (row) => `
                <div class="flex flex-col">
                    <span class="text-xs font-semibold text-slate-600">${row.clienteNombre || 'Consumidor Final'}</span>
                    <span class="text-[9px] text-slate-400 font-medium">${row.clienteDocumento || '-'}</span>
                </div>
            `
        },
        {
            key: 'productos',
            label: 'Medicamentos Controlados',
            render: (row) => {
                if (!row.productos || row.productos.length === 0) return '<span class="text-slate-300 italic">Sin datos</span>';
                return row.productos.map((p: any) => `
                    <div class="mb-1 pb-1 border-b border-slate-50 last:border-0">
                        <span class="text-[10px] font-black text-indigo-600 uppercase">${p.nombreComercial}</span>
                        <span class="text-[9px] text-slate-400 font-medium block">Cant: ${p.cantidad} ${p.unidadBase}(s)</span>
                    </div>
                `).join('');
            }
        }
    ];

    ngOnInit() {
        this.cargarDatos();
    }

    async cargarDatos() {
        this.loading.set(true);
        try {
            const data = await this.ventasService.obtenerRecetasARCSA(this.filtros);
            this.recetas.set(data);
        } catch (error) {
            console.error('Error cargando recetas ARCSA:', error);
        } finally {
            this.loading.set(false);
        }
    }

    exportarExcel() {
        const data = this.recetas().map(r => ({
            'Fecha Venta': new Date(r.fechaVenta).toLocaleDateString(),
            'No. Receta': r.recetaNumero,
            'Médico': r.medicoNombre,
            'Registro Médico': r.medicoRegistro,
            'Paciente': r.clienteNombre || 'Consumidor Final',
            'Cédula Paciente': r.clienteDocumento || '-',
            'Medicamentos': r.productos?.map((p: any) => `${p.nombreComercial} (Cant: ${p.cantidad})`).join('; ')
        }));
        this.exportService.exportToExcel(data, `Reporte_ARCSA_${this.filtros.inicio}_${this.filtros.fin}`);
    }

    exportarPdf() {
        const data = this.recetas().map(r => [
            new Date(r.fechaVenta).toLocaleDateString(),
            r.recetaNumero,
            `${r.medicoNombre}\n(${r.medicoRegistro})`,
            r.clienteNombre || 'Consumidor Final',
            r.productos?.map((p: any) => `${p.nombreComercial} x${p.cantidad}`).join('\n')
        ]);
        
        const cols = ['Fecha', 'No. Receta', 'Médico', 'Paciente', 'Medicamentos'];
        this.exportService.exportToPdf('Reporte de Sustancias Psicotrópicas y Antibióticos (ARCSA)', cols, data, 'Reporte_ARCSA');
    }
}


