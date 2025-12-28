import { Component, Input, Output, EventEmitter, forwardRef, signal, computed, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { APP_ICONS } from '../../../core/constants/icons';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

interface AutocompleteItem {
  id: any;
  label: string;
  sublabel?: string;
}

@Component({
  selector: 'app-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeHtmlPipe],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteComponent),
      multi: true
    }
  ],
  template: `
    <div class="relative w-full" #container>
      <label *ngIf="label" class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
        {{ label }} <span *ngIf="required" class="text-red-500">*</span>
      </label>
      
      <div class="relative group">
        <!-- Input Field -->
        <div class="relative flex items-center">
          <span *ngIf="iconName" 
                class="absolute left-3 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors"
                [innerHTML]="icons[iconName] | safeHtml">
          </span>
          
          <input
            #inputElement
            type="text"
            [placeholder]="placeholder"
            [value]="searchQuery()"
            (input)="onSearch($any($event.target).value)"
            (focus)="onFocus()"
            [disabled]="disabled"
            [class.pl-10]="iconName"
            class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm placeholder:text-gray-400"
            [class.border-red-300]="hasError"
          />
          
          <!-- Loading or Clear Icon -->
          <div class="absolute right-3 flex items-center gap-1">
            <button 
              *ngIf="value && !disabled" 
              type="button"
              (click)="clearSelection()"
              class="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <span class="w-3.5 h-3.5 block" [innerHTML]="icons.CANCEL | safeHtml"></span>
            </button>
            <span class="w-4 h-4 text-gray-300" [innerHTML]="icons.SEARCH | safeHtml"></span>
          </div>
        </div>

        <!-- Dropdown Results -->
        <div *ngIf="isOpen() && filteredItems().length > 0" 
             class="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-premium border border-gray-100 max-h-60 overflow-y-auto overflow-x-hidden animate-slide-up"
        >
          <div class="p-1">
            <button
              *ngFor="let item of filteredItems(); let i = index"
              type="button"
              (click)="selectItem(item)"
              class="w-full text-left px-4 py-3 rounded-xl hover:bg-primary-50 transition-all group flex flex-col"
              [class.bg-primary-50]="selectedValue?.id === item.id"
            >
              <span class="text-sm font-semibold text-gray-700 group-hover:text-primary-700 transition-colors">
                {{ item.label }}
              </span>
              <span *ngIf="item.sublabel" class="text-[10px] text-gray-400 group-hover:text-primary-500 transition-colors uppercase font-medium tracking-wider">
                {{ item.sublabel }}
              </span>
            </button>
          </div>
        </div>

        <!-- No results -->
        <div *ngIf="isOpen() && searchQuery() !== '' && filteredItems().length === 0" 
             class="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-premium border border-gray-100 p-6 text-center animate-slide-up"
        >
          <div class="flex flex-col items-center gap-2">
            <span class="w-8 h-8 text-gray-200" [innerHTML]="icons.SEARCH | safeHtml"></span>
            <p class="text-xs text-gray-400 italic font-medium">No se encontraron resultados</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class AutocompleteComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() placeholder = 'Buscar...';
  @Input() required = false;
  @Input() items: AutocompleteItem[] = [];
  @Input() iconName?: keyof typeof APP_ICONS;
  @Input() hasError = false;
  
  @Output() itemSelected = new EventEmitter<AutocompleteItem>();

  @ViewChild('container') container?: ElementRef;
  @ViewChild('inputElement') inputElement?: ElementRef;

  icons = APP_ICONS;
  isOpen = signal(false);
  searchQuery = signal('');
  disabled = false;
  value: any = null;
  selectedValue: AutocompleteItem | null = null;

  filteredItems = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query && !this.isOpen()) return [];
    if (!query) return this.items.slice(0, 10);
    
    return this.items.filter(item => 
      item.label.toLowerCase().includes(query) || 
      (item.sublabel && item.sublabel.toLowerCase().includes(query))
    ).slice(0, 10);
  });

  private onChange: any = () => {};
  private onTouched: any = () => {};

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (this.container && !this.container.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
    if (!this.isOpen()) this.isOpen.set(true);
    
    // Si el query está vacío, limpiamos el valor si ya se había seleccionado algo
    if (query === '') {
      this.clearSelection();
    }
  }

  onFocus(): void {
    if (!this.disabled) {
      this.isOpen.set(true);
    }
  }

  selectItem(item: AutocompleteItem): void {
    this.selectedValue = item;
    this.value = item.id;
    this.searchQuery.set(item.label);
    this.onChange(this.value);
    this.onTouched();
    this.isOpen.set(false);
    this.itemSelected.emit(item);
  }

  clearSelection(): void {
    this.value = null;
    this.selectedValue = null;
    this.searchQuery.set('');
    this.onChange(null);
    this.itemSelected.emit(undefined);
    if (this.inputElement) {
      this.inputElement.nativeElement.focus();
    }
  }

  close(): void {
    this.isOpen.set(false);
    // Si cerramos y no hay nada seleccionado, restauramos el label o limpiamos
    if (this.selectedValue) {
      this.searchQuery.set(this.selectedValue.label);
    } else {
      this.searchQuery.set('');
    }
  }

  // ControlValueAccessor methods
  writeValue(value: any): void {
    this.value = value;
    if (value && this.items.length > 0) {
      this.selectedValue = this.items.find(i => i.id === value) || null;
      if (this.selectedValue) {
        this.searchQuery.set(this.selectedValue.label);
      }
    } else if (!value) {
      this.selectedValue = null;
      this.searchQuery.set('');
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}

