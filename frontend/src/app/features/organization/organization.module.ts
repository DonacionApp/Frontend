import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { OrganizationRegisterComponent } from './register/register.component';

const routes: Routes = [
  { path: 'register', component: OrganizationRegisterComponent },
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
    RouterModule.forChild(routes),
    OrganizationRegisterComponent // Importar el componente standalone
  ],
  providers: [
    // Aquí irán los servicios específicos de la organización
  ]
})
export class OrganizationModule { }