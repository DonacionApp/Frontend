import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { DonorProfileComponent } from './profile/donor-profile.component';
import { DonorDashboardComponent } from './dashboard/donor-dashboard.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { DonorGuard } from '../../core/guards/donor.guard';

const routes: Routes = [
  // Dashboard del donador
  { path: '', component: DonorDashboardComponent, canActivate: [AuthGuard, DonorGuard] },
  // Perfil del donador
  { path: 'profile', component: DonorProfileComponent, canActivate: [AuthGuard, DonorGuard] },
];

@NgModule({
  declarations: [
    // Los componentes standalone no se declaran aquí
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    DonorDashboardComponent,
    DonorProfileComponent
  ],
  providers: [
    // Aquí irán los servicios específicos del donante
  ]
})
export class DonorModule { }