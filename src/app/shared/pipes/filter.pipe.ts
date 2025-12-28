import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter',
  standalone: true
})
export class FilterPipe implements PipeTransform {
  transform(items: any[] | null, searchTerm: string, property?: string, value?: any): any[] {
    if (!items) return [];
    
    let filtered = items;

    // Filtro por término de búsqueda (string)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const itemString = JSON.stringify(item).toLowerCase();
        return itemString.includes(term);
      });
    }

    // Filtro por propiedad específica
    if (property && value !== undefined) {
      filtered = filtered.filter(item => item[property] === value);
    }

    return filtered;
  }
}

