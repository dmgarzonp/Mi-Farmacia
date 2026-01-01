import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PersistenceService {
  private storage = new Map<string, any>();

  set(key: string, value: any): void {
    this.storage.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.storage.get(key) as T;
  }

  clear(key: string): void {
    this.storage.delete(key);
  }
}









