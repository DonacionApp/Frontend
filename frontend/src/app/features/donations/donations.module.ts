import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DonationsRoutingModule } from './donations-routing.module';
import { CreateDonationComponent } from './create-donation/create-donation.component';
import { EditDonationComponent } from './edit-donation/edit-donation.component';
import { DonationDetailComponent } from './donation-detail/donation-detail.component';
import { PublicationsFeedComponent } from './publications-feed/publications-feed.component';
import { PublicationDetailComponent } from './publication-detail/publication-detail.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    DonationsRoutingModule,
    // Importar componentes standalone
    CreateDonationComponent,
    EditDonationComponent,
    DonationDetailComponent,
    PublicationsFeedComponent,
    PublicationDetailComponent
  ]
})
export class DonationsModule { }

