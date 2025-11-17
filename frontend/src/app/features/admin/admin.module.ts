import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './layout/admin-layout.component';
import { AdminDashboardComponent } from './dashboard/admin-dashboard.component';
import { AdminGuard } from '../../core/guards/admin.guard';
import { AuditoriaComponent } from './auditoria/auditoria.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';

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
      { 
        path: 'organizations', 
        loadComponent: () => import('./organizations/organizations.component').then(m => m.OrganizationsComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'support-identification',
        loadComponent: () => import('./support-identification/support-identification.component').then(m => m.SupportIdentificationComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'system', 
        loadComponent: () => import('./system/system.component').then(m => m.SystemComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'user-system', 
        loadComponent: () => import('./user-system/user-system.component').then(m => m.UserSystemComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'notifications', 
        loadComponent: () => import('./admin-notifications/admin-notifications.component').then(m => m.AdminNotificationsComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'reports', 
        loadComponent: () => import('./reports/reports.component').then(m => m.ReportsComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'chats', 
        loadComponent: () => import('./chats/chats.component').then(m => m.ChatsComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'profile', 
        loadComponent: () => import('./profile/admin-profile.component').then(m => m.AdminProfileComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'stats', 
        loadComponent: () => import('./stats/stats-dashboard.component').then(m => m.StatsDashboardComponent),
        canActivate: [AdminGuard]
      },
      { 
        path: 'kpi-test', 
        loadComponent: () => import('./kpi-test/kpi-test.component').then(m => m.KpiTestComponent),
        canActivate: [AdminGuard]
      },
      {
        path: 'auditoria',
        component:AuditoriaComponent,
        canActivate: [AdminGuard]
      }
      ,
      {
        path: 'auditoria/user/:id',
        loadComponent: () => import('./auditoria/auditoria-user.component').then(m => m.AuditoriaUserComponent),
        canActivate: [AdminGuard]
      }
    ]
  }
];

@NgModule({
  declarations: [
    AuditoriaComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    // Importar el componente standalone usado en la plantilla
    DataTableComponent
    // Los componentes standalone (AdminLayoutComponent, AdminDashboardComponent) 
    // se cargan directamente a través de las rutas, no necesitan estar en imports
  ],
  providers: []
})
export class AdminModule { }