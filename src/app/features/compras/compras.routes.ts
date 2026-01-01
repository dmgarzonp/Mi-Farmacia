import { Routes } from '@angular/router';
import { OrdenesListComponent } from './components/ordenes-list/ordenes-list.component';
import { OrdenFormComponent } from './components/orden-form/orden-form.component';
import { saveDraftGuard } from '../../core/guards/save-draft-guard';

export const comprasRoutes: Routes = [
    {
        path: '',
        component: OrdenesListComponent,
        data: { breadcrumb: 'Lista' }
    },
    {
        path: 'nueva',
        component: OrdenFormComponent,
        canDeactivate: [saveDraftGuard],
        data: { breadcrumb: 'Nueva Orden' }
    },
    {
        path: ':id',
        component: OrdenFormComponent,
        canDeactivate: [saveDraftGuard],
        data: { breadcrumb: 'Detalle de Orden' }
    }
];
