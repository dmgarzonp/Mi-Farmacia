# Respaldos de base de datos y actualizaciones de la aplicación

## Situación actual

- **Base de datos:** SQLite (`better-sqlite3`) en `userData/farmacia.db` (ruta por sistema: ver más abajo).
- **Respaldos:** No hay ninguna funcionalidad de respaldo ni restauración implementada.
- **Actualizaciones:** No hay `electron-updater` ni comprobación de nuevas versiones; el usuario debe instalar manualmente si publicas una nueva versión.

---

## 1. Respaldos de base de datos

### Dónde está la base de datos

En Electron, `app.getPath('userData')` devuelve una carpeta por usuario y por aplicación, por ejemplo:

- **Windows:** `C:\Users\<usuario>\AppData\Roaming\Mi Farmacia\`
- **Linux:** `~/.config/mi-farmacia/` (o el nombre que tenga la app)
- **macOS:** `~/Library/Application Support/Mi Farmacia/`

Ahí se crea el archivo `farmacia.db`. Si usas modo WAL (como en tu `electron.js`), también existen `farmacia.db-wal` y `farmacia.db-shm`. Para un respaldo consistente hay que hacer un **checkpoint** de WAL antes de copiar, para que todo quede en el `.db`.

### Cómo se puede manejar

| Enfoque | Descripción |
|--------|-------------|
| **Copia del .db** | Hacer checkpoint, copiar `farmacia.db` a una carpeta que elija el usuario (o una subcarpeta `Backups` en userData). Rápido y fácil de restaurar. |
| **Export SQL** | Volcar el contenido a un `.sql` (dump). Útil para inspección o importar en otro sistema; restaurar implica recrear la BD y ejecutar el SQL. |
| **Programado** | Desde Electron, con `setInterval` o tarea del SO, copiar el .db cada X horas/días a una ruta fija. |

### Restauración

- **Desde .db:** Cerrar la conexión actual, reemplazar `farmacia.db` (y opcionalmente borrar `-wal` y `-shm`), reiniciar la app (o reabrir la conexión).  
- **Desde .sql:** Crear una BD nueva y ejecutar el contenido del archivo (por ejemplo con `db.exec(readFileSync('respaldo.sql','utf8'))`).

### Implementación recomendada en la app

1. **Electron (main):**  
   - Handler IPC por ejemplo `backup:create`: obtener ruta con `dialog.showSaveDialog` (o carpeta con `showOpenDialog`), hacer `db.pragma('wal_checkpoint(TRUNCATE)')`, copiar `farmacia.db` a esa ruta (nombre tipo `farmacia_respaldo_YYYY-MM-DD.db`).  
   - Handler `backup:restore`: avisar al usuario que debe cerrar la app, luego (o en un proceso auxiliar) reemplazar el archivo; o hacer “restaurar la próxima vez que se abra”.

2. **Angular:**  
   - Servicio que llame a `window.electronAPI.backupCreate()` / `backupRestore()`.  
   - Pantalla en **Configuración** (solo administrador): “Respaldo y restauración” con botones “Crear respaldo” y “Restaurar desde archivo”, y texto breve de advertencia en restauración.

3. **Opcional:** Carpeta fija de respaldos en userData y botón “Abrir carpeta de respaldos” para que el usuario copie/pegue manualmente si lo prefiere.

---

## 2. Gestión de actualizaciones de la aplicación

### Opciones

| Enfoque | Descripción |
|--------|-------------|
| **Manual** | Publicas un nuevo instalador (AppImage, .deb, .exe, .dmg) en tu web o GitHub. El usuario lo descarga e instala. La BD y config en `userData` se mantienen. No requiere código extra. |
| **Auto-actualizador (electron-updater)** | La app comprueba si hay versión nueva (GitHub Releases o servidor propio), descarga el paquete e instala (o pide “Reiniciar para aplicar”). Requiere configurar publicación y lógica en main process. |

### Cómo funciona electron-updater (resumen)

1. **Build:** Con `electron-builder` generas el instalador y (opcional) lo publicas en GitHub Releases o en un servidor.
2. **Configuración:** En `package.json` (o en código) indicas dónde están las versiones, por ejemplo:
   - `"publish": { "provider": "github", "owner": "tu-usuario", "repo": "Mi-Farmacia" }`
3. **En el main process (electron.js):**
   - `const { autoUpdater } = require('electron-updater');`
   - Al arrancar (o desde un menú “Buscar actualizaciones”): `autoUpdater.checkForUpdates()`.
   - Escuchar eventos: `update-available`, `update-not-available`, `update-downloaded`, `error`.
   - Cuando `update-downloaded`, mostrar diálogo “Actualización lista. ¿Reiniciar ahora?” y llamar a `autoUpdater.quitAndInstall()`.
4. **Versión:** La versión que se compara es la de `package.json` (`version`) o la que pongas en el build. El “Acerca de” en la app puede leer esa misma versión para mostrarla.

### Sin auto-updater

- Mantén la versión en `package.json` y en `app-info.ts` (o en un solo sitio y el otro que lo importe/lea).
- En cada release, sube el instalador y documenta en el repo qué versión es y qué cambia.
- El usuario actualiza cuando quiera descargando e instalando; la base de datos no se toca.

---

## Resumen

- **Respaldos:** Hoy no hay nada. Lo más útil es implementar “Crear respaldo” (copia del .db tras checkpoint) y “Restaurar” (elegir .db y reemplazar, con aviso de reinicio), más una pantalla en Configuración.
- **Actualizaciones:** Hoy es manual. Para automatizar, añadir `electron-updater`, publicar builds en GitHub (o servidor) y manejar `checkForUpdates` y eventos en Electron; la gestión de la BD no cambia.

Si quieres, el siguiente paso puede ser implementar solo los respaldos (IPC + servicio Angular + pantalla en Configuración) y dejar las actualizaciones documentadas para más adelante.
