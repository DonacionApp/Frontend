import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { DonorProfileComponent } from './profile/donor-profile.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { DonorGuard } from '../../core/guards/donor.guard';

const routes: Routes = [
  // Ruta de registro eliminada - ahora se usa /register/donor directamente
  // { path: 'register', component: DonorRegisterComponent, canActivate: [GuestGuard] },
  { path: 'profile', component: DonorProfileComponent, canActivate: [AuthGuard, DonorGuard] },
  // { path: '', component: DonorDashboardComponent },
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
    // DonorRegisterComponent eliminado - ya no se usa
    DonorProfileComponent
  ],
  providers: [
    // Aquí irán los servicios específicos del donante
  ]
})
export class DonorModule { }