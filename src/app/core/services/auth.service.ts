import { Injectable, signal, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DatabaseService } from './database.service';
import { Usuario, RolUsuario } from '../models';
import { PersistenceService } from '../../shared/services/persistence.service';
import { AlertService } from '../../shared/components/alert/alert.component';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private db = inject(DatabaseService);
    private persistence = inject(PersistenceService);
    private router = inject(Router);
    private alertService = inject(AlertService);

    private readonly USER_SESSION_KEY = 'mf-user-session';
    
    usuarioActual = signal<Usuario | null>(null);
    estaAutenticado = computed(() => !!this.usuarioActual());
    esAdmin = computed(() => this.usuarioActual()?.rol === RolUsuario.ADMINISTRADOR);

    constructor() {
        this.cargarSesionPersistida();
    }

    private cargarSesionPersistida() {
        const savedUser = this.persistence.get<Usuario>(this.USER_SESSION_KEY);
        if (savedUser) {
            this.usuarioActual.set(savedUser);
        }
    }

    async login(username: string, password: string): Promise<boolean> {
        try {
            const res = await this.db.login({ username, password });
            
            if (res.success && res.data) {
                const user = this.db.toCamelCase(res.data) as Usuario;
                this.usuarioActual.set(user);
                this.persistence.set(this.USER_SESSION_KEY, user);
                this.alertService.success(`Bienvenido, ${user.nombre}`);
                this.router.navigate(['/dashboard']);
                return true;
            } else {
                this.alertService.error(res.error || 'Credenciales inválidas');
                return false;
            }
        } catch (error: any) {
            this.alertService.error('Error en el inicio de sesión: ' + error.message);
            return false;
        }
    }

    logout() {
        this.usuarioActual.set(null);
        this.persistence.remove(this.USER_SESSION_KEY);
        this.router.navigate(['/login']);
        this.alertService.info('Sesión cerrada correctamente');
    }

    tieneRol(rol: RolUsuario | RolUsuario[]): boolean {
        const user = this.usuarioActual();
        if (!user) return false;
        
        if (Array.isArray(rol)) {
            return rol.includes(user.rol);
        }
        return user.rol === rol;
    }
}

