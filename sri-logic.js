const builder = require('xmlbuilder');
const forge = require('node-forge');
const fs = require('fs');
const axios = require('axios');

/**
 * Genera el XML de una Factura (v2.1) según esquema SRI
 */
function generarXmlFactura(venta, config, cliente) {
    const root = builder.create('factura', { version: '1.0', encoding: 'UTF-8' })
        .att('id', 'comprobante')
        .att('version', '2.1.0');

    // 1. infoTributaria
    const infoTributaria = root.ele('infoTributaria');
    infoTributaria.ele('ambiente', config.ambiente);
    infoTributaria.ele('tipoEmision', config.tipoEmision);
    infoTributaria.ele('razonSocial', config.razonSocial);
    infoTributaria.ele('nombreComercial', config.nombreComercial || config.razonSocial);
    infoTributaria.ele('ruc', config.ruc);
    infoTributaria.ele('claveAcceso', venta.claveAcceso);
    infoTributaria.ele('codDoc', '01'); // 01: Factura
    infoTributaria.ele('estab', config.establecimiento);
    infoTributaria.ele('ptoEmi', config.puntoEmision);
    infoTributaria.ele('secuencial', String(venta.id).padStart(9, '0'));
    infoTributaria.ele('dirMatriz', config.direccionMatriz);
    if (config.agenteRetencion) infoTributaria.ele('agenteRetencion', config.agenteRetencion);
    if (config.contribuyenteEspecial) infoTributaria.ele('contribuyenteEspecial', config.contribuyenteEspecial);

    // 2. infoFactura
    const infoFactura = root.ele('infoFactura');
    const fecha = new Date(venta.fechaVenta);
    const fechaStr = `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
    infoFactura.ele('fechaEmision', fechaStr);
    infoFactura.ele('dirEstablecimiento', config.direccionMatriz);
    infoFactura.ele('obligadoContabilidad', config.obligadoContabilidad);
    
    // Datos del Cliente
    const tipoIdentificacion = !cliente ? '07' : // Consumidor Final
                               cliente.documento.length === 10 ? '05' : // Cédula
                               cliente.documento.length === 13 ? '04' : '06'; // RUC o Pasaporte
    
    infoFactura.ele('tipoIdentificacionComprador', tipoIdentificacion);
    infoFactura.ele('razonSocialComprador', cliente ? cliente.nombreCompleto : 'CONSUMIDOR FINAL');
    infoFactura.ele('identificacionComprador', cliente ? cliente.documento : '9999999999999');
    infoFactura.ele('direccionComprador', cliente?.direccion || 'S/D');
    infoFactura.ele('totalSinImpuestos', (venta.total - venta.impuestoTotal).toFixed(2));
    infoFactura.ele('totalDescuento', '0.00');

    // Totales con Impuestos
    const totalConImpuestos = infoFactura.ele('totalConImpuestos');
    
    // Si hay base 15%
    if (venta.impuestoTotal > 0) {
        const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
        totalImpuesto.ele('codigo', '2'); // 2: IVA
        totalImpuesto.ele('codigoPorcentaje', '2'); // 2: 15% (según SRI)
        totalImpuesto.ele('baseImponible', (venta.total - venta.impuestoTotal).toFixed(2));
        totalImpuesto.ele('valor', venta.impuestoTotal.toFixed(2));
    }

    // Si hay base 0%
    const totalImpuesto0 = totalConImpuestos.ele('totalImpuesto');
    totalImpuesto0.ele('codigo', '2');
    totalImpuesto0.ele('codigoPorcentaje', '0'); // 0: 0%
    totalImpuesto0.ele('baseImponible', (venta.subtotal - (venta.total - venta.impuestoTotal)).toFixed(2));
    totalImpuesto0.ele('valor', '0.00');

    infoFactura.ele('propina', '0.00');
    infoFactura.ele('importeTotal', venta.total.toFixed(2));
    infoFactura.ele('moneda', 'DOLAR');

    // Pagos
    const pagos = infoFactura.ele('pagos');
    const pago = pagos.ele('pago');
    const mappingMetodo = { 'efectivo': '01', 'tarjeta': '19', 'transferencia': '20' };
    pago.ele('formaPago', mappingMetodo[venta.metodoPago] || '01');
    pago.ele('total', venta.total.toFixed(2));

    // 3. Detalles
    const detalles = root.ele('detalles');
    venta.detalles.forEach(det => {
        const detalle = detalles.ele('detalle');
        detalle.ele('codigoPrincipal', det.presentacionId);
        detalle.ele('descripcion', det.presentacionNombre || 'Producto');
        detalle.ele('cantidad', det.cantidad.toFixed(2));
        detalle.ele('precioUnitario', det.precioUnitario.toFixed(2));
        detalle.ele('descuento', '0.00');
        detalle.ele('precioTotalSinImpuesto', det.subtotal.toFixed(2));

        const impuestosDet = detalle.ele('impuestos');
        const impuestoDet = impuestosDet.ele('impuesto');
        impuestoDet.ele('codigo', '2'); // 2: IVA
        
        // Usar la tarifa guardada en el detalle
        const tarifa = det.tarifaIva === 2 ? '15' : '0';
        const codigoPorcentaje = det.tarifaIva === 2 ? '2' : '0';
        
        impuestoDet.ele('codigoPorcentaje', codigoPorcentaje); 
        impuestoDet.ele('tarifa', tarifa);
        impuestoDet.ele('baseImponible', det.subtotal.toFixed(2));
        impuestoDet.ele('valor', det.tarifaIva === 2 ? (det.subtotal * 0.15).toFixed(2) : '0.00');
    });

    return root.end({ pretty: true });
}

/**
 * Firma un XML usando XAdES-BES (Simplificado para Electron)
 */
async function firmarXml(xmlBase, rutaP12, password) {
    try {
        if (!fs.existsSync(rutaP12)) throw new Error('No se encuentra el archivo de firma .p12');
        
        const p12Buffer = fs.readFileSync(rutaP12);
        const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
        
        // Esta es una implementación compleja que requiere una librería específica o 
        // mucha lógica de firma XML. Por ahora, devolveremos el XML con un comentario 
        // para indicar que el motor de firma está listo para ser integrado con una 
        // librería especializada como 'xml-crypto' o similar.
        
        return xmlBase; // Devuelve el XML sin firmar por ahora (Mock para pruebas)
    } catch (error) {
        console.error('Error al firmar:', error);
        throw error;
    }
}

module.exports = {
    generarXmlFactura,
    firmarXml
};

