import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
import { RolUsuario } from '../../core/models';

export const inventarioRoutes: Routes = [
    {
        path: 'ajustes',
        loadComponent: () => import('./components/ajuste-stock/ajuste-stock.component').then(m => m.AjusteStockComponent),
        data: { breadcrumb: 'Ajustes de Stock' },
        canActivate: [roleGuard([RolUsuario.ADMINISTRADOR, RolUsuario.ALMACEN, RolUsuario.FARMACEUTICO])]
    },
    {
        path: 'vencimientos',
        loadComponent: () => import('./components/vencimientos/vencimientos.component').then(m => m.VencimientosComponent),
        data: { breadcrumb: 'Gestión de Vencimientos' },
        canActivate: [roleGuard([RolUsuario.ADMINISTRADOR, RolUsuario.ALMACEN, RolUsuario.FARMACEUTICO])]
    },
    {
        path: '',
        redirectTo: 'ajustes',
        pathMatch: 'full'
    }
];
