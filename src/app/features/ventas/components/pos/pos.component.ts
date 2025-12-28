import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VentasService } from '../../services/ventas.service';
import { ProductosService } from '../../../productos/services/productos.service';
import { ClientesService } from '../../../clientes/services/clientes.service';
import { AutocompleteComponent } from '../../../../shared/components/autocomplete/autocomplete.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { APP_ICONS } from '../../../../core/constants/icons';
import { Producto, Lote, Cliente, DetalleVenta, Venta } from '../../../../core/models';

interface CartItem {
    producto: Producto;
    lote: Lote;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
}

@Component({
    selector: 'app-pos',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, AutocompleteComponent, ButtonComponent, InputComponent, SafeHtmlPipe],
    templateUrl: './pos.component.html',
    styles: [`:host { display: block; height: 100%; }`]
})
export class PosComponent implements OnInit {
    private fb = inject(FormBuilder);
    private ventasService = inject(VentasService);
    private productosService = inject(ProductosService);
    private clientesService = inject(ClientesService);
    private alertService = inject(AlertService);
    
    icons = APP_ICONS;
    cart = signal<CartItem[]>([]);
    selectedClienteId = signal<number | null>(null);
    metodoPago = signal<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');
    guardando = signal(false);

    // Totales calculados
    subtotal = computed(() => this.cart().reduce((acc, item) => acc + item.subtotal, 0));
    igv = computed(() => this.subtotal() * 0.18);
    total = computed(() => this.subtotal() + this.igv());

    // Mapeos para Autocomplete
    get productosItems() {
        return this.productosService.productos()
            .filter(p => (p.stockTotal || 0) > 0)
            .map(p => ({
                id: p.id,
                label: p.nombreComercial,
                sublabel: `STOCK: ${p.stockTotal} | S/ ${p.precioVenta.toFixed(2)}`
            }));
    }

    get clientesItems() {
        return this.clientesService.clientes().map(c => ({
            id: c.id,
            label: c.nombreCompleto,
            sublabel: `DOC: ${c.documento || 'S/D'}`
        }));
    }

    async ngOnInit() {
        await Promise.all([
            this.productosService.cargarProductos(),
            this.clientesService.cargarClientes()
        ]);
    }

    async onProductoSelected(event: any) {
        if (!event || !event.id) return;

        const producto = this.productosService.productos().find(p => p.id === event.id);
        if (!producto) return;

        // Lógica FEFO: Obtener lotes disponibles ordenados por vencimiento
        const lotes = await this.ventasService.obtenerLotesDisponibles(producto.id!);
        if (lotes.length === 0) {
            this.alertService.error('No hay lotes disponibles para este producto');
            return;
        }

        const loteSeleccionado = lotes[0]; // Primer lote por vencer

        // Agregar al carrito o aumentar cantidad
        this.cart.update(items => {
            const existing = items.find(i => i.producto.id === producto.id && i.lote.id === loteSeleccionado.id);
            if (existing) {
                if (existing.cantidad + 1 > loteSeleccionado.stockActual) {
                    this.alertService.warning('Stock insuficiente en este lote');
                    return items;
                }
                existing.cantidad++;
                existing.subtotal = existing.cantidad * existing.precioUnitario;
                return [...items];
            } else {
                return [...items, {
                    producto,
                    lote: loteSeleccionado,
                    cantidad: 1,
                    precioUnitario: producto.precioVenta,
                    subtotal: producto.precioVenta
                }];
            }
        });
    }

    removeItem(index: number) {
        this.cart.update(items => items.filter((_, i) => i !== index));
    }

    updateQuantity(index: number, qty: number) {
        this.cart.update(items => {
            const item = items[index];
            if (qty > item.lote.stockActual) {
                this.alertService.warning(`Solo hay ${item.lote.stockActual} unidades disponibles`);
                item.cantidad = item.lote.stockActual;
            } else if (qty < 1) {
                item.cantidad = 1;
            } else {
                item.cantidad = qty;
            }
            item.subtotal = item.cantidad * item.precioUnitario;
            return [...items];
        });
    }

    async finalizarVenta() {
        if (this.cart().length === 0) return;
        
        this.guardando.set(true);
        try {
            const venta: Partial<Venta> = {
                clienteId: this.selectedClienteId() || undefined,
                subtotal: this.subtotal(),
                impuestoTotal: this.igv(),
                total: this.total(),
                metodoPago: this.metodoPago(),
                detalles: this.cart().map(item => ({
                    loteId: item.lote.id!,
                    cantidad: item.cantidad,
                    precioUnitario: item.precioUnitario,
                    subtotal: item.subtotal
                }))
            };

            await this.ventasService.registrarVenta(venta);
            this.alertService.success('Venta realizada correctamente');
            this.cart.set([]);
            this.selectedClienteId.set(null);
            await this.productosService.cargarProductos(); // Recargar stock
        } catch (e: any) {
            this.alertService.error('Error al procesar venta: ' + e.message);
        } finally {
            this.guardando.set(false);
        }
    }
}


