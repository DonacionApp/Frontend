import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export type FloatingMenuItem = { label: string; action: string; data?: any };

@Component({
  selector: 'app-floating-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="floating-menu" (click)="$event.stopPropagation()">
    <button type="button" class="fm-btn" (click)="toggle($event)" aria-haspopup="true" [attr.aria-expanded]="open ? 'true' : 'false'">⋮</button>
      <div *ngIf="open" class="fm-dropdown" role="menu">
        <button *ngFor="let it of items" type="button" class="fm-item" (click)="select(it)">{{ it.label }}</button>
      </div>
    </div>
  `,
  styles: [
    `:host { display: inline-block; position: relative; }
     .fm-btn { background: transparent; border: none; padding: 4px 8px; cursor: pointer; font-size: 18px; }
     .fm-dropdown { position: absolute; right: 0; top: 28px; background: white; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px; z-index: 40; min-width: 160px; }
     .fm-item { display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; background: transparent; cursor: pointer; }
     .fm-item:hover { background: #f3f4f6; }
    `
  ]
})
export class FloatingMenuComponent {
  @Input() items: FloatingMenuItem[] = [];
  @Output() selectItem = new EventEmitter<FloatingMenuItem>();

  open = false;

  toggle(ev?: Event) {
    if (ev) ev.stopPropagation();
    this.open = !this.open;
  }

  select(item: FloatingMenuItem) {
    this.selectItem.emit(item);
    this.open = false;
  }

  @HostListener('document:click')
  onOutside() {
    this.open = false;
  }
}
