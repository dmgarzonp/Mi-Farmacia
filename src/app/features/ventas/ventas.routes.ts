import { Routes } from '@angular/router';
import { PosComponent } from './components/pos/pos.component';
import { VentasListComponent } from './components/ventas-list/ventas-list.component';

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
    }
];












