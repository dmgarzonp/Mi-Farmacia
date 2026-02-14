# Sugerencias: Plazos de crédito (30 / 90 / 120 días) y saldos de cancelación

## Contexto

Tu proveedor maneja venta a crédito con **tres plazos**: 30, 90 y 120 días. Necesitas:
1. Registrar en cada orden a crédito el **plazo acordado** (30, 90 o 120 días).
2. **Ver los saldos de cancelación** de los créditos (qué se debe, a quién y hasta cuándo).

---

## 1. Plazos de crédito en la orden

### 1.1 Campo `plazo_dias` en la orden de compra

- **Base de datos:** Añadir columna `plazo_dias` (INTEGER, nullable) en `ordenes_compra`. Valores: 30, 90 o 120.
- **Modelo:** En `OrdenCompra` añadir `plazoDias?: number`.
- **Formulario de orden:** Cuando el usuario elija "Crédito":
  - Mostrar un **selector de plazo**: "30 días", "90 días", "120 días" (en lugar de solo fecha de vencimiento manual).
  - Calcular **automáticamente** la fecha de vencimiento:  
    `fecha_vencimiento_pago = fecha_emision + plazo_dias`  
    (Si la política del proveedor fuera desde la recepción, se podría usar la fecha en que se marca "Recibida").
- Así siempre tendrás orden y reportes por plazo (30 / 90 / 120).

### 1.2 Política del proveedor (opcional)

Si en el futuro quieres que cada proveedor tenga sus propios plazos permitidos:

- En **proveedores** añadir algo como `plazos_credito` (TEXT, ej. `"30,90,120"`) o tres columnas booleanas.
- En el formulario de orden, al elegir "Crédito" y un proveedor, rellenar el combo de plazos según ese proveedor (o usar por defecto 30, 90, 120 para todos).

Por ahora se puede dejar **un único conjunto de plazos (30, 90, 120)** para todos los proveedores y, si más adelante lo necesitas, añadir la configuración por proveedor.

---

## 2. Vista "Saldos de cancelación" de créditos

Objetivo: una pantalla donde ver **todas las deudas a crédito** (saldos pendientes de cancelación) y poder filtrar por proveedor y plazo.

### 2.1 Contenido recomendado

| Elemento | Descripción |
|----------|-------------|
| **Listado** | Órdenes a crédito con `saldo_pendiente > 0`. |
| **Columnas** | Nº orden, Proveedor, Fecha emisión, Plazo (días), Fecha vencimiento, Total, Pagado, **Saldo pendiente**, **Días restantes** (o "Vencido hace X días"). |
| **Filtros** | Por proveedor; por plazo (30 / 90 / 120); por estado de vencimiento (próximos 7 días, vencidos, etc.). |
| **Resumen** | Total saldo pendiente por proveedor; **total general** a cancelar. |
| **Acción** | Enlace o botón "Registrar pago" que lleve al detalle de la orden para abonar. |

### 2.2 Dónde ubicarla

- **Opción A:** Nueva ruta en Compras, por ejemplo `/compras/saldos-credito` (o "Cuentas por pagar"), con un enlace en el listado de órdenes o en el menú del módulo Compras.
- **Opción B:** Pestaña o sección dentro del listado actual de órdenes (ej. "Saldos crédito" / "Por cancelar") que muestre solo órdenes a crédito con saldo > 0.

La opción A suele ser más clara para el usuario que solo quiere "ver qué tengo que cancelar".

### 2.3 Cálculo de "días restantes"

- Si `fecha_vencimiento_pago >= hoy` → **días restantes** = diferencia en días.
- Si `fecha_vencimiento_pago < hoy` → **"Vencido hace X días"** (o mostrar en rojo y ordenar por más vencidos primero).

Así puedes priorizar qué créditos cancelar antes.

---

## 3. Orden sugerido de implementación

1. **BD y modelos:** Añadir `plazo_dias` en `ordenes_compra` y en el modelo `OrdenCompra`.
2. **Formulario de orden:** Selector de plazo (30 / 90 / 120) cuando tipo = Crédito; cálculo automático de `fecha_vencimiento_pago` desde `fecha_emision`.
3. **Servicio:** Método del tipo `obtenerOrdenesConSaldoPendiente(filtros?)` que devuelva órdenes a crédito con saldo > 0 y, si aplica, días restantes/vencido.
4. **Vista "Saldos de cancelación":** Nueva página (o sección) con tabla, filtros (proveedor, plazo, vencimiento) y resumen por proveedor y total.
5. **(Opcional)** En proveedores: campo `plazos_credito` para restringir en el futuro los plazos por proveedor.

---

## 4. Resumen

| Necesidad | Sugerencia |
|-----------|------------|
| Política 30 / 90 / 120 días | Campo `plazo_dias` en la orden; selector en el formulario y fecha de vencimiento calculada desde fecha de emisión. |
| Ver saldos a cancelar | Vista "Saldos de crédito" / "Cuentas por pagar" con listado (saldo, vencimiento, días restantes), filtros por proveedor y plazo, y resumen total. |
| Registrar pagos | Ya existe en el detalle de la orden; desde la vista de saldos solo hace falta enlazar a esa orden para "Registrar pago". |

Si quieres, el siguiente paso puede ser implementar en código: `plazo_dias`, el selector en el formulario y la vista de saldos de cancelación con filtros y resumen.
