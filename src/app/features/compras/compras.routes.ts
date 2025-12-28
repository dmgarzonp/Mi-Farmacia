import { Routes } from '@angular/router';
import { OrdenesListComponent } from './components/ordenes-list/ordenes-list.component';
import { OrdenFormComponent } from './components/orden-form/orden-form.component';

export const comprasRoutes: Routes = [
    {
        path: '',
        component: OrdenesListComponent,
        data: { breadcrumb: 'Lista' }
    },
    {
        path: 'nueva',
        component: OrdenFormComponent,
        data: { breadcrumb: 'Nueva Orden' }
    },
    {
        path: ':id',
        component: OrdenFormComponent,
        data: { breadcrumb: 'Detalle de Orden' }
    }
];
