import { Routes } from '@angular/router';
import { PosComponent } from './components/pos/pos.component';

export const ventasRoutes: Routes = [
    {
        path: '',
        component: PosComponent,
        data: { breadcrumb: 'Punto de Venta (POS)' }
    }
];


