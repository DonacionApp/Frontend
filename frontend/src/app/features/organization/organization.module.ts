import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { OrganizationRegisterComponent } from './register/register.component';
import { OrganizationProfileComponent } from './profile/organization-profile.component';
import { OrganizationDashboardComponent } from './dashboard/organization-dashboard.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { OrganizationGuard } from '../../core/guards/organization.guard';

const routes: Routes = [
  { path: 'register', component: OrganizationRegisterComponent },
  { path: '', component: OrganizationDashboardComponent, canActivate: [AuthGuard, OrganizationGuard] },
  { path: 'profile', component: OrganizationProfileComponent, canActivate: [AuthGuard, OrganizationGuard] },
  // Las rutas de donaciones ahora están en el módulo de donations
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
    OrganizationProfileComponent
  ],
  providers: [
    // Aquí irán los servicios específicos de la organización
  ]
})
export class OrganizationModule { }