import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { DonorRegisterComponent } from './register/register.component';
import { DonorProfileComponent } from './profile/donor-profile.component';
import { CreateDonationComponent } from './create-donation/create-donation.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { DonorGuard } from '../../core/guards/donor.guard';

const routes: Routes = [
  { path: 'register', component: DonorRegisterComponent },
  { path: 'profile', component: DonorProfileComponent, canActivate: [AuthGuard, DonorGuard] },
  { path: 'donations/create', component: CreateDonationComponent, canActivate: [AuthGuard, DonorGuard] },
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
    DonorRegisterComponent, // Importar el componente standalone
    DonorProfileComponent,
    CreateDonationComponent
  ],
  providers: [
    // Aquí irán los servicios específicos del donante
  ]
})
export class DonorModule { }