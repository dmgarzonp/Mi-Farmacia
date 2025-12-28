const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

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
      rol TEXT NOT NULL CHECK(rol IN ('administrador', 'farmaceutico', 'cajero', 'almacen')),
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo'))
    );

    -- === PRODUCTOS (catálogo maestro) ===
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_barras TEXT UNIQUE,
      codigo_interno TEXT UNIQUE,
      nombre_comercial TEXT NOT NULL,
      principio_activo TEXT,
      presentacion TEXT,
      laboratorio_id INTEGER,
      categoria_id INTEGER,
      precio_venta REAL DEFAULT 0,
      stock_minimo INTEGER DEFAULT 0,
      requiere_receta BOOLEAN DEFAULT 0,
      es_controlado BOOLEAN DEFAULT 0,
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo')),
      FOREIGN KEY(laboratorio_id) REFERENCES laboratorios(id),
      FOREIGN KEY(categoria_id) REFERENCES categorias(id)
    );

    -- === LOTES (inventario real con trazabilidad) ===
    CREATE TABLE IF NOT EXISTS lotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      lote TEXT NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      stock_actual INTEGER DEFAULT 0 CHECK(stock_actual >= 0),
      ubicacion TEXT,
      fecha_ingreso DATE DEFAULT CURRENT_DATE,
      UNIQUE(producto_id, lote),
      FOREIGN KEY(producto_id) REFERENCES productos(id) ON DELETE CASCADE
    );

    -- === COMPRAS ===
    CREATE TABLE IF NOT EXISTS ordenes_compra (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id INTEGER NOT NULL,
      fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
      fecha_requerida DATE,
      estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'aprobada', 'recibida', 'cancelada')),
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
      producto_id INTEGER NOT NULL,
      cantidad REAL NOT NULL CHECK(cantidad > 0),
      precio_unitario REAL NOT NULL CHECK(precio_unitario >= 0),
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      lote TEXT NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      FOREIGN KEY(orden_compra_id) REFERENCES ordenes_compra(id) ON DELETE CASCADE,
      FOREIGN KEY(producto_id) REFERENCES productos(id)
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
      cajero_id INTEGER,
      metodo_pago TEXT,
      FOREIGN KEY(cliente_id) REFERENCES clientes(id),
      FOREIGN KEY(cajero_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS ventas_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      lote_id INTEGER NOT NULL,
      cantidad REAL NOT NULL CHECK(cantidad > 0),
      precio_unitario REAL NOT NULL CHECK(precio_unitario >= 0),
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      FOREIGN KEY(venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
      FOREIGN KEY(lote_id) REFERENCES lotes(id)
    );

    -- === RECETAS ===
    CREATE TABLE IF NOT EXISTS recetas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      cliente_id INTEGER,
      medico_nombre TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_lotes_producto ON lotes(producto_id);
    CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_venta);
    CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON ordenes_compra(proveedor_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_lote ON movimientos_stock(lote_id);
    CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras ON productos(codigo_barras);
    CREATE INDEX IF NOT EXISTS idx_productos_laboratorio ON productos(laboratorio_id);
  `;

    db.exec(schema);
    console.log('Database tables created/checked successfully');

    // MIGRACIONES: Asegurar que columnas nuevas existan en tablas viejas
    ensureColumns();

    // Insertar datos iniciales
    seedInitialData();
}

/**
 * Asegura que las columnas críticas existan (Migraciones básicas)
 */
function ensureColumns() {
    const migrations = [
        { table: 'proveedores', column: 'estado', type: "TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo'))" },
        { table: 'productos', column: 'laboratorio_id', type: 'INTEGER' },
        { table: 'productos', column: 'precio_venta', type: 'REAL DEFAULT 0' },
        { table: 'productos', column: 'stock_minimo', type: 'INTEGER DEFAULT 0' },
        { table: 'productos', column: 'codigo_interno', type: 'TEXT UNIQUE' },
        { table: 'usuarios', column: 'estado', type: "TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo'))" },
        { table: 'ordenes_compra', column: 'moneda', type: "TEXT DEFAULT 'USD'" }
    ];

    migrations.forEach(m => {
        try {
            const columns = db.prepare(`PRAGMA table_info(${m.table})`).all();
            const exists = columns.some(c => c.name === m.column);
            
            if (!exists) {
                console.log(`Migrating: Adding column ${m.column} to ${m.table}`);
                db.prepare(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type}`).run();
            }
        } catch (e) {
            console.error(`Error migrating ${m.table}.${m.column}:`, e.message);
        }
    });
}

/**
 * Inserta datos iniciales para pruebas
 */
function seedInitialData() {
    const count = db.prepare('SELECT COUNT(*) as count FROM categorias').get();

    if (count.count === 0) {
        console.log('Seeding initial data...');

        // Categorías
        const insertCategoria = db.prepare('INSERT INTO categorias (nombre) VALUES (?)');
        const categorias = ['Analgésicos', 'Antibióticos', 'Antiinflamatorios', 'Vitaminas', 'Dermatológicos', 'Respiratorios'];
        categorias.forEach(nombre => insertCategoria.run(nombre));

        // Laboratorios (Nuevos datos iniciales para Ecuador)
        const insertLab = db.prepare('INSERT INTO laboratorios (nombre, pais) VALUES (?, ?)');
        const labs = [
            ['GENFAR', 'Colombia'],
            ['PHARMABRAND', 'Ecuador'],
            ['GRUPO DIFARE', 'Ecuador'],
            ['BAYER', 'Alemania'],
            ['PFIZER', 'USA'],
            ['BAGÓ', 'Argentina']
        ];
        labs.forEach(([nombre, pais]) => insertLab.run(nombre, pais));

        // Usuarios
        const insertUsuario = db.prepare('INSERT INTO usuarios (nombre, rol) VALUES (?, ?)');
        insertUsuario.run('Admin Sistema', 'administrador');
        insertUsuario.run('Juan Farmacéutico', 'farmaceutico');

        console.log('Initial data seeded successfully');
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
