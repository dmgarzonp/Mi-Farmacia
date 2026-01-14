import { Injectable, signal, computed, inject } from '@angular/core';
import { Producto, Presentacion } from '../../core/models';
import { PersistenceService } from '../../shared/services/persistence.service';
import { ComprasService } from '../../features/compras/services/compras.service';
import { AlertService } from '../../shared/components/alert/alert.component';

export interface ItemPedido {
  productoId: number;
  productoNombre: string;
  presentacionId: number;
  presentacionNombre: string;
  proveedorId?: number;
  proveedorNombre?: string;
  precioSugerido: number;
  cantidad: number;
}

@Injectable({
  providedIn: 'root'
})
export class PedidosService {
  private persistence = inject(PersistenceService);
  private comprasService = inject(ComprasService);
  private alertService = inject(AlertService);

  private readonly STORAGE_KEY = 'lista-faltantes';
  
  // Lista de items seleccionados
  items = signal<ItemPedido[]>([]);
  
  // Total de items únicos
  count = computed(() => this.items().length);

  constructor() {
    this.cargarDeAlmacen();
  }

  private cargarDeAlmacen() {
    const guardados = this.persistence.get<ItemPedido[]>(this.STORAGE_KEY);
    if (guardados) {
      this.items.set(guardados);
    }
  }

  private guardarEnAlmacen() {
    this.persistence.set(this.STORAGE_KEY, this.items());
  }

  async añadirItem(producto: Producto, presentacion: Presentacion) {
    const actual = this.items();
    const existe = actual.find(i => i.presentacionId === presentacion.id);

    if (existe) {
      this.alertService.info(`"${producto.nombreComercial}" ya está en tu lista.`);
      return;
    }

    // Buscamos al mejor proveedor antes de añadirlo
    const mejorOp = await this.comprasService.obtenerMejorProveedorHistorico(presentacion.id!);
    
    const nuevoItem: ItemPedido = {
      productoId: producto.id!,
      productoNombre: producto.nombreComercial,
      presentacionId: presentacion.id!,
      presentacionNombre: presentacion.nombreDescriptivo,
      proveedorId: mejorOp?.proveedorId,
      precioSugerido: mejorOp?.precio || presentacion.precioCompraCaja || 0,
      cantidad: 1
    };

    this.items.set([...actual, nuevoItem]);
    this.guardarEnAlmacen();
    this.alertService.success(`Añadido: ${producto.nombreComercial}`);
  }

  removerItem(presentacionId: number) {
    this.items.set(this.items().filter(i => i.presentacionId !== presentacionId));
    this.guardarEnAlmacen();
  }

  limpiarTodo() {
    this.items.set([]);
    this.guardarEnAlmacen();
  }

  actualizarCantidad(presentacionId: number, cantidad: number) {
    this.items.set(this.items().map(i => 
      i.presentacionId === presentacionId ? { ...i, cantidad } : i
    ));
    this.guardarEnAlmacen();
  }
}




