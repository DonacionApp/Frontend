import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PostsService, Post, PostUser } from '../../core/services/posts.service';
import { UserProfileService, UserMinimal } from '../../core/services/user-profile.service';
import { LocationMapComponent } from '../../shared/components/location-map/location-map.component';
import { DonationService, DonationByUser } from '../../core/services/donation.service';
import { ScrollRestorationService } from '../../core/services/scroll-restoration.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileHeaderComponent } from '../../shared/components/profile-header/profile-header.component';
import { ProfileTabsComponent, ProfileTab } from '../../shared/components/profile-tabs/profile-tabs.component';
import { UserPostsListComponent } from '../../shared/components/user-posts-list/user-posts-list.component';
import { UserDonationsListComponent } from '../../shared/components/user-donations-list/user-donations-list.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { PublicStatsViewComponent } from './public-stats-view/public-stats-view.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ProfileHeaderComponent,
    ProfileTabsComponent,
    UserPostsListComponent,
    UserDonationsListComponent,
    SidebarComponent,
    LocationMapComponent,
    PublicStatsViewComponent
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  @ViewChild(LocationMapComponent) locationMap?: LocationMapComponent;
  private destroy$ = new Subject<void>();
  
  userId!: number;
  user: PostUser | null = null;
  minimalUser: UserMinimal | null = null;
  posts: Post[] = [];
  donations: DonationByUser[] = [];
  activeTab: ProfileTab = 'posts';
  
  isLoadingUser = true;
  isLoadingPosts = true;
  isLoadingDonations = true;
  errorMessage = '';
  public env = environment;

  get canViewStats(): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return false;
    // Admin puede ver las estadísticas de cualquiera, los usuarios normales solo las suyas
    return currentUser.role === 'admin' || Number(currentUser.id) === this.userId;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postsService: PostsService,
    private donationService: DonationService,
    private scrollService: ScrollRestorationService,
    private userProfileService: UserProfileService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.userId = +params['id'];
        if (this.userId) {
          // Cargar datos mínimos del usuario de forma inmediata (independiente de posts/donaciones)
          this.loadUserMinimal(this.userId);

          this.route.queryParams
            .pipe(takeUntil(this.destroy$))
            .subscribe(queryParams => {
              const loaded = queryParams['loaded'];
                if (loaded === 'donations') {
                  this.activeTab = 'donations';
                  this.loadUserDonations();
                } else if (loaded === 'location') {
                  this.activeTab = 'location';
                } else if (loaded === 'stats') {
                  this.activeTab = 'stats';
                } else {
                  this.activeTab = 'posts';
                  this.loadUserPosts();
                }
            });
        }
      });
  }

  private mapMinimalToPostUser(u: UserMinimal): PostUser {
    return {
      id: u.id,
      username: u.username,
      profilePhoto: u.profilePhoto,
      emailVerified: u.emailVerified,
      verified: u.verified,
      createdAt: u.createdAt
    } as PostUser;
  }

  getStaticMapUrl(loc: { lat: number; lng: number } | null | undefined): string {
    if (!loc) return '';
    const lat = loc.lat;
    const lng = loc.lng;
    const size = '600x300';
    const zoom = 14;
    const marker = `color:red%7C${lat},${lng}`;
    const key = encodeURIComponent(this.env.apiKeyGoogleMaps || '');
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=${marker}&key=${key}`;
  }

  private loadUserMinimal(userId: number): void {
    this.isLoadingUser = true;
    this.userProfileService.getUserMinimal(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (u: UserMinimal) => {
          this.minimalUser = u;
          // Solo establecer si aún no se obtuvo desde posts/donations, para evitar parpadeos
          if (!this.user) {
            this.user = this.mapMinimalToPostUser(u);
          }
          // If we're currently viewing the location tab, try to initialize the map
          if (this.activeTab === 'location') {
            if (!this.minimalUser?.location) {
              this.activeTab = 'posts';
              this.router.navigate([], { relativeTo: this.route, queryParams: { loaded: null }, queryParamsHandling: 'merge' });
            } else {
              setTimeout(() => this.locationMap?.ensureInit(), 100);
            }
          }
          this.isLoadingUser = false;
        },
        error: () => {
          // Silencioso: mantenemos la lógica actual basada en posts/donations
          this.isLoadingUser = false;
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
            // Defensa: algunos refresh/interceptor pueden hacer que la respuesta sea un objeto.
            const normalized = Array.isArray(posts)
              ? posts
              : (posts && Array.isArray((posts as any).data) ? (posts as any).data : []);

            this.posts = normalized;
          
          // Extraer información del usuario del primer post
          if (this.posts.length > 0 && this.posts[0]?.user) {
            this.user = this.posts[0].user;
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
            if (this.posts.length === 0) {
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
      queryParams: { loaded: tab === 'donations' ? 'donations' : (tab === 'location' ? 'location' : null) },
      queryParamsHandling: 'merge'
    });

    if (tab === 'donations' && this.donations.length === 0) {
      this.loadUserDonations();
    } else if (tab === 'posts' && this.posts.length === 0) {
      this.loadUserPosts();
    }

    // If switched to location tab, ensure map child initializes after view is ready
    if (tab === 'location') {
      setTimeout(() => this.locationMap?.ensureInit(), 100);
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
