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
    BORRADOR = 'borrador',
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
    username: string;
    password?: string; // Solo para creación/edición
    rol: RolUsuario;
    estado: EstadoRegistro;
}

/**
 * Producto farmacéutico (Catálogo Maestro Genérico)
 */
export interface Producto {
    id?: number;
    codigoInterno?: string;
    nombreComercial: string;
    principioActivo?: string;
    laboratorioId?: number;
    laboratorioNombre?: string; // Virtual
    categoriaId: number;
    categoriaNombre?: string; // Virtual
    requiereReceta: boolean;
    esControlado: boolean;
    tarifaIva: number; // 0: 0%, 2: 15% (SRI), 6: No Objeto, 7: Exento
    estado: EstadoRegistro;
    presentaciones?: Presentacion[]; // Virtual
}

/**
 * Presentación de Producto (Cómo se empaqueta y vende)
 */
export interface Presentacion {
    id?: number;
    productoId: number;
    nombreDescriptivo: string; // Ej: "Caja x 100 tabletas"
    unidadBase: string;        // Ej: "tableta"
    unidadesPorCaja: number;
    precioCompraCaja: number;
    precioVentaUnidad: number;
    precioVentaCaja: number;
    stockMinimo: number;
    codigoBarras?: string;
    vencimientoPredeterminadoMeses?: number;
    stockTotal?: number; // Virtual (suma de lotes)
    proximoVencimiento?: string; // Virtual (fecha más cercana de lotes con stock)
}

/**
 * Lote de productos (Inventario Real por Presentación)
 */
export interface Lote {
    id?: number;
    presentacionId: number;
    presentacionNombre?: string; // Virtual
    productoNombre?: string; // Virtual
    lote: string;
    fechaVencimiento: string;
    stockActual: number; // En unidades base
    precioCompraCaja: number;
    precioCompraUnitario: number;
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
    presentacionId: number;
    presentacionNombre?: string; // Virtual
    productoNombre?: string; // Virtual
    cantidad: number; // En CAJAS
    precioUnitario: number; // Por CAJA
    subtotal: number;
    lote?: string;
    fechaVencimiento?: string;
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
    sesionCajaId?: number;
    metodoPago?: string;
    
    // Facturación Electrónica (Fase 2)
    claveAcceso?: string;
    numeroAutorizacion?: string;
    fechaAutorizacion?: string;
    estadoSre?: 'pendiente' | 'recibido' | 'autorizado' | 'rechazado' | 'devuelto';
    xmlGenerado?: string;
    
    detalles?: DetalleVenta[];
}

/**
 * Configuración para Facturación Electrónica SRI
 */
export interface SriConfig {
    ruc: string;
    razonSocial: string;
    nombreComercial: string;
    establecimiento: string; // Ej: "001"
    puntoEmision: string;    // Ej: "001"
    direccionMatriz: string;
    ambiente: '1' | '2';     // 1: Pruebas, 2: Producción
    tipoEmision: '1';        // Siempre 1 (Normal)
    obligadoContabilidad: 'SI' | 'NO';
    agenteRetencion?: string;
    contribuyenteEspecial?: string;
    rutaFirmaP12?: string;
    passwordFirma?: string;
}

/**
 * Detalle de venta
 */
export interface DetalleVenta {
    id?: number;
    ventaId?: number;
    loteId: number;
    presentacionId?: number; // Virtual/Referencia
    presentacionNombre?: string; // Virtual (Fase 3: RIDE)
    loteCodigo?: string; // Virtual
    productoNombre?: string; // Virtual
    tarifaIva?: number; // Virtual (Fase 3: SRI XML)
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    esFraccion?: boolean;
}

/**
 * Sesión de Caja (Arqueo y Turnos)
 */
export interface CajaSesion {
    id?: number;
    usuarioId: number;
    usuarioNombre?: string;
    fechaApertura: string;
    fechaCierre?: string;
    montoInicial: number;
    montoFinalEfectivo?: number;
    montoFinalTarjeta?: number;
    montoFinalTransferencia?: number;
    montoEsperadoEfectivo?: number;
    observaciones?: string;
    estado: 'abierta' | 'cerrada';
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
    medicoRegistro?: string; // Cédula o Registro del médico
    recetaNumero?: string;   // Número de receta
    fechaEmision?: string;
    observaciones?: string;
    estado: 'validada' | 'rechazada' | 'pendiente';
}
