import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UserManagementService } from '../../../core/services/user-management.service';
import { PostsService } from '../../../core/services/posts.service';
import { DonationService } from '../../../core/services/donation.service';

interface StatCard {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  loading?: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  stats: StatCard[] = [
    {
      title: 'Total Usuarios',
      value: 0,
      icon: 'users',
      color: 'bg-blue-500',
      change: '+12%',
      changeType: 'positive',
      loading: true
    },
    {
      title: 'Organizaciones',
      value: 0,
      icon: 'organization',
      color: 'bg-green-500',
      change: '+5%',
      changeType: 'positive',
      loading: true
    },
    {
      title: 'Publicaciones',
      value: 0,
      icon: 'post',
      color: 'bg-purple-500',
      change: '+8%',
      changeType: 'positive',
      loading: true
    },
    {
      title: 'Donaciones',
      value: 0,
      icon: 'donation',
      color: 'bg-orange-500',
      change: '+15%',
      changeType: 'positive',
      loading: true
    }
  ];

  recentActivities: any[] = [];

  constructor(
    private userService: UserManagementService,
    private postsService: PostsService,
    private donationService: DonationService
  ) {}

  ngOnInit(): void {
    this.loadDashboardStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardStats(): void {
    // Cargar usuarios y posts en paralelo
    forkJoin({
      users: this.userService.getAllUsers(),
      posts: this.postsService.getAllPosts({ limit: 1000 }) // Obtener un número grande para contar
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          // Total de usuarios (excluyendo admins)
          const totalUsers = data.users.filter(user => {
            const role = user.rol?.rol?.toLowerCase();
            return role !== 'admin';
          }).length;

          // Total de organizaciones
          const totalOrganizations = data.users.filter(user => {
            const role = user.rol?.rol?.toLowerCase();
            return role === 'organizacion' || role === 'organization';
          }).length;

          // Total de publicaciones
          const totalPosts = Array.isArray(data.posts) ? data.posts.length : 0;

          // Actualizar las estadísticas de usuarios, organizaciones y publicaciones
          this.stats[0].value = totalUsers;
          this.stats[0].loading = false;
          
          this.stats[1].value = totalOrganizations;
          this.stats[1].loading = false;
          
          this.stats[2].value = totalPosts;
          this.stats[2].loading = false;
          
          // Para donaciones, necesitamos obtenerlas de todos los usuarios
          // Por ahora, cargaremos las donaciones de forma separada
          this.loadDonationsCount();
        },
        error: (error) => {
          console.error('Error loading dashboard stats:', error);
          // En caso de error, mantener los valores en 0 pero quitar el loading
          this.stats.forEach(stat => stat.loading = false);
        }
      });
  }

  loadDonationsCount(): void {
    // Obtener todos los usuarios y luego contar las donaciones de cada uno
    this.userService.getAllUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          // Obtener donaciones de todos los usuarios, manejando errores individuales
          const donationRequests = users.map(user => 
            this.donationService.getDonationsByUserId(user.id).pipe(
              catchError(error => {
                // Si falla la petición de un usuario, devolver array vacío
                console.warn(`Error loading donations for user ${user.id}:`, error);
                return of([]);
              })
            )
          );

          if (donationRequests.length === 0) {
            this.stats[3].value = 0;
            this.stats[3].loading = false;
            return;
          }

          forkJoin(donationRequests)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (donationsArrays) => {
                // Sumar todas las donaciones de todos los usuarios
                const totalDonations = donationsArrays.reduce((total, donations) => {
                  return total + (Array.isArray(donations) ? donations.length : 0);
                }, 0);

                this.stats[3].value = totalDonations;
                this.stats[3].loading = false;
              },
              error: (error) => {
                console.error('Error loading donations count:', error);
                this.stats[3].value = 0;
                this.stats[3].loading = false;
              }
            });
        },
        error: (error) => {
          console.error('Error loading users for donations count:', error);
          this.stats[3].value = 0;
          this.stats[3].loading = false;
        }
      });
  }

  getIconPath(icon: string): string {
    const icons: { [key: string]: string } = {
      users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      organization: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      post: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      donation: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7'
    };
    return icons[icon] || '';
  }
}

