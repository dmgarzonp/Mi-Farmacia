const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - Expone API segura al renderer process
 */
contextBridge.exposeInMainWorld('electronAPI', {
    // Database operations
    dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
    dbRun: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
    dbGet: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
    // Window controls
    windowMinimize: () => ipcRenderer.send('window:minimize'),
    windowMaximize: () => ipcRenderer.send('window:maximize'),
    windowClose: () => ipcRenderer.send('window:close'),
    // System info
    getLocale: () => ipcRenderer.invoke('app:getLocale'),
    // Auth operations
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    hashPassword: (password) => ipcRenderer.invoke('auth:hash-password', password),
});
