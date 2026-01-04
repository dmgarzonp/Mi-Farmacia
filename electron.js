const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const initialData = require('./database/initial-data');
const sriLogic = require('./sri-logic');

let mainWindow;
let db;

/**
 * Inicializa la base de datos SQLite
 */
function initDatabase() {
    const dbPath = path.join(app.getPath('userData'), 'farmacia.db');
    console.log('Database path:', dbPath);

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON'); // Activar soporte de llaves foráneas

    // Crear tablas si no existen
    createTables();

    return db;
}

/**
 * Crea las tablas de la base de datos
 */
function createTables() {
    const schema = `
    -- === TABLAS DE APOYO ===
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS laboratorios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      pais TEXT DEFAULT 'Ecuador',
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo'))
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_empresa TEXT NOT NULL,
      ruc TEXT UNIQUE,
      direccion TEXT,
      telefono_empresa TEXT,
      email_empresa TEXT,
      nombre_contacto TEXT,
      cargo_contacto TEXT,
      telefono_contacto TEXT,
      email_contacto TEXT,
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      documento TEXT UNIQUE,
      nombre_completo TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      fecha_nacimiento DATE
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('administrador', 'farmaceutico', 'cajero', 'almacen')),
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo'))
    );

    -- === PRODUCTOS (catálogo maestro genérico) ===
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_interno TEXT UNIQUE,
      nombre_comercial TEXT NOT NULL,
      principio_activo TEXT,
      laboratorio_id INTEGER,
      categoria_id INTEGER,
      requiere_receta BOOLEAN DEFAULT 0,
      es_controlado BOOLEAN DEFAULT 0,
      tarifa_iva INTEGER DEFAULT 0, -- 0: 0%, 2: 15% (según catálogo SRI), 6: No Objeto, 7: Exento
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo')),
      FOREIGN KEY(laboratorio_id) REFERENCES laboratorios(id),
      FOREIGN KEY(categoria_id) REFERENCES categorias(id)
    );

    -- === PRESENTACIONES (cómo se empaqueta y vende) ===
    CREATE TABLE IF NOT EXISTS presentaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      nombre_descriptivo TEXT NOT NULL, -- Ej: "Caja x 100 tabletas"
      unidad_base TEXT NOT NULL,        -- Ej: "tableta"
      unidades_por_caja INTEGER NOT NULL DEFAULT 1,
      precio_compra_caja REAL DEFAULT 0,
      precio_venta_unidad REAL DEFAULT 0,
      precio_venta_caja REAL DEFAULT 0,
      stock_minimo INTEGER DEFAULT 0,
      codigo_barras TEXT UNIQUE,
      vencimiento_predeterminado_meses INTEGER DEFAULT 0,
      FOREIGN KEY(producto_id) REFERENCES productos(id) ON DELETE CASCADE
    );

    -- === LOTES (inventario real con trazabilidad por presentación) ===
    CREATE TABLE IF NOT EXISTS lotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presentacion_id INTEGER NOT NULL,
      lote TEXT NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      stock_actual INTEGER DEFAULT 0 CHECK(stock_actual >= 0), -- En unidades base
      precio_compra_caja REAL DEFAULT 0,
      precio_compra_unitario REAL DEFAULT 0, -- Calculado (compra_caja / unid_por_caja)
      ubicacion TEXT,
      fecha_ingreso DATE DEFAULT CURRENT_DATE,
      FOREIGN KEY(presentacion_id) REFERENCES presentaciones(id) ON DELETE CASCADE
    );

    -- === COMPRAS ===
    CREATE TABLE IF NOT EXISTS ordenes_compra (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id INTEGER NOT NULL,
      fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
      fecha_requerida DATE,
      estado TEXT DEFAULT 'borrador' CHECK(estado IN ('borrador', 'pendiente', 'aprobada', 'recibida', 'cancelada')),
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      descuento_monto REAL DEFAULT 0 CHECK(descuento_monto >= 0),
      impuesto_total REAL DEFAULT 0 CHECK(impuesto_total >= 0),
      total REAL NOT NULL CHECK(total >= 0),
      moneda TEXT DEFAULT 'USD',
      numero_factura TEXT,
      fecha_factura DATE,
      creado_por INTEGER,
      aprobado_por INTEGER,
      observaciones TEXT,
      FOREIGN KEY(proveedor_id) REFERENCES proveedores(id),
      FOREIGN KEY(creado_por) REFERENCES usuarios(id),
      FOREIGN KEY(aprobado_por) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS ordenes_compra_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orden_compra_id INTEGER NOT NULL,
      presentacion_id INTEGER NOT NULL,
      cantidad REAL NOT NULL CHECK(cantidad > 0), -- Cantidad en CAJAS
      precio_unitario REAL NOT NULL CHECK(precio_unitario >= 0), -- Precio por CAJA
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      lote TEXT,
      fecha_vencimiento DATE,
      FOREIGN KEY(orden_compra_id) REFERENCES ordenes_compra(id) ON DELETE CASCADE,
      FOREIGN KEY(presentacion_id) REFERENCES presentaciones(id)
    );

    -- === VENTAS ===
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER,
      fecha_venta DATETIME DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      impuesto_total REAL DEFAULT 0 CHECK(impuesto_total >= 0),
      total REAL NOT NULL CHECK(total >= 0),
      estado TEXT DEFAULT 'completada' CHECK(estado IN ('completada', 'anulada')),
      -- Facturación Electrónica SRI (Fase 2)
      clave_acceso TEXT UNIQUE,
      numero_autorizacion TEXT,
      fecha_autorizacion TEXT,
      estado_sri TEXT DEFAULT 'pendiente', -- pendiente, recibido, autorizado, rechazado, devuelto
      xml_generado TEXT,
      cajero_id INTEGER,
      metodo_pago TEXT,
      FOREIGN KEY(cliente_id) REFERENCES clientes(id),
      FOREIGN KEY(cajero_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS ventas_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      lote_id INTEGER NOT NULL,
      presentacion_id INTEGER, -- Añadido para trazabilidad directa
      cantidad REAL NOT NULL CHECK(cantidad > 0),
      precio_unitario REAL NOT NULL CHECK(precio_unitario >= 0),
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      FOREIGN KEY(venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
      FOREIGN KEY(lote_id) REFERENCES lotes(id),
      FOREIGN KEY(presentacion_id) REFERENCES presentaciones(id)
    );

    -- === RECETAS ===
    CREATE TABLE IF NOT EXISTS recetas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      cliente_id INTEGER,
      medico_nombre TEXT,
      medico_registro TEXT,
      receta_numero TEXT,
      fecha_emision DATE,
      observaciones TEXT,
      estado TEXT DEFAULT 'validada' CHECK(estado IN ('validada', 'rechazada', 'pendiente')),
      FOREIGN KEY(venta_id) REFERENCES ventas(id),
      FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    );

    -- === AUDITORÍA: MOVIMIENTOS DE STOCK ===
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada_compra', 'salida_venta', 'ajuste_positivo', 'ajuste_negativo', 'vencimiento', 'devolucion')),
      lote_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL,
      documento_referencia TEXT,
      fecha_movimiento DATETIME DEFAULT CURRENT_TIMESTAMP,
      usuario_id INTEGER,
      observaciones TEXT,
      FOREIGN KEY(lote_id) REFERENCES lotes(id),
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    );

    -- === ÍNDICES PARA RENDIMIENTO ===
    CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes(fecha_vencimiento);
    CREATE INDEX IF NOT EXISTS idx_lotes_presentacion ON lotes(presentacion_id);
    CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_venta);
    CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON ordenes_compra(proveedor_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_lote ON movimientos_stock(lote_id);
    CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre_comercial);
    CREATE INDEX IF NOT EXISTS idx_productos_laboratorio ON productos(laboratorio_id);
  `;

    // Verificación de esquema previo (Migración destructiva para desarrollo)
    try {
        const tableInfo = db.prepare("PRAGMA table_info(presentaciones)").all();
        const hasPrecioCompra = tableInfo.some(col => col.name === 'precio_compra_caja');
        const isOldLotes = db.prepare("PRAGMA table_info(lotes)").all().some(col => col.name === 'producto_id');
        
        if (isOldLotes || !hasPrecioCompra) {
            console.log('Old schema detected. Resetting tables for new Product-Presentation-Lote architecture...');
            db.exec('PRAGMA foreign_keys = OFF;');
            db.exec('DROP TABLE IF EXISTS lotes;');
            db.exec('DROP TABLE IF EXISTS presentaciones;');
            db.exec('DROP TABLE IF EXISTS productos;');
            db.exec('DROP TABLE IF EXISTS ordenes_compra_detalles;');
            db.exec('DROP TABLE IF EXISTS ventas_detalles;');
            db.exec('DROP TABLE IF EXISTS movimientos_stock;');
            db.exec('PRAGMA foreign_keys = ON;');
        }
    } catch (e) {
        console.error('Error checking schema:', e);
    }

    // Asegurar columnas de facturación electrónica en ventas (Fase 2)
    try {
        const tableInfoVentas = db.prepare("PRAGMA table_info(ventas)").all();
        if (!tableInfoVentas.some(col => col.name === 'clave_acceso')) {
            console.log('Adding SRI columns to ventas...');
            db.exec(`
                ALTER TABLE ventas ADD COLUMN clave_acceso TEXT;
                ALTER TABLE ventas ADD COLUMN numero_autorizacion TEXT;
                ALTER TABLE ventas ADD COLUMN fecha_autorizacion TEXT;
                ALTER TABLE ventas ADD COLUMN estado_sri TEXT DEFAULT 'pendiente';
                ALTER TABLE ventas ADD COLUMN xml_generado TEXT;
            `);
        }
    } catch (e) {
        console.error('Error ensuring SRI columns in ventas:', e);
    }

    // Asegurar columna tarifa_iva en productos (Fase 1)
    try {
        const tableInfoProd = db.prepare("PRAGMA table_info(productos)").all();
        if (!tableInfoProd.some(col => col.name === 'tarifa_iva')) {
            console.log('Adding tarifa_iva column to productos...');
            db.exec('ALTER TABLE productos ADD COLUMN tarifa_iva INTEGER DEFAULT 0;');
        }
    } catch (e) {
        console.error('Error ensuring tarifa_iva column in productos:', e);
    }

    // Asegurar columna es_fraccion en ventas_detalles (Venta Fraccionada)
    try {
        const tableInfoVDet = db.prepare("PRAGMA table_info(ventas_detalles)").all();
        if (!tableInfoVDet.some(col => col.name === 'es_fraccion')) {
            console.log('Adding es_fraccion column to ventas_detalles...');
            db.exec('ALTER TABLE ventas_detalles ADD COLUMN es_fraccion INTEGER DEFAULT 0;');
        }
    } catch (e) {
        console.error('Error ensuring es_fraccion column in ventas_detalles:', e);
    }

    // Asegurar columnas en recetas (ARCSA / Controlados)
    try {
        const tableInfoRec = db.prepare("PRAGMA table_info(recetas)").all();
        if (!tableInfoRec.some(col => col.name === 'medico_registro')) {
            console.log('Adding medico_registro and receta_numero to recetas...');
            db.exec('ALTER TABLE recetas ADD COLUMN medico_registro TEXT;');
            db.exec('ALTER TABLE recetas ADD COLUMN receta_numero TEXT;');
        }
    } catch (e) {
        console.error('Error ensuring columns in recetas:', e);
    }

    // Asegurar columnas de autenticación en usuarios
    try {
        const tableInfoUsers = db.prepare("PRAGMA table_info(usuarios)").all();
        if (!tableInfoUsers.some(col => col.name === 'username')) {
            console.log('Adding auth columns to usuarios...');
            db.exec(`
                ALTER TABLE usuarios ADD COLUMN username TEXT;
                ALTER TABLE usuarios ADD COLUMN password TEXT;
            `);
            // Actualizar usuarios existentes con valores por defecto
            db.exec(`
                UPDATE usuarios SET username = LOWER(REPLACE(nombre, ' ', '.')), password = '123' WHERE username IS NULL;
            `);
        }
    } catch (e) {
        console.error('Error ensuring auth columns in usuarios:', e);
    }

    db.exec(schema);
    console.log('Database tables created/checked successfully');

    // Insertar datos iniciales
    seedInitialData();
}

/**
 * Inserta datos iniciales para pruebas usando transacciones
 */

/**
 * Inserta datos iniciales para pruebas usando transacciones
 */
function seedInitialData() {
    const count = db.prepare('SELECT COUNT(*) as count FROM categorias').get();

    if (count.count === 0) {
        console.log('Seeding initial data using transactions...');

        // 1. Inserción de Categorías
        const insertCategoria = db.prepare('INSERT INTO categorias (nombre) VALUES (?)');
        const seedCategorias = db.transaction((categorias) => {
            for (const nombre of categorias) insertCategoria.run(nombre);
        });
        seedCategorias(initialData.CATEGORIAS);

        // 2. Inserción de Laboratorios
        const insertLab = db.prepare('INSERT INTO laboratorios (nombre, pais) VALUES (?, ?)');
        const seedLabs = db.transaction((labs) => {
            for (const lab of labs) insertLab.run(lab.nombre, lab.pais);
        });
        seedLabs(initialData.LABORATORIOS);

        // 3. Inserción de Proveedores
        const insertProv = db.prepare(`
            INSERT INTO proveedores (
                nombre_empresa, ruc, direccion, telefono_empresa, email_empresa, 
                nombre_contacto, cargo_contacto, telefono_contacto, email_contacto
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const seedProvs = db.transaction((provs) => {
            for (const p of provs) {
                insertProv.run(
                    p.nombreEmpresa, p.ruc, p.direccion, p.telefonoEmpresa, p.emailEmpresa,
                    p.nombreContacto, p.cargoContacto, p.telefonoContacto, p.emailContacto
                );
            }
        });
        seedProvs(initialData.PROVEEDORES);

        // 4. Inserción de Productos y Presentaciones
        const insertProd = db.prepare(`
            INSERT INTO productos (
                nombre_comercial, principio_activo, 
                categoria_id, laboratorio_id, requiere_receta, es_controlado, estado
            ) VALUES (?, ?, ?, ?, ?, ?, 'activo')
        `);

        const insertPres = db.prepare(`
            INSERT INTO presentaciones (
                producto_id, nombre_descriptivo, unidad_base, unidades_por_caja,
                precio_venta_unidad, precio_venta_caja, stock_minimo, codigo_barras
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const seedProds = db.transaction((prods) => {
            for (const p of prods) {
                const cat = db.prepare('SELECT id FROM categorias WHERE nombre = ?').get(p.categoria);
                const lab = p.laboratorio ? db.prepare('SELECT id FROM laboratorios WHERE nombre = ?').get(p.laboratorio) : null;

                const prodResult = insertProd.run(
                    p.nombreComercial, p.principioActivo,
                    cat ? cat.id : null, lab ? lab.id : null,
                    p.requiereReceta ? 1 : 0, p.esControlado ? 1 : 0
                );

                const productoId = prodResult.lastInsertRowid;

                // Crear presentación por defecto
                const unidadesPorCaja = p.unidadesPorCaja || 1;
                const precioVentaUnidad = p.precioVentaUnidad || (p.precioVenta / unidadesPorCaja);
                
                insertPres.run(
                    productoId,
                    p.presentacion || `Caja x ${unidadesPorCaja}`,
                    'unidad',
                    unidadesPorCaja,
                    precioVentaUnidad,
                    p.precioVenta,
                    p.stockMinimo || 5,
                    p.codigoBarras || null
                );
            }
        });
        seedProds(initialData.PRODUCTOS);
    }

    // 5. Usuarios iniciales con contraseña segura si no hay ninguno o si no existe admin
    const userCount = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
    const adminExists = db.prepare('SELECT COUNT(*) as count FROM usuarios WHERE username = ?').get('admin');

    if (userCount.count === 0 || adminExists.count === 0) {
        console.log('Ensuring admin user exists...');
        const salt = bcrypt.genSaltSync(10);
        const passAdmin = bcrypt.hashSync('admin123', salt);

        if (adminExists.count === 0) {
            const insertUsuario = db.prepare('INSERT INTO usuarios (nombre, username, password, rol) VALUES (?, ?, ?, ?)');
            insertUsuario.run('Admin Sistema', 'admin', passAdmin, 'administrador');
        }

        if (userCount.count === 0) {
            const passFarm = bcrypt.hashSync('farm123', salt);
            const insertUsuario = db.prepare('INSERT INTO usuarios (nombre, username, password, rol) VALUES (?, ?, ?, ?)');
            insertUsuario.run('Juan Farmacéutico', 'juan.farm', passFarm, 'farmaceutico');
        }
    }
}


/**
 * Crea la ventana principal de Electron
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        frame: false, // Quita el marco y la barra de título nativa
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'src/assets/icon.png'),
        show: false
    });

    // En desarrollo, cargar desde el servidor de Angular
    // En producción, cargar desde archivos compilados
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        mainWindow.loadURL('http://localhost:4200');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist/mi-farmacia/browser/index.html'));
    }

    mainWindow.webContents.on('before-input-event', (event, input) => {
        // Ctrl+Shift+I o F12 para abrir consola
        if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
        // Ctrl+R o F5 para recargar
        if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
            mainWindow.reload();
            event.preventDefault();
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * Configurar IPC handlers para comunicación con el renderer
 */
function setupIpcHandlers() {
    // Ejecutar query SQL genérico
    ipcMain.handle('db:query', async (event, sql, params = []) => {
        try {
            const stmt = db.prepare(sql);
            const result = stmt.all(...params);
            return { success: true, data: result };
        } catch (error) {
            console.error('Database query error:', error);
            return { success: false, error: error.message };
        }
    });

    // Ejecutar comando SQL (INSERT, UPDATE, DELETE)
    ipcMain.handle('db:run', async (event, sql, params = []) => {
        try {
            const stmt = db.prepare(sql);
            const result = stmt.run(...params);
            return { success: true, data: result };
        } catch (error) {
            console.error('Database run error:', error);
            return { success: false, error: error.message };
        }
    });

    // Obtener un solo registro
    ipcMain.handle('db:get', async (event, sql, params = []) => {
        try {
            const stmt = db.prepare(sql);
            const result = stmt.get(...params);
            return { success: true, data: result };
        } catch (error) {
            console.error('Database get error:', error);
            return { success: false, error: error.message };
        }
    });

    // Obtener locale del sistema
    ipcMain.handle('app:getLocale', () => {
        return app.getLocale();
    });

    // --- SRI FACTURACIÓN ELECTRÓNICA ---
    ipcMain.handle('sri:generar-xml', async (event, { venta, config, cliente }) => {
        try {
            const xml = sriLogic.generarXmlFactura(venta, config, cliente);
            return { success: true, data: xml };
        } catch (error) {
            console.error('Error SRI Generar XML:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('sri:firmar-xml', async (event, { xml, rutaP12, password }) => {
        try {
            const xmlFirmado = await sriLogic.firmarXml(xml, rutaP12, password);
            return { success: true, data: xmlFirmado };
        } catch (error) {
            console.error('Error SRI Firmar XML:', error);
            return { success: false, error: error.message };
        }
    });

    // --- AUTENTICACIÓN ---
    ipcMain.handle('auth:login', async (event, { username, password }) => {
        try {
            const user = db.prepare("SELECT * FROM usuarios WHERE username = ? AND estado = 'activo'").get(username);
            if (!user) return { success: false, error: 'Usuario no encontrado' };

            const validPassword = bcrypt.compareSync(password, user.password);
            if (!validPassword) return { success: false, error: 'Contraseña incorrecta' };

            // No devolver el password al frontend
            const { password: _, ...userSafe } = user;
            return { success: true, data: userSafe };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('auth:hash-password', async (event, password) => {
        const salt = bcrypt.genSaltSync(10);
        return bcrypt.hashSync(password, salt);
    });

    // Control de Ventana (Barra de título personalizada)
    ipcMain.on('window:minimize', () => {
        mainWindow.minimize();
    });

    ipcMain.on('window:maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });

    ipcMain.on('window:close', () => {
        mainWindow.close();
    });
}

// Eventos de ciclo de vida de Electron
app.whenReady().then(() => {
    Menu.setApplicationMenu(null); // Elimina el menú nativo por completo
    initDatabase();
    setupIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (db) {
            db.close();
        }
        app.quit();
    }
});

app.on('before-quit', () => {
    if (db) {
        db.close();
    }
});
