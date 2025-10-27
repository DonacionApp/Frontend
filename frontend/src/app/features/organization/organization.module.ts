import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  // Las rutas de organización se configurarán cuando se implementen los componentes
  // { path: 'register', component: OrganizationRegisterComponent },
  // { path: '', component: OrganizationDashboardComponent },
  // { path: 'profile', component: OrganizationProfileComponent },
  // { path: 'campaigns', component: CampaignsComponent },
  // { path: 'donations-received', component: DonationsReceivedComponent }
];

@NgModule({
  declarations: [
    // Los componentes standalone no se declaran aquí
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ],
  providers: [
    // Aquí irán los servicios específicos de la organización cuando se implementen
  ]
})
export class OrganizationModule { }