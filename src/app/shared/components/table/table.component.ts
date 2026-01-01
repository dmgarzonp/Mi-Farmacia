import { Component, Input, Output, EventEmitter, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { APP_ICONS } from '../../../core/constants/icons';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { ButtonComponent } from '../button/button.component';

export interface TableColumn<T = any> {
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
    render?: (row: T) => string;
}

export interface TableAction<T = any> {
    label: string;
    icon?: string;
    iconName?: keyof typeof APP_ICONS;
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
    handler: (row: T) => void;
    visible?: (row: T) => boolean;
}

/**
 * Componente de tabla genérica con paginación, búsqueda y ordenamiento
 * 
 * @example
 * <app-table
 *   [columns]="columns"
 *   [data]="productos"
 *   [actions]="actions"
 *   [searchable]="true"
 *   (rowClicked)="handleRowClick($event)"
 * ></app-table>
 */
@Component({
    selector: 'app-table',
    standalone: true,
    imports: [CommonModule, FormsModule, SafeHtmlPipe, SkeletonComponent, ButtonComponent],
    templateUrl: './table.component.html',
    styles: []
})
export class TableComponent<T = any> implements OnChanges {
    @Input() columns: TableColumn<T>[] = [];
    @Input() data: T[] = [];
    @Input() actions?: TableAction<T>[];
    @Input() searchable = false;
    @Input() paginated = true;
    @Input() pageSize = 10;
    @Input() emptyMessage = 'No hay datos para mostrar';
    @Input() emptyCtaLabel?: string;
    @Input() emptyCtaIcon?: keyof typeof APP_ICONS;
    @Input() loading = false;
    @Input() skeletonRows = 5;
    @Input() searchTerm = '';

    @Output() rowClicked = new EventEmitter<T>();
    @Output() emptyCtaClicked = new EventEmitter<void>();
    @Output() searchTermChange = new EventEmitter<string>();

    icons = APP_ICONS;
    sortKey = signal<string>('');
    sortDirection = signal<'asc' | 'desc'>('asc');
    currentPage = signal<number>(1);
    filteredData = signal<T[]>([]);
    paginatedData = signal<T[]>([]);

    Math = Math;

    ngOnInit() {
        this.filteredData.set(this.data);
        this.updatePaginatedData();
    }

    ngOnChanges(changes: SimpleChanges) {
        // Solo reiniciamos a la página 1 si el término de búsqueda cambió realmente
        if (changes['searchTerm']) {
            this.onSearch(true);
        } else if (changes['data']) {
            this.onSearch(false);
        }
    }

    onSearch(resetPage = true): void {
        this.searchTermChange.emit(this.searchTerm);
        if (!this.searchTerm) {
            this.filteredData.set(this.data);
        } else {
            const term = this.searchTerm.toLowerCase();
            const filtered = this.data.filter(row =>
                this.columns.some(col => {
                    const value = row[col.key as keyof T];
                    return value && value.toString().toLowerCase().includes(term);
                })
            );
            this.filteredData.set(filtered);
        }
        
        if (resetPage) {
            this.currentPage.set(1);
        } else {
            // Validar que la página actual siga siendo válida tras el cambio de datos
            const total = this.totalPages();
            if (this.currentPage() > total && total > 0) {
                this.currentPage.set(total);
            }
        }
        
        this.updatePaginatedData();
    }

    onSort(key: string): void {
        if (this.sortKey() === key) {
            this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
        } else {
            this.sortKey.set(key);
            this.sortDirection.set('asc');
        }

        const sorted = [...this.filteredData()].sort((a, b) => {
            const aVal = a[key as keyof T];
            const bVal = b[key as keyof T];
            const modifier = this.sortDirection() === 'asc' ? 1 : -1;

            if (aVal < bVal) return -1 * modifier;
            if (aVal > bVal) return 1 * modifier;
            return 0;
        });

        this.filteredData.set(sorted);
        this.updatePaginatedData();
    }

    updatePaginatedData(): void {
        if (!this.paginated) {
            this.paginatedData.set(this.filteredData());
            return;
        }

        const start = (this.currentPage() - 1) * this.pageSize;
        const end = start + this.pageSize;
        this.paginatedData.set(this.filteredData().slice(start, end));
    }

    totalPages(): number {
        return Math.ceil(this.filteredData().length / this.pageSize);
    }

    nextPage(): void {
        if (this.currentPage() < this.totalPages()) {
            this.currentPage.update(p => p + 1);
            this.updatePaginatedData();
        }
    }

    previousPage(): void {
        if (this.currentPage() > 1) {
            this.currentPage.update(p => p - 1);
            this.updatePaginatedData();
        }
    }

    onRowClick(row: T): void {
        this.rowClicked.emit(row);
    }

    handleAction(event: Event, action: TableAction<T>, row: T): void {
        event.stopPropagation();
        action.handler(row);
    }

    getActionIcon(action: TableAction<T>): string | undefined {
        if (action.iconName) return APP_ICONS[action.iconName];
        return action.icon;
    }

    getRowValue(row: T, key: string): any {
        return (row as any)[key];
    }

    getActionClasses(variant?: string): string {
        const base = 'px-3 py-1 rounded text-sm transition-colors';
        const variants = {
            primary: 'bg-primary-500 text-white hover:bg-primary-600',
            secondary: 'bg-secondary-500 text-white hover:bg-secondary-600',
            danger: 'bg-danger-500 text-white hover:bg-danger-600',
        };
        return `${base} ${variants[variant as keyof typeof variants] || variants.primary}`;
    }
}
