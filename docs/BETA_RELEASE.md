# Versión Beta de Mi Farmacia

## ¿Qué es una versión beta?

Una **beta** es una versión del aplicativo que:
- Ya tiene las funciones principales listas para probar en uso real.
- Puede tener fallos o cambios de comportamiento hasta sacar la versión estable.
- Se entrega a un grupo reducido (tú, empleados, una farmacia piloto) para usar y dar feedback antes de considerarla “definitiva”.

---

## Sugerencias para sacar tu beta

### 1. Versión y etiquetado

- **Opción A (recomendada):** Usar versión tipo `1.2.0-beta.1`, `1.2.0-beta.2`, etc.
  - En `package.json`: `"version": "1.2.0-beta.1"`.
  - En Git: tag `v1.2.0-beta.1`.
  - Cuando la beta esté estable, pasas a `1.2.0` (sin “beta”) y ese es tu release estable.

- **Opción B:** Mantener versión `1.2.0` y distinguir solo por nombre:
  - Ejemplo: “Mi Farmacia 1.2.0 (Beta)” en la interfaz o en el título de la ventana.
  - Útil si no quieres tocar números de versión aún.

### 2. Generar el instalador (Electron)

Tu proyecto ya tiene script de build para Linux (AppImage y .deb):

```bash
npm run electron:build
```

Los instaladores se generan en la carpeta **`release/`** (según tu `package.json`). Ahí tendrás algo como:
- `Mi Farmacia-1.2.0.AppImage`
- `mi-farmacia_1.2.0_amd64.deb`

**Sugerencia:** Antes de ejecutar el build, pon en `package.json` la versión que quieras que lleve el instalador (ej. `1.2.0-beta.1`).

### 3. Dónde publicar la beta

- **GitHub Releases (recomendado):**
  - Creas un release con tag `v1.2.0-beta.1`.
  - Marcas el release como **“Pre-release”** (checkbox en la pantalla de crear/editar release).
  - Subes los archivos de `release/` (AppImage y .deb) como adjuntos.
  - En la descripción pones: “Versión beta para pruebas. Cambios: [lista breve].”

- **Copia manual:** Si no usas GitHub Releases, puedes copiar la carpeta `release/` a USB o a una carpeta compartida y que los probadores instalen desde ahí.

### 4. Quién prueba la beta

- Empleados de la farmacia.
- Una sola sucursal o PC al inicio.
- Definir 1–2 personas que anoten fallos o dudas (formulario corto o lista en un doc).

### 5. Qué pedir a los probadores

- Que usen el flujo real: ventas, compras, órdenes, saldos, proveedores.
- Que anoten: pantalla donde pasó, qué hicieron, qué esperaban, qué pasó.
- Plazo corto (ej. 1–2 semanas) y luego reunión rápida para revisar y decidir si pasas a v1.2.0 estable.

### 6. Diferenciar beta en la app (opcional)

Para que se vea que es beta sin cambiar lógica:

- En el **título de la ventana** (Electron): “Mi Farmacia 1.2.0 (Beta)”.
- O un pequeño texto/badge en el header o login: “Modo beta – solo para pruebas”.

Así evitas que alguien confunda la beta con la versión de producción.

---

## Resumen rápido

| Paso | Acción |
|------|--------|
| 1 | En `package.json` poner `"version": "1.2.0-beta.1"`. |
| 2 | Ejecutar `npm run electron:build`. |
| 3 | Revisar que en `release/` estén los instaladores. |
| 4 | Crear en GitHub el tag `v1.2.0-beta.1` y un Release marcado como Pre-release. |
| 5 | Subir los archivos de `release/` al Release. |
| 6 | Entregar el enlace (o los instaladores) a los probadores y recoger feedback. |

Cuando la beta esté estable, repites el proceso con versión `1.2.0` (sin “-beta”), sin marcar como Pre-release, y esa será tu versión estable.
