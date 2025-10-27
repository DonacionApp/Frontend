import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { HierarchicalLocationSelectorComponent } from './components/hierarchical-location-selector/hierarchical-location-selector.component';

/**
 * SharedModule contiene componentes, directivas y pipes reutilizables
 * Se importa en los módulos de features que lo necesiten
 */
@NgModule({
  imports: [
    CommonModule,
    HierarchicalLocationSelectorComponent
  ],
  exports: [
    HierarchicalLocationSelectorComponent
  ]
})
export class SharedModule { }