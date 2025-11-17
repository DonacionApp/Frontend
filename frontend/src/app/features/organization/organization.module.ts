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
import { OrganizationListComponent } from './list/list.component';
import { OrganizationReceivedDonationsComponent } from './received-donations/organization-received-donations.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { OrganizationGuard } from '../../core/guards/organization.guard';
import { GuestGuard } from '../../core/guards/guest.guard';

const routes: Routes = [
  { path: 'register', component: OrganizationRegisterComponent, canActivate: [GuestGuard] },
  { path: '', component: OrganizationDashboardComponent, canActivate: [AuthGuard, ] },
  { path: 'profile', component: OrganizationProfileComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/create', component: CreateDonationComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/received', component: OrganizationReceivedDonationsComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/:id/edit', component: EditDonationComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/:id/manage-articles', component: ManageDonationArticlesComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'donations/:id', component: DonationDetailComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'list', component: OrganizationListComponent },
];

@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    OrganizationRegisterComponent, 
    OrganizationDashboardComponent,
    OrganizationProfileComponent,
    CreateDonationComponent,
    DonationDetailComponent,
    EditDonationComponent,
    ManageDonationArticlesComponent
    ,
    OrganizationListComponent,
    OrganizationReceivedDonationsComponent
  ],
  providers: [
  ]
})
export class OrganizationModule { }