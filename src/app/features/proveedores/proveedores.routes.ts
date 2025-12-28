import { Routes } from '@angular/router';
import { ProveedoresListComponent } from './components/proveedores-list/proveedores-list.component';
import { ProveedorFormComponent } from './components/proveedor-form/proveedor-form.component';

export const proveedoresRoutes: Routes = [
    {
        path: '',
        component: ProveedoresListComponent,
        data: { breadcrumb: 'Lista' }
    },
    {
        path: 'nuevo',
        component: ProveedorFormComponent,
        data: { breadcrumb: 'Nuevo Proveedor' }
    },
    {
        path: ':id/editar',
        component: ProveedorFormComponent,
        data: { breadcrumb: 'Editar Proveedor' }
    }
];
