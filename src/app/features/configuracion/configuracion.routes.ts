import { Routes } from '@angular/router';
import { SriConfigFormComponent } from './components/sri-config-form/sri-config-form.component';

export const configuracionRoutes: Routes = [
    {
        path: 'sri',
        component: SriConfigFormComponent,
        data: { breadcrumb: 'Configuración SRI' }
    }
];

