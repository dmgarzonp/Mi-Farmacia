# Análisis: Versión Alfa y Beta – Autenticación, Autorización y Dashboard

Este documento analiza el estado actual de **usuarios, autenticación y autorización** y del **dashboard**, y propone qué falta para lanzar una **versión alfa** y luego una **beta**.

---

## 1. Usuarios, autenticación y autorización

### 1.1 Estado actual (lo que ya tienes)

| Aspecto | Estado | Detalle |
|--------|--------|---------|
| **Login** | Implementado | Formulario usuario/contraseña; AuthService llama a Electron `auth:login`. |
| **Verificación en backend** | Implementado | Electron: consulta `usuarios` por `username` y `estado = 'activo'`, compara contraseña con `bcrypt.compareSync`. No devuelve el password al frontend. |
| **Sesión** | Implementado | Usuario guardado en `localStorage` (`mf-user-session`). Se restaura al recargar la app. |
| **Cierre de sesión** | Implementado | Limpia señal y `localStorage`, redirige a `/login`. |
| **Guard de ruta (auth)** | Implementado | `authGuard`: si no hay sesión → redirige a `/login` con `returnUrl`. Todas las rutas internas están protegidas. |
| **Guard por rol** | Implementado | `roleGuard(roles)`: Compras y Proveedores (Admin, Farmacéutico), Inventario (Admin, Almacén, Farmacéutico), Configuración (solo Admin). Si el usuario no tiene rol → mensaje y redirección a `/dashboard`. |
| **Modelo de usuario** | Definido | `Usuario`: id, nombre, username, password (opcional), rol, estado. `RolUsuario`: administrador, farmaceutico, cajero, almacen. |
| **CRUD de usuarios** | Implementado | `UsuariosService`: listar, obtener por ID, crear (con hash de contraseña), actualizar (cambiar contraseña opcional), desactivar. |
| **UI gestión de usuarios** | Implementado | Configuración → Usuarios y Accesos (lista, nuevo, editar). Solo accesible para rol Administrador. |
| **Seed inicial** | Implementado | Si no hay usuarios o no existe `admin`, se crean Admin (admin/admin123) y Juan Farmacéutico (juan.farm/farm123) con contraseñas hasheadas. |
| **Sidebar por rol** | Parcial | Solo la sección "Configuración" se oculta si no es admin. Compras, Proveedores, Inventario se muestran a todos; el `roleGuard` impide el acceso al entrar. |

### 1.2 Gaps y riesgos (qué falta o mejorar)

| Gap | Impacto | Prioridad para Alfa/Beta |
|-----|---------|---------------------------|
| **Sesión sin caducidad** | La sesión vive hasta cerrar o borrar datos. En un PC compartido, si no cierran sesión, cualquiera sigue dentro. | Media: recomendable para beta (timeout o “recordar sesión” limitado). |
| **returnUrl no usado** | Tras login se va siempre a `/dashboard`; no se redirige a la ruta que intentaba abrir el usuario. | Baja: mejora de UX; se puede dejar para beta. |
| **Menú visible sin permiso** | Cajero ve Compras, Proveedores, Inventario; al entrar recibe “No tienes permisos” y vuelve al dashboard. | Media: mejor ocultar en el sidebar según rol para alfa/beta. |
| **Cambio de contraseña** | No hay “cambiar mi contraseña” ni “primera vez que entro, debo cambiar contraseña”. | Baja para alfa; recomendable para beta si hay varios usuarios. |
| **Política de contraseña** | No hay longitud mínima ni complejidad en el frontend/backend. | Baja para alfa; opcional para beta. |
| **Auditoría “quién hizo qué”** | Parcial (por ejemplo `registrado_por`, `cajero_id` en algunas tablas). No hay trazabilidad completa. | Baja para alfa; se puede ir ampliando en beta. |

### 1.3 Resumen autenticación/autorización

- **Para alfa:** Lo actual es suficiente: login seguro, sesión persistente, rutas protegidas por auth y por rol, gestión de usuarios solo para admin. Opcional: ocultar en el menú las secciones sin permiso para evitar el mensaje “no tienes permisos”.
- **Para beta:** Añadir: (1) ocultar en sidebar según rol, (2) uso de `returnUrl` tras login, (3) sesión con caducidad o “recordar sesión” limitado y (4) opcional: cambio de contraseña y política básica.

---

## 2. Dashboard

### 2.1 Estado actual (lo que ya tienes)

| Elemento | Estado | Detalle |
|----------|--------|---------|
| **Estructura general** | Implementado | Título “Panel de Control”, badge “Sistema Activo”, bloques de KPIs, gráfico, alertas, accesos rápidos. |
| **KPI – Ventas de hoy** | No implementado | Siempre 0. Comentario en código: “Se implementará con el módulo de ventas”. El módulo de ventas ya existe; falta conectar con datos reales. |
| **KPI – Catálogo** | Implementado | Total de productos (desde `productosService.obtenerEstadisticas()`). |
| **KPI – Alertas de stock** | Implementado | Cantidad de productos con stock bajo. |
| **KPI – Vencimientos** | Implementado | Productos/lotes con vencimiento próximo (desde estadísticas). |
| **Gráfico “Tendencia de ventas”** | Datos falsos | Array fijo por día (Lun–Dom). No usa ventas reales. |
| **Alertas críticas** | Implementado | Vencimientos en 30 días (consulta a BD) y mensaje de stock bajo. |
| **“Ver todas las notificaciones”** | Sin acción | El botón no navega ni abre nada. |
| **Accesos rápidos** | Parcial | Enlaces a Ventas, Compras, Productos y **Clientes**. No existe ruta `/clientes` en `app.routes`; el enlace puede dar 404. |
| **Vista por rol** | No | Mismo dashboard para todos los roles (admin, farmacéutico, cajero, almacén). |

### 2.2 Gaps y riesgos

| Gap | Impacto | Prioridad para Alfa/Beta |
|-----|---------|---------------------------|
| **Ventas de hoy en 0** | El KPI más visible no aporta. | Alta para alfa: conectar con ventas del día. |
| **Gráfico con datos falsos** | Da sensación de demo, no de datos reales. | Alta para alfa: al menos ventas por día (últimos 7 días). |
| **Botón “Ver todas las notificaciones”** | No hace nada. | Media: enlazar a inventario/vencimientos o quitar/deshabilitar. |
| **Enlace a Clientes** | 404 si no existe ruta. | Media: añadir ruta o quitar/cambiar el acceso rápido. |
| **Sin KPIs de compras** | No se ve carga de trabajo de compras (órdenes pendientes, saldos). | Baja para alfa; útil para beta. |
| **Mismo dashboard para todos** | No se adapta al rol (p. ej. cajero vs admin). | Baja para alfa; mejora para beta. |

### 2.3 Resumen dashboard

- **Para alfa:** Es imprescindible que el dashboard no “mienta”: (1) Ventas de hoy con datos reales, (2) gráfico con ventas reales (p. ej. últimos 7 días) y (3) corregir o quitar “Ver todas las notificaciones” y el enlace a Clientes.
- **Para beta:** Añadir KPIs de compras si aplica, y opcionalmente vista o bloques distintos por rol.

---

## 3. Cómo quedaría cada versión

### Versión alfa (primera entrega interna / prueba cerrada)

Objetivo: que la app sea creíble y usable en un entorno controlado (tú, un colaborador), con login real y un dashboard que refleje datos reales.

**Autenticación y autorización**

- Mantener todo lo actual (login, guards, gestión de usuarios).
- Recomendable: **ocultar en el sidebar** las secciones a las que el usuario no tiene acceso (según rol), para no mostrar Compras/Proveedores/Inventario a un cajero.

**Dashboard**

- Conectar **Ventas de hoy** con el módulo de ventas (suma de ventas del día).
- Sustituir el gráfico por **datos reales** (ventas por día, últimos 7 días).
- **“Ver todas las notificaciones”**: enlazar a inventario/vencimientos o quitarlo/deshabilitarlo.
- **Clientes**: si no existe la ruta, quitar el acceso rápido o crear una ruta mínima (lista de clientes).

Con esto se puede **lanzar la alfa** con usuarios, autenticación y autorización creíbles y un dashboard útil.

---

### Versión beta (prueba con más usuarios / farmacia piloto)

Objetivo: uso por varios roles en condiciones más cercanas a producción.

**Autenticación y autorización**

- Todo lo de alfa.
- **returnUrl**: después del login, redirigir a la URL que el usuario intentaba abrir (si existe y está permitida).
- **Sesión con caducidad** (p. ej. 8 horas) o “recordar sesión” con límite de tiempo; al caducar, cerrar sesión y volver a login.
- Opcional: pantalla **“Cambiar mi contraseña”** (y, si quieres, obligar al primer login a cambiarla).
- Opcional: política mínima de contraseña (longitud, etc.) en creación/edición de usuarios.

**Dashboard**

- Todo lo de alfa.
- Opcional: **KPIs de compras** (órdenes pendientes, saldos por pagar).
- Opcional: **vista por rol** (p. ej. cajero: ventas y alertas; admin: todo lo anterior + resumen compras y usuarios).

---

## 4. Checklist resumido

| Tema | Para Alfa | Para Beta |
|------|-----------|-----------|
| **Auth** | Login, guards y roles actuales; opcional ocultar menú por rol | + returnUrl, sesión con caducidad; opcional cambio de contraseña y política. |
| **Dashboard** | Ventas de hoy real, gráfico real, arreglar notificaciones y Clientes | + opcional KPIs compras y vista por rol. |

Con estos dos apartados (usuarios/autenticación/autorización y dashboard) alineados con la tabla, se puede lanzar primero una **versión alfa** y después una **beta** con criterio claro y sin promesas vacías en pantalla.
