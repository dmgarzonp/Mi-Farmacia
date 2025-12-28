// ============================================
// DOMAIN MODELS - Mi-Farmacia (Schema 2025)
// ============================================

// ============================================
// ENUMS
// ============================================

export enum EstadoRegistro {
    ACTIVO = 'activo',
    INACTIVO = 'inactivo'
}

export enum EstadoOrdenCompra {
    PENDIENTE = 'pendiente',
    APROBADA = 'aprobada',
    RECIBIDA = 'recibida',
    CANCELADA = 'cancelada'
}

export enum EstadoVenta {
    COMPLETADA = 'completada',
    ANULADA = 'anulada'
}

export enum TipoMovimiento {
    ENTRADA_COMPRA = 'entrada_compra',
    SALIDA_VENTA = 'salida_venta',
    AJUSTE_POSITIVO = 'ajuste_positivo',
    AJUSTE_NEGATIVO = 'ajuste_negativo',
    VENCIMIENTO = 'vencimiento',
    DEVOLUCION = 'devolucion'
}

export enum RolUsuario {
    ADMINISTRADOR = 'administrador',
    FARMACEUTICO = 'farmaceutico',
    CAJERO = 'cajero',
    ALMACEN = 'almacen'
}

// ============================================
// ENTITIES
// ============================================

/**
 * Categoría de productos farmacéuticos
 */
export interface Categoria {
    id?: number;
    nombre: string;
}

/**
 * Laboratorio Fabricante
 */
export interface Laboratorio {
    id?: number;
    nombre: string;
    pais: string;
    estado: EstadoRegistro;
}

/**
 * Proveedor de productos
 */
export interface Proveedor {
    id?: number;
    nombreEmpresa: string;
    ruc?: string;
    direccion?: string;
    telefonoEmpresa?: string;
    emailEmpresa?: string;
    nombreContacto?: string;
    telefonoContacto?: string;
    emailContacto?: string;
    cargoContacto?: string;
    estado: EstadoRegistro;
}

/**
 * Cliente de la farmacia
 */
export interface Cliente {
    id?: number;
    documento?: string;
    nombreCompleto: string;
    telefono?: string;
    email?: string;
    fechaNacimiento?: string;
}

/**
 * Usuario del sistema
 */
export interface Usuario {
    id?: number;
    nombre: string;
    rol: RolUsuario;
    estado: EstadoRegistro;
}

/**
 * Producto farmacéutico (Catálogo Maestro)
 */
export interface Producto {
    id?: number;
    codigoBarras?: string;
    codigoInterno?: string;
    nombreComercial: string;
    principioActivo?: string;
    presentacion?: string;
    laboratorioId?: number;
    laboratorioNombre?: string; // Virtual
    categoriaId: number;
    categoriaNombre?: string; // Virtual
    precioVenta: number;
    stockMinimo: number;
    requiereReceta: boolean;
    esControlado: boolean;
    estado: EstadoRegistro;
    stockTotal?: number; // Virtual (suma de lotes)
}

/**
 * Lote de productos (Inventario Real)
 */
export interface Lote {
    id?: number;
    productoId: number;
    productoNombre?: string; // Virtual
    lote: string;
    fechaVencimiento: string;
    stockActual: number;
    ubicacion?: string;
    fechaIngreso?: string;
}

/**
 * Orden de compra a proveedores
 */
export interface OrdenCompra {
    id?: number;
    proveedorId: number;
    proveedorNombre?: string; // Virtual
    fechaEmision: string;
    fechaRequerida?: string;
    estado: EstadoOrdenCompra;
    subtotal: number;
    descuentoMonto: number;
    impuestoTotal: number;
    total: number;
    moneda: string;
    numeroFactura?: string;
    fechaFactura?: string;
    creadoPor?: number;
    aprobadoPor?: number;
    observaciones?: string;
    detalles?: DetalleOrdenCompra[];
}

/**
 * Detalle de orden de compra
 */
export interface DetalleOrdenCompra {
    id?: number;
    ordenCompraId: number;
    productoId: number;
    productoNombre?: string; // Virtual
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    lote: string;
    fechaVencimiento: string;
}

/**
 * Venta realizada en la farmacia
 */
export interface Venta {
    id?: number;
    clienteId?: number;
    clienteNombre?: string; // Virtual
    fechaVenta: string;
    subtotal: number;
    impuestoTotal: number;
    total: number;
    estado: EstadoVenta;
    cajeroId?: number;
    metodoPago?: string;
    detalles?: DetalleVenta[];
}

/**
 * Detalle de venta
 */
export interface DetalleVenta {
    id?: number;
    ventaId?: number;
    loteId: number;
    loteCodigo?: string; // Virtual
    productoNombre?: string; // Virtual
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
}

/**
 * Movimiento de stock (Auditoría)
 */
export interface MovimientoStock {
    id?: number;
    tipo: TipoMovimiento;
    loteId: number;
    cantidad: number;
    documentoReferencia?: string;
    fechaMovimiento: string;
    usuarioId?: number;
    observaciones?: string;
}

/**
 * Receta médica
 */
export interface Receta {
    id?: number;
    ventaId: number;
    clienteId?: number;
    medicoNombre?: string;
    fechaEmision?: string;
    observaciones?: string;
    estado: 'validada' | 'rechazada' | 'pendiente';
}
