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
import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';
import { Producto, Lote, Cliente, DetalleVenta, Venta, Presentacion, Receta } from '../../../../core/models';
import { RideService } from '../../../../core/services/ride.service';
import { CajaService } from '../../../../core/services/caja.service';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ClienteFormComponent } from '../../../clientes/components/cliente-form/cliente-form.component';

interface CartItem {
    producto: Producto;
    presentacion: Presentacion;
    lote: Lote;
    cantidad: number; // En unidades de la presentación elegida
    esFraccion: boolean;
    precioUnitario: number;
    subtotal: number;
}

@Component({
    selector: 'app-pos',
    standalone: true,
    imports: [
        CommonModule, 
        FormsModule, 
        ReactiveFormsModule, 
        AutocompleteComponent, 
        ButtonComponent, 
        InputComponent, 
        SafeHtmlPipe, 
        CurrencyFormatPipe,
        ModalComponent,
        ClienteFormComponent
    ],
    providers: [CurrencyFormatPipe],
    templateUrl: './pos.component.html',
    styles: [`:host { display: block; height: 100%; }`]
})
export class PosComponent implements OnInit {
    private fb = inject(FormBuilder);
    private ventasService = inject(VentasService);
    private productosService = inject(ProductosService);
    private clientesService = inject(ClientesService);
    private alertService = inject(AlertService);
    private currencyPipe = inject(CurrencyFormatPipe);
    private rideService = inject(RideService);
    private confirmService = inject(ConfirmService);
    protected cajaService = inject(CajaService);
    
    icons = APP_ICONS;
    cart = signal<CartItem[]>([]);
    selectedClienteId = signal<number | null>(null);
    metodoPago = signal<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');
    referenciaPago = signal(''); // Para voucher o número de transferencia
    tipoComprobante = signal<'01' | '00'>('01'); // 01: Factura (SRI), 00: Nota de Venta / Consumidor Final
    showModalCliente = signal(false);
    showModalReceta = signal(false);
    showModalApertura = signal(false);
    montoApertura = signal(0);
    guardando = signal(false);
    
    // Sustitutos y Alternativas
    alternativas = signal<any[]>([]);
    buscandoAlternativas = signal(false);
    principioActivoSeleccionado = signal<string | null>(null);

    // Datos de Receta (ARCSA)
    recetaForm!: FormGroup;
    hayCajaAbierta = computed(() => this.cajaService.hayCajaAbierta());
    requiereReceta = computed(() => this.cart().some(item => item.producto.requiereReceta || item.producto.esControlado));
    subtotalBase0 = computed(() => {
        const cart = this.cart();
        console.log('Cart updated:', cart);
        const items = cart.filter(item => {
            const tarifa = Number(item.producto.tarifaIva ?? 0);
            return tarifa === 0 || tarifa === 6 || tarifa === 7;
        });
        const total = items.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);
        console.log('Subtotal 0%:', total);
        return total;
    });

    subtotalBase15 = computed(() => {
        const cart = this.cart();
        const items = cart.filter(item => Number(item.producto.tarifaIva ?? 0) === 2);
        const total = items.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);
        console.log('Subtotal 15%:', total);
        return total;
    });

    montoIva15 = computed(() => Number(this.subtotalBase15() * 0.15));

    total = computed(() => Number(this.subtotalBase0()) + Number(this.subtotalBase15()) + Number(this.montoIva15()));

    // Mapeos para Autocomplete
    get productosItems() {
        const items: any[] = [];
        this.productosService.productos().forEach(p => {
            if (p.presentaciones) {
                p.presentaciones.forEach(pres => {
                    if ((pres.stockTotal || 0) > 0) {
                        const stockTotal = pres.stockTotal || 0;
                        const unidadesPorCaja = pres.unidadesPorCaja || 1;
                        
                        let stockLabel = '';
                        if (unidadesPorCaja > 1) {
                            const cajas = Math.floor(stockTotal / unidadesPorCaja);
                            const unidades = stockTotal % unidadesPorCaja;
                            stockLabel = `STOCK: ${cajas} CAJAS ${unidades > 0 ? '+ ' + unidades + ' ' + pres.unidadBase : ''}`;
                        } else {
                            stockLabel = `STOCK: ${stockTotal} ${pres.unidadBase}`;
                        }

                        items.push({
                            id: pres.id, // IMPORTANTE: El ID ahora es de la presentación
                            productId: p.id,
                            label: `${p.nombreComercial} - ${pres.nombreDescriptivo}`,
                            sublabel: `${p.principioActivo ? p.principioActivo + ' | ' : ''}${stockLabel} | ${this.currencyPipe.transform(pres.precioVentaCaja)} | ${p.tarifaIva === 2 ? 'IVA 15%' : 'IVA 0%'}`
                        });
                    }
                });
            }
        });
        return items;
    }

    get clientesItems() {
        return this.clientesService.clientes().map(c => ({
            id: c.id,
            label: c.nombreCompleto,
            sublabel: `DOC: ${c.documento || 'S/D'}`
        }));
    }

    async ngOnInit() {
        this.initRecetaForm();
        await Promise.all([
            this.productosService.cargarProductos(),
            this.clientesService.cargarClientes()
        ]);
    }

    private initRecetaForm() {
        this.recetaForm = this.fb.group({
            medicoNombre: ['', Validators.required],
            medicoRegistro: ['', Validators.required],
            recetaNumero: ['', Validators.required],
            fechaEmision: [new Date().toISOString().split('T')[0], Validators.required],
            observaciones: ['']
        });
    }

    onClienteGuardado(clienteId: number) {
        this.selectedClienteId.set(clienteId);
        this.showModalCliente.set(false);
        this.clientesService.cargarClientes(); // Refrescar lista de autocomplete
    }

    async onProductoSelected(event: any) {
        if (!event || !event.id) return;

        // Buscar el producto y la presentación
        const producto = this.productosService.productos().find(p => p.id === event.productId);
        if (!producto || !producto.presentaciones) return;

        // Cargar alternativas si tiene principio activo
        if (producto.principioActivo) {
            this.principioActivoSeleccionado.set(producto.principioActivo);
            this.buscarSustitutos(producto.principioActivo, producto.id!);
        } else {
            this.principioActivoSeleccionado.set(null);
            this.alternativas.set([]);
        }

        const presentacion = producto.presentaciones.find(pres => pres.id === event.id);
        if (!presentacion) return;

        console.log('Producto seleccionado:', producto.nombreComercial);
        console.log('Presentación data:', presentacion);
        console.log('Precio Venta Caja:', presentacion.precioVentaCaja);

        // Lógica FEFO: Obtener lotes disponibles por presentación
        const lotes = await this.ventasService.obtenerLotesDisponibles(presentacion.id!);
        if (lotes.length === 0) {
            this.alertService.error('No hay lotes disponibles para esta presentación');
            return;
        }

        const loteSeleccionado = lotes[0]; // Primer lote por vencer

        // Agregar al carrito o aumentar cantidad
        this.cart.update(items => {
            const existing = items.find(i => i.presentacion.id === presentacion.id && i.lote.id === loteSeleccionado.id && !i.esFraccion);
            
            // Calcular total ya solicitado de este lote en el carrito
            const totalSolicitadoLote = items
                .filter(i => i.lote.id === loteSeleccionado.id)
                .reduce((acc, i) => acc + (i.esFraccion ? i.cantidad : i.cantidad * (i.presentacion.unidadesPorCaja || 1)), 0);

            if (existing) {
                const stockNecesario = (existing.cantidad + 1) * (presentacion.unidadesPorCaja || 1);
                // Validamos contra el total acumulado del lote en el carrito
                if (totalSolicitadoLote + (presentacion.unidadesPorCaja || 1) > loteSeleccionado.stockActual) {
                    this.alertService.warning('Stock insuficiente en este lote (incluyendo lo ya agregado al carrito)');
                    return items;
                }
                existing.cantidad++;
                existing.subtotal = existing.cantidad * existing.precioUnitario;
                return [...items];
            } else {
                if (totalSolicitadoLote + (presentacion.unidadesPorCaja || 1) > loteSeleccionado.stockActual) {
                    this.alertService.warning('Stock insuficiente en este lote (ya has agregado el máximo disponible al carrito)');
                    return items;
                }
                return [...items, {
                    producto,
                    presentacion,
                    lote: loteSeleccionado,
                    cantidad: 1,
                    esFraccion: false,
                    precioUnitario: presentacion.precioVentaCaja || 0,
                    subtotal: presentacion.precioVentaCaja || 0
                }];
            }
        });
    }

    toggleFraccion(index: number) {
        this.cart.update(items => {
            const item = items[index];
            item.esFraccion = !item.esFraccion;
            
            if (item.esFraccion) {
                // Cambiar a unidades base
                item.precioUnitario = item.presentacion.precioVentaUnidad;
                item.cantidad = 1; // Ajuste: Por defecto 1 unidad al fraccionar, no la caja completa
            } else {
                // Cambiar a cajas
                item.precioUnitario = item.presentacion.precioVentaCaja;
                item.cantidad = 1;
            }
            
            item.subtotal = item.cantidad * item.precioUnitario;
            return [...items];
        });
    }

    removeItem(index: number) {
        this.cart.update(items => items.filter((_, i) => i !== index));
    }

    async vaciarCarrito() {
        if (this.cart().length === 0) return;

        const confirmado = await this.confirmService.ask({
            title: 'Vaciar Carrito',
            message: '¿Está seguro de que desea eliminar todos los productos del carrito?',
            confirmText: 'Sí, Vaciar',
            variant: 'danger'
        });

        if (confirmado) {
            this.cart.set([]);
            this.alternativas.set([]);
            this.principioActivoSeleccionado.set(null);
            this.alertService.info('Carrito vaciado');
        }
    }

    /**
     * Busca productos con el mismo principio activo pero diferente ID
     */
    buscarSustitutos(principioActivo: string, productoIdActual: number) {
        this.buscandoAlternativas.set(true);
        
        // Simular un pequeño delay para feedback visual
        setTimeout(() => {
            const productos = this.productosService.productos();
            const matching = [];

            for (const p of productos) {
                // Mismo principio activo, diferente producto
                if (p.id !== productoIdActual && 
                    p.principioActivo && 
                    p.principioActivo.toLowerCase().includes(principioActivo.toLowerCase())) {
                    
                    // Solo si tiene presentaciones con stock
                    if (p.presentaciones) {
                        for (const pres of p.presentaciones) {
                            if ((pres.stockTotal || 0) > 0) {
                                matching.push({
                                    producto: p,
                                    presentacion: pres,
                                    stock: pres.stockTotal,
                                    precio: pres.precioVentaCaja
                                });
                            }
                        }
                    }
                }
            }
            
            this.alternativas.set(matching.slice(0, 5)); // Mostrar máximo 5
            this.buscandoAlternativas.set(false);
        }, 300);
    }

    seleccionarAlternativa(alt: any) {
        this.onProductoSelected({
            id: alt.presentacion.id,
            productId: alt.producto.id
        });
        // Limpiar alternativas después de seleccionar una
        this.alternativas.set([]);
        this.principioActivoSeleccionado.set(null);
    }

    updateQuantity(index: number, qty: number) {
        this.cart.update(items => {
            const item = items[index];
            const unidadesPorCaja = item.presentacion.unidadesPorCaja || 1;
            const stockActual = item.lote.stockActual;
            
            // Calcular cuánto están pidiendo los OTROS items del mismo lote
            const solicitadoOtros = items
                .filter((_, i) => i !== index)
                .filter(i => i.lote.id === item.lote.id)
                .reduce((acc, i) => acc + (i.esFraccion ? i.cantidad : i.cantidad * (i.presentacion.unidadesPorCaja || 1)), 0);

            let nuevaCantidad = qty;
            const totalUnidadesSolicitadas = item.esFraccion ? nuevaCantidad : nuevaCantidad * unidadesPorCaja;

            if (solicitadoOtros + totalUnidadesSolicitadas > stockActual) {
                const disponibleReal = stockActual - solicitadoOtros;
                this.alertService.warning(`Stock insuficiente para este lote. Disponible restante: ${disponibleReal} unidades`);
                nuevaCantidad = item.esFraccion ? disponibleReal : Math.floor(disponibleReal / unidadesPorCaja);
            } else if (nuevaCantidad < 1) {
                nuevaCantidad = 1;
            }

            item.cantidad = nuevaCantidad;
            item.subtotal = item.cantidad * item.precioUnitario;
            return [...items];
        });
    }

    async abrirCaja() {
        if (this.montoApertura() < 0) {
            this.alertService.warning('El monto inicial no puede ser negativo');
            return;
        }

        const success = await this.cajaService.abrirCaja(this.montoApertura());
        if (success) {
            this.showModalApertura.set(false);
            this.montoApertura.set(0);
        }
    }

    async finalizarVenta() {
        if (!this.hayCajaAbierta()) {
            this.showModalApertura.set(true);
            return;
        }

        if (this.cart().length === 0) return;

        // Validación de Stock Acumulado por Lote (SQLITE_CONSTRAINT_CHECK Fix)
        const items = this.cart();
        const lotesMap = new Map<number, { nombre: string, solicitado: number, disponible: number }>();
        
        for (const item of items) {
            const solicitado = item.esFraccion ? item.cantidad : item.cantidad * (item.presentacion.unidadesPorCaja || 1);
            const current = lotesMap.get(item.lote.id!) || { nombre: item.producto.nombreComercial, solicitado: 0, disponible: item.lote.stockActual };
            current.solicitado += solicitado;
            lotesMap.set(item.lote.id!, current);
        }

        for (const [loteId, data] of lotesMap.entries()) {
            if (data.solicitado > data.disponible) {
                this.alertService.error(`Stock insuficiente para "${data.nombre}". Solicitado: ${data.solicitado}, Disponible: ${data.disponible}`);
                return;
            }
        }

        // Validación de comprobante (Fase 3)
        if (this.tipoComprobante() === '01' && !this.selectedClienteId()) {
            this.alertService.warning('Para emitir una Factura RUC debe seleccionar un cliente.');
            return;
        }

        // Validación de Receta (ARCSA / Controlados)
        if (this.requiereReceta() && !this.showModalReceta()) {
            this.showModalReceta.set(true);
            this.alertService.info('Esta venta contiene productos controlados o bajo receta. Por favor, registre los datos de la receta médica.');
            return;
        }

        if (this.requiereReceta() && this.recetaForm.invalid) {
            this.recetaForm.markAllAsTouched();
            this.alertService.error('Debe completar todos los datos de la receta médica.');
            return;
        }
        
        this.guardando.set(true);
        try {
            const detalles: DetalleVenta[] = this.cart().map(item => ({
                loteId: item.lote.id!,
                presentacionId: item.presentacion.id!,
                presentacionNombre: item.presentacion.nombreDescriptivo,
                cantidad: item.esFraccion ? item.cantidad : item.cantidad * (item.presentacion.unidadesPorCaja || 1),
                precioUnitario: item.precioUnitario,
                subtotal: item.subtotal,
                esFraccion: item.esFraccion
            }));

            const venta: Partial<Venta> = {
                clienteId: this.tipoComprobante() === '01' ? (this.selectedClienteId() || undefined) : undefined,
                subtotal: this.subtotalBase0() + this.subtotalBase15(),
                impuestoTotal: this.montoIva15(),
                total: this.total(),
                metodoPago: this.metodoPago(),
                detalles
            };

            // Añadir referencia a observaciones si existe
            if (this.referenciaPago()) {
                venta.metodoPago = `${venta.metodoPago} (${this.referenciaPago()})`;
            }

            const recetaData = this.requiereReceta() ? this.recetaForm.value : undefined;
            const ventaId = await this.ventasService.registrarVenta(venta, recetaData);
            
            // --- Generación Automática de RIDE (Fase 3) ---
            try {
                let clienteData;
                if (venta.clienteId) {
                    clienteData = await this.clientesService.obtenerPorId(venta.clienteId);
                }

                const ventaCompleta = (await this.ventasService.cargarVentas(), this.ventasService.ventas().find(v => v.id === ventaId));
                
                if (ventaCompleta) {
                    ventaCompleta.detalles = detalles;
                    await this.rideService.generarFacturaPDF(ventaCompleta, clienteData || undefined);
                    this.alertService.success('Venta realizada y RIDE generado correctamente');
                } else {
                    this.alertService.success('Venta realizada correctamente');
                }
            } catch (pdfError) {
                console.error('Error al generar PDF:', pdfError);
                this.alertService.warning('Venta guardada, pero hubo un error al generar el PDF.');
            }

            this.cart.set([]);
            this.selectedClienteId.set(null);
            this.tipoComprobante.set('00'); // Volver a Consumidor Final
            this.showModalReceta.set(false);
            this.recetaForm.reset({
                fechaEmision: new Date().toISOString().split('T')[0]
            });
            await this.productosService.cargarProductos(); // Recargar stock
        } catch (e: any) {
            this.alertService.error('Error al procesar venta: ' + e.message);
        } finally {
            this.guardando.set(false);
        }
    }
}


