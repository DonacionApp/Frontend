import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './layout/admin-layout.component';
import { AdminDashboardComponent } from './dashboard/admin-dashboard.component';
import { AdminGuard } from '../../core/guards/admin.guard';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AdminGuard], // Proteger el layout y todas sus rutas hijas
    children: [
      { path: '', component: AdminDashboardComponent, canActivate: [AdminGuard] },
      { 
        path: 'categories', 
        loadComponent: () => import('./categories/categories.component').then(m => m.CategoriesComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'roles', 
        loadComponent: () => import('./roles/roles.component').then(m => m.RolesComponent),
        canActivate: [AdminGuard]
      },
    ]
  }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
    // Los componentes standalone (AdminLayoutComponent, AdminDashboardComponent) 
    // se cargan directamente a través de las rutas, no necesitan estar en imports
  ],
  providers: []
})
export class AdminModule { }