import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { Usuario, RolUsuario, EstadoRegistro } from '../../../../core/models';
import { TableComponent, TableColumn } from '../../../../shared/components/table/table.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { AlertService } from '../../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TableComponent, ButtonComponent, SafeHtmlPipe],
  templateUrl: './usuarios-list.component.html'
})
export class UsuariosListComponent implements OnInit {
  private usuariosService = inject(UsuariosService);
  private alertService = inject(AlertService);
  private router = inject(Router);

  icons = APP_ICONS;
  usuarios = signal<Usuario[]>([]);
  loading = signal(false);

  columns: TableColumn<Usuario>[] = [
    {
      key: 'nombre',
      label: 'Nombre Completo',
      sortable: true,
      render: (row) => `
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold text-xs">
            ${row.nombre.substring(0, 1).toUpperCase()}
          </div>
          <span class="font-semibold text-slate-700">${row.nombre}</span>
        </div>
      `
    },
    {
      key: 'username',
      label: 'Usuario',
      sortable: true,
      render: (row) => `<span class="text-slate-500 font-mono text-xs">@${row.username}</span>`
    },
    {
      key: 'rol',
      label: 'Rol / Permisos',
      render: (row) => {
        const roles: Record<string, string> = {
          [RolUsuario.ADMINISTRADOR]: 'bg-purple-50 text-purple-600 border-purple-100',
          [RolUsuario.FARMACEUTICO]: 'bg-blue-50 text-blue-600 border-blue-100',
          [RolUsuario.CAJERO]: 'bg-emerald-50 text-emerald-600 border-emerald-100',
          [RolUsuario.ALMACEN]: 'bg-amber-50 text-amber-600 border-amber-100'
        };
        const style = roles[row.rol] || 'bg-slate-50 text-slate-600 border-slate-100';
        return `<span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${style}">${row.rol}</span>`;
      }
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (row) => {
        const style = row.estado === EstadoRegistro.ACTIVO 
          ? 'bg-emerald-500' 
          : 'bg-slate-300';
        return `
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${style}"></span>
            <span class="text-xs font-bold uppercase tracking-widest ${row.estado === EstadoRegistro.ACTIVO ? 'text-emerald-600' : 'text-slate-400'}">
              ${row.estado}
            </span>
          </div>
        `;
      }
    }
  ];

  ngOnInit() {
    this.cargarUsuarios();
  }

  async cargarUsuarios() {
    this.loading.set(true);
    try {
      const data = await this.usuariosService.obtenerTodos();
      this.usuarios.set(data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      this.alertService.error('No se pudieron cargar los usuarios.');
    } finally {
      this.loading.set(false);
    }
  }

  editar(usuario: Usuario) {
    this.router.navigate(['/configuracion/usuarios', usuario.id, 'editar']);
  }

  nuevo() {
    this.router.navigate(['/configuracion/usuarios/nuevo']);
  }
}

