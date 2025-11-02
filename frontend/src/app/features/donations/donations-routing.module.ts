import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PublicationsFeedComponent } from './publications-feed/publications-feed.component';
import { PublicationDetailComponent } from './publication-detail/publication-detail.component';

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
    path: ':id',
    component: PublicationDetailComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DonationsRoutingModule { }

