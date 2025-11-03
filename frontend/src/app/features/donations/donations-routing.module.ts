import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PublicationsFeedComponent } from './publications-feed/publications-feed.component';
import { PublicationDetailComponent } from './publication-detail/publication-detail.component';
import { CreateDonationComponent } from './create-donation/create-donation.component';
import { EditDonationComponent } from './edit-donation/edit-donation.component';
import { DonationDetailComponent } from './donation-detail/donation-detail.component';
import { UserPublicationsComponent } from './user-publications/user-publications.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { OrganizationGuard } from '../../core/guards/organization.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'feed',
    pathMatch: 'full'
  },
  {
    path: 'feed',
    component: PublicationsFeedComponent
  },
  {
    path: 'create',
    component: CreateDonationComponent,
    canActivate: [AuthGuard, OrganizationGuard]
  },
  {
    path: 'manage/:id',
    component: DonationDetailComponent,
    canActivate: [AuthGuard, OrganizationGuard]
  },
  {
    path: 'manage/:id/edit',
    component: EditDonationComponent,
    canActivate: [AuthGuard, OrganizationGuard]
  },
  {
    path: ':id',
    component: PublicationDetailComponent
  },
  {
    path: 'user/publications',
    component: UserPublicationsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DonationsRoutingModule { }

