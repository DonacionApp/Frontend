import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PostsService, Post, PostUser } from '../../core/services/posts.service';
import { DonationService, DonationByUser } from '../../core/services/donation.service';
import { ScrollRestorationService } from '../../core/services/scroll-restoration.service';
import { ProfileHeaderComponent } from '../../shared/components/profile-header/profile-header.component';
import { ProfileTabsComponent, ProfileTab } from '../../shared/components/profile-tabs/profile-tabs.component';
import { UserPostsListComponent } from '../../shared/components/user-posts-list/user-posts-list.component';
import { UserDonationsListComponent } from '../../shared/components/user-donations-list/user-donations-list.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ProfileHeaderComponent,
    ProfileTabsComponent,
    UserPostsListComponent,
    UserDonationsListComponent,
    SidebarComponent
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  userId!: number;
  user: PostUser | null = null;
  posts: Post[] = [];
  donations: DonationByUser[] = [];
  activeTab: ProfileTab = 'posts';
  
  isLoadingUser = true;
  isLoadingPosts = true;
  isLoadingDonations = true;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postsService: PostsService,
    private donationService: DonationService,
    private scrollService: ScrollRestorationService
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.userId = +params['id'];
        if (this.userId) {
          this.route.queryParams
            .pipe(takeUntil(this.destroy$))
            .subscribe(queryParams => {
              const loaded = queryParams['loaded'];
              if (loaded === 'donations') {
                this.activeTab = 'donations';
                this.loadUserDonations();
              } else {
                this.activeTab = 'posts';
                this.loadUserPosts();
              }
            });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUserPosts(): void {
    this.isLoadingPosts = true;
    this.isLoadingUser = true;
    this.errorMessage = '';

    this.postsService.getPostsByUserId(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (posts) => {
          this.posts = posts;
          
          // Extraer información del usuario del primer post
          if (posts.length > 0 && posts[0]?.user) {
            this.user = posts[0].user;
            this.isLoadingUser = false;
            this.isLoadingPosts = false;
            // Restaurar el scroll (perfil suele demorar un poco más en renderizar)
            this.scrollService.restorePosition('profileScrollPosition', 600);
          } else {
            // Usuario sin posts - aún necesitamos mostrar algo
            this.isLoadingUser = false;
            this.isLoadingPosts = false;
            // Restaurar scroll incluso si no hay posts
            this.scrollService.restorePosition('profileScrollPosition', 600);
            // No marcar como error si simplemente no tiene posts
            if (posts.length === 0) {
              // Crear un usuario temporal con datos mínimos
              this.user = {
                id: this.userId,
                username: 'Usuario',
                profilePhoto: 'assets/default-avatar.png',
                emailVerified: false,
                verified: false,
                createdAt: new Date().toISOString()
              };
            } else {
              this.errorMessage = 'No se encontró información del usuario';
            }
          }
        },
        error: (err) => {
          console.error('Error loading user posts:', err);
          
          if (err.status === 404) {
            this.errorMessage = 'Usuario no encontrado';
          } else {
            this.errorMessage = 'Error al cargar las publicaciones del usuario';
          }
          
          this.isLoadingUser = false;
          this.isLoadingPosts = false;
          // Intentar restaurar scroll aunque haya error en la carga
          this.scrollService.restorePosition('profileScrollPosition', 600);
        }
      });
  }

  onTabChange(tab: ProfileTab): void {
    this.activeTab = tab;
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { loaded: tab === 'donations' ? 'donations' : null },
      queryParamsHandling: 'merge'
    });

    if (tab === 'donations' && this.donations.length === 0) {
      this.loadUserDonations();
    } else if (tab === 'posts' && this.posts.length === 0) {
      this.loadUserPosts();
    }
  }

  loadUserDonations(): void {
    this.isLoadingDonations = true;
    this.errorMessage = '';

    this.donationService.getDonationsByUserId(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donations) => {
          this.donations = donations;
          this.isLoadingDonations = false;
          
          if (donations.length > 0 && donations[0]?.donator && !this.user) {
            this.user = {
              id: donations[0].donator.id,
              username: donations[0].donator.username,
              profilePhoto: donations[0].donator.profilePhoto,
              emailVerified: donations[0].donator.emailVerified,
              verified: donations[0].donator.verified,
              createdAt: donations[0].donator.createdAt
            };
            this.isLoadingUser = false;
          } else if (donations.length === 0 && !this.user) {
            this.isLoadingUser = false;
          }
          
          this.scrollService.restorePosition('profileScrollPosition', 600);
        },
        error: (err) => {
          console.error('Error loading user donations:', err);
          
          if (err.status === 404) {
            this.errorMessage = 'No se encontraron donaciones';
          } else {
            this.errorMessage = 'Error al cargar las donaciones del usuario';
          }
          
          this.isLoadingDonations = false;
          this.scrollService.restorePosition('profileScrollPosition', 600);
        }
      });
  }

  handleCreatePost(): void {
    this.router.navigate(['/post/create']);
  }

  goBack(): void {
    this.router.navigate(['/post']);
  }
}
