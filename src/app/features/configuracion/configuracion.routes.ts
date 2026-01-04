import { Routes } from '@angular/router';
import { SriConfigFormComponent } from './components/sri-config-form/sri-config-form.component';
import { UsuariosListComponent } from './components/usuarios-list/usuarios-list.component';
import { UsuarioFormComponent } from './components/usuario-form/usuario-form.component';
import { roleGuard } from '../../core/guards/role.guard';
import { RolUsuario } from '../../core/models';

export const configuracionRoutes: Routes = [
    {
        path: 'sri',
        component: SriConfigFormComponent,
        data: { breadcrumb: 'Configuración SRI' }
    },
    {
        path: 'usuarios',
        data: { breadcrumb: 'Gestión de Usuarios' },
        canActivate: [roleGuard([RolUsuario.ADMINISTRADOR])],
        children: [
            {
                path: '',
                component: UsuariosListComponent
            },
            {
                path: 'nuevo',
                component: UsuarioFormComponent,
                data: { breadcrumb: 'Nuevo Usuario' }
            },
            {
                path: ':id/editar',
                component: UsuarioFormComponent,
                data: { breadcrumb: 'Editar Usuario' }
            }
        ]
    }
];



