import { Injectable, signal, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Cliente } from '../../../core/models';

@Injectable({
    providedIn: 'root'
})
export class ClientesService {
    private db = inject(DatabaseService);
    
    clientes = signal<Cliente[]>([]);

    async cargarClientes(): Promise<void> {
        try {
            const sql = `SELECT * FROM clientes ORDER BY nombre_completo ASC`;
            const result = await this.db.query<any>(sql);
            this.clientes.set(this.db.toCamelCase(result));
        } catch (e) {
            console.error(e);
        }
    }

    async crear(cliente: Partial<Cliente>): Promise<number> {
        const sql = `
            INSERT INTO clientes (documento, nombre_completo, telefono, email, fecha_nacimiento)
            VALUES (?, ?, ?, ?, ?)
        `;
        const res = await this.db.run(sql, [
            cliente.documento || null,
            cliente.nombreCompleto,
            cliente.telefono || null,
            cliente.email || null,
            cliente.fechaNacimiento || null
        ]);
        await this.cargarClientes();
        return res.lastInsertRowid;
    }

    async buscar(termino: string): Promise<Cliente[]> {
        const sql = `
            SELECT * FROM clientes 
            WHERE nombre_completo LIKE ? OR documento LIKE ?
            ORDER BY nombre_completo ASC
        `;
        const term = `%${termino}%`;
        const result = await this.db.query<any>(sql, [term, term]);
        return this.db.toCamelCase(result);
    }
}

