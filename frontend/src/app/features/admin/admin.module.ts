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
      { 
        path: 'users', 
        loadComponent: () => import('./users/users.component').then(m => m.UsersComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'tags', 
        loadComponent: () => import('./tags/tags.component').then(m => m.TagsComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'posts', 
        loadComponent: () => import('./posts/posts.component').then(m => m.PostsComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'donations', 
        loadComponent: () => import('./donations/donations.component').then(m => m.DonationsComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'articles', 
        loadComponent: () => import('./articles/articles.component').then(m => m.ArticlesComponent),
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