import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { LoginComponent } from './features/auth/components/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { RolUsuario } from './core/models';

export const routes: Routes = [
    {
        path: 'login',
        component: LoginComponent,
        data: { breadcrumb: 'Iniciar Sesión' }
    },
    {
        path: '',
        canActivate: [authGuard],
        children: [
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
                data: { breadcrumb: 'Compras' },
                canActivate: [roleGuard([RolUsuario.ADMINISTRADOR, RolUsuario.FARMACEUTICO])]
            },
            {
                path: 'ventas',
                loadChildren: () => import('./features/ventas/ventas.routes').then(m => m.ventasRoutes),
                data: { breadcrumb: 'Ventas' }
            },
            {
                path: 'productos',
                loadChildren: () => import('./features/productos/productos.routes').then(m => m.productosRoutes),
                data: { breadcrumb: 'Productos' }
            },
            {
                path: 'proveedores',
                loadChildren: () => import('./features/proveedores/proveedores.routes').then(m => m.proveedoresRoutes),
                data: { breadcrumb: 'Proveedores' },
                canActivate: [roleGuard([RolUsuario.ADMINISTRADOR, RolUsuario.FARMACEUTICO])]
            },
            {
                path: 'configuracion',
                loadChildren: () => import('./features/configuracion/configuracion.routes').then(m => m.configuracionRoutes),
                data: { breadcrumb: 'Configuración' },
                canActivate: [roleGuard([RolUsuario.ADMINISTRADOR])]
            }
        ]
    },
    {
        path: '**',
        redirectTo: '/dashboard'
    }
];
