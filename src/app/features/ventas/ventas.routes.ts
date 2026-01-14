import { Routes } from '@angular/router';
import { PosComponent } from './components/pos/pos.component';
import { VentasListComponent } from './components/ventas-list/ventas-list.component';
import { ArcsaReportComponent } from './components/arcsa-report/arcsa-report.component';

export const ventasRoutes: Routes = [
    {
        path: '',
        component: VentasListComponent,
        data: { breadcrumb: 'Historial de Ventas' }
    },
    {
        path: 'pos',
        component: PosComponent,
        data: { breadcrumb: 'Punto de Venta (POS)' }
    },
    {
        path: 'reporte-arcsa',
        component: ArcsaReportComponent,
        data: { breadcrumb: 'Reporte ARCSA' }
    },
    {
        path: 'caja',
        loadComponent: () => import('./components/caja-control/caja-control.component').then(m => m.CajaControlComponent),
        data: { breadcrumb: 'Control de Caja' }
    }
];












