import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { OrganizationRegisterComponent } from './register/register.component';
import { OrganizationProfileComponent } from './profile/organization-profile.component';
import { CreateDonationComponent } from './create-donation/create-donation.component';
import { DonationDetailComponent } from './donation-detail/donation-detail.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { OrganizationGuard } from '../../core/guards/organization.guard';

const routes: Routes = [
  { path: 'register', component: OrganizationRegisterComponent },
  { path: 'profile', component: OrganizationProfileComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/create', component: CreateDonationComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/:id', component: DonationDetailComponent, canActivate: [AuthGuard, OrganizationGuard] },
  // { path: '', component: OrganizationDashboardComponent },
  // { path: 'campaigns', component: CampaignsComponent },
  // { path: 'donations-received', component: DonationsReceivedComponent }
];

@NgModule({
  declarations: [
    // Los componentes standalone no se declaran aquí
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    OrganizationRegisterComponent, // Importar el componente standalone
    OrganizationProfileComponent,
    CreateDonationComponent,
    DonationDetailComponent
  ],
  providers: [
    // Aquí irán los servicios específicos de la organización
  ]
})
export class OrganizationModule { }