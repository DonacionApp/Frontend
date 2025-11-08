import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { OrganizationRegisterComponent } from './register/register.component';
import { OrganizationProfileComponent } from './profile/organization-profile.component';
import { OrganizationDashboardComponent } from './dashboard/organization-dashboard.component';
import { CreateDonationComponent } from './create-donation/create-donation.component';
import { DonationDetailComponent } from './donation-detail/donation-detail.component';
import { EditDonationComponent } from './edit-donation/edit-donation.component';
import { ManageDonationArticlesComponent } from './manage-donation-articles/manage-donation-articles.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { OrganizationGuard } from '../../core/guards/organization.guard';

const routes: Routes = [
  { path: 'register', component: OrganizationRegisterComponent },
  { path: '', component: OrganizationDashboardComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'profile', component: OrganizationProfileComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/create', component: CreateDonationComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/:id/edit', component: EditDonationComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/:id/manage-articles', component: ManageDonationArticlesComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/:id', component: DonationDetailComponent, canActivate: [AuthGuard, OrganizationGuard] },
];

@NgModule({
  declarations: [
    // Los componentes standalone no se declaran aquí
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    OrganizationRegisterComponent, // Importar el componente standalone
    OrganizationDashboardComponent,
    OrganizationProfileComponent,
    CreateDonationComponent,
    DonationDetailComponent,
    EditDonationComponent,
    ManageDonationArticlesComponent
  ],
  providers: [
    // Aquí irán los servicios específicos de la organización
  ]
})
export class OrganizationModule { }