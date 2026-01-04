import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PersistenceService {
  set(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  get<T>(key: string): T | undefined {
    const data = localStorage.getItem(key);
    if (!data) return undefined;
    try {
      return JSON.parse(data) as T;
    } catch (e) {
      return undefined;
    }
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}









