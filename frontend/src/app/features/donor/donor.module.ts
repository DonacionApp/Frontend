import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { DonorRegisterComponent } from './components/donor-register/donor-register.component';

const routes: Routes = [
  { path: 'register', component: DonorRegisterComponent },
  // { path: '', component: DonorDashboardComponent },
  // { path: 'profile', component: DonorProfileComponent },
  // { path: 'donations', component: DonorDonationsComponent },
  // { path: 'donate', component: MakeDonationComponent }
];

@NgModule({
  declarations: [
    // Los componentes standalone no se declaran aquí
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    DonorRegisterComponent // Importar el componente standalone
  ],
  providers: [
    // Aquí irán los servicios específicos del donante
  ]
})
export class DonorModule { }