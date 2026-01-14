import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';
import { Usuario, EstadoRegistro } from '../models';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {
  private db = inject(DatabaseService);

  /**
   * Obtiene todos los usuarios del sistema
   */
  async obtenerTodos(): Promise<Usuario[]> {
    const sql = 'SELECT * FROM usuarios ORDER BY nombre ASC';
    const result = await this.db.query(sql);
    return this.db.toCamelCase(result) as Usuario[];
  }

  /**
   * Obtiene un usuario por ID
   */
  async obtenerPorId(id: number): Promise<Usuario | undefined> {
    const sql = 'SELECT * FROM usuarios WHERE id = ?';
    const result = await this.db.get(sql, [id]);
    return result ? this.db.toCamelCase(result) as Usuario : undefined;
  }

  /**
   * Crea un nuevo usuario
   */
  async crear(usuario: Partial<Usuario>): Promise<number> {
    const sql = `
      INSERT INTO usuarios (nombre, username, password, rol, estado)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    // Hash de la contraseña usando el API de Electron
    const hashedPassword = await this.db.hashPassword(usuario.password || '123456');

    const result = await this.db.run(sql, [
      usuario.nombre,
      usuario.username,
      hashedPassword,
      usuario.rol,
      usuario.estado || EstadoRegistro.ACTIVO
    ]);
    
    return result.lastInsertRowid;
  }

  /**
   * Actualiza un usuario existente
   */
  async actualizar(id: number, usuario: Partial<Usuario>): Promise<void> {
    let sql = 'UPDATE usuarios SET nombre = ?, username = ?, rol = ?, estado = ?';
    const params: any[] = [
      usuario.nombre,
      usuario.username,
      usuario.rol,
      usuario.estado
    ];

    // Si se proporcionó una nueva contraseña, la actualizamos
    if (usuario.password) {
      const hashedPassword = await this.db.hashPassword(usuario.password);
      sql += ', password = ?';
      params.push(hashedPassword);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    await this.db.run(sql, params);
  }

  /**
   * Elimina (o desactiva) un usuario
   */
  async desactivar(id: number): Promise<void> {
    const sql = 'UPDATE usuarios SET estado = ? WHERE id = ?';
    await this.db.run(sql, [EstadoRegistro.INACTIVO, id]);
  }
}


