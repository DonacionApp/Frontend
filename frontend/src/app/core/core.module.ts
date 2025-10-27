import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { CountriesService } from './services/countries.service';
import { DatabaseTestService } from './services/database-test.service';

/**
 * CoreModule contiene servicios singleton y elementos de una sola instancia
 * Se importa una sola vez en AppModule
 */
@NgModule({
  imports: [CommonModule],
  providers: [
    AuthService,
    CountriesService,
    DatabaseTestService
  ]
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule is already loaded. Import it in the AppModule only');
    }
  }
}