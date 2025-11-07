import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DonationsRoutingModule } from './donations-routing.module';
// Standalone components se cargan por rutas; no es necesario importarlos aquí

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    DonationsRoutingModule
  ]
})
export class PublicationsModule { }


