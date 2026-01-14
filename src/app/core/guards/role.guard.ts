import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RolUsuario } from '../models';
import { AlertService } from '../../shared/components/alert/alert.component';

export const roleGuard = (allowedRoles: RolUsuario[]): CanActivateFn => {
    return (route, state) => {
        const authService = inject(AuthService);
        const router = inject(Router);
        const alertService = inject(AlertService);

        const user = authService.usuarioActual();
        if (user && allowedRoles.includes(user.rol)) {
            return true;
        }

        alertService.warning('No tienes permisos suficientes para acceder a esta sección.');
        router.navigate(['/dashboard']);
        return false;
    };
};


