import { Routes } from '@angular/router';
import { ProductosListComponent } from './components/productos-list/productos-list.component';
import { ProductoFormComponent } from './components/producto-form/producto-form.component';
import { CategoriasListComponent } from './components/categorias-list/categorias-list.component';
import { LaboratoriosListComponent } from './components/laboratorios-list/laboratorios-list.component';
import { LotesListComponent } from './components/lotes-list/lotes-list.component';

export const productosRoutes: Routes = [
    {
        path: '',
        component: ProductosListComponent,
        data: { breadcrumb: 'Catálogo' }
    },
    {
        path: 'nuevo',
        component: ProductoFormComponent,
        data: { breadcrumb: 'Nuevo Producto' }
    },
    {
        path: ':id/editar',
        component: ProductoFormComponent,
        data: { breadcrumb: 'Editar Producto' }
    },
    {
        path: ':id',
        component: LotesListComponent,
        data: { breadcrumb: 'Kardex / Lotes' }
    },
    {
        path: 'categorias',
        component: CategoriasListComponent,
        data: { breadcrumb: 'Categorías' }
    },
    {
        path: 'laboratorios',
        component: LaboratoriosListComponent,
        data: { breadcrumb: 'Laboratorios' }
    }
];
