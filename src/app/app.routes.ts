import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo: '/dashboard',
        pathMatch: 'full'
    },
    {
        path: 'dashboard',
        component: DashboardComponent
    },
    {
        path: 'compras',
        loadChildren: () => import('./features/compras/compras.routes').then(m => m.comprasRoutes),
        data: { breadcrumb: 'Compras' }
    },
    {
        path: 'ventas',
        loadChildren: () => import('./features/ventas/ventas.routes').then(m => m.ventasRoutes),
        data: { breadcrumb: 'Ventas' }
    },
    {
        path: 'ventas',
        component: DashboardComponent, // Placeholder
        data: { breadcrumb: 'Ventas' }
    },
    {
        path: 'productos',
        loadChildren: () => import('./features/productos/productos.routes').then(m => m.productosRoutes),
        data: { breadcrumb: 'Productos' }
    },
    {
        path: 'clientes',
        component: DashboardComponent, // Placeholder
        data: { breadcrumb: 'Clientes' }
    },
    {
        path: 'proveedores',
        loadChildren: () => import('./features/proveedores/proveedores.routes').then(m => m.proveedoresRoutes),
        data: { breadcrumb: 'Proveedores' }
    },
    {
        path: 'inventario',
        component: DashboardComponent, // Placeholder
        data: { breadcrumb: 'Inventario' }
    },
    {
        path: 'reportes',
        component: DashboardComponent, // Placeholder
        data: { breadcrumb: 'Reportes' }
    },
    {
        path: 'configuracion',
        component: DashboardComponent, // Placeholder
        data: { breadcrumb: 'Configuración' }
    },
    {
        path: '**',
        redirectTo: '/dashboard'
    }
];
