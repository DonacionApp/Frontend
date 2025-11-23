import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService, User } from '../../../core/services/auth.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { OrganizationProfileService } from '../../../core/services/organization-profile.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AlertService } from '../../services/alert.service';
import { Subject, takeUntil, filter } from 'rxjs';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './nav.component.html',
  styleUrls: []
})
export class NavComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  isMobileMenuOpen = false;
  private isLoadingProfile = false;

  isAuthenticated = false;
  user: User | null = null;
  userProfileImage: string | null = null;
  userFullName: string = '';
  isOnProfilePage = false;
  isOnPostsPage = false;
  isDocumentVerified = false;
  unreadNotificationsCount = 0;

  constructor(
    private router: Router,
    private authService: AuthService,
    private profileService: UserProfileService,
    private organizationProfileService: OrganizationProfileService,
    private notificationService: NotificationService,
    private alertService: AlertService
  ) { }

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        const previousUserId = this.user?.id;
        this.user = user;
        this.isAuthenticated = !!user;
        this.userFullName = user?.name || 'Usuario';
        this.isDocumentVerified = user?.isDocumentVerified || false;

        if (user && previousUserId !== user.id && !this.isLoadingProfile) {
          this.loadUserProfile();
          this.loadNotifications();
        } else if (!user) {
          this.userProfileImage = null;
          this.userFullName = '';
          this.unreadNotificationsCount = 0;
        }
      });

    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.unreadNotificationsCount = count;
      });

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: any) => {
        this.isOnProfilePage = event.url.includes('/profile');
        this.isOnPostsPage = event.url.includes('/post');
      });

    this.isOnProfilePage = this.router.url.includes('/profile');
    this.isOnPostsPage = this.router.url.includes('/post');

    this.profileService.profile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(profile => {
        if (profile) {
          this.userProfileImage = profile.profileImage || null;
          this.userFullName = profile.name || this.user?.name || 'Usuario';
        }
      });

    this.organizationProfileService.profile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(orgProfile => {
        if (orgProfile && this.user?.role === 'organization') {
          this.isDocumentVerified = orgProfile.isVerified || false;
        }
      });
  }

  private loadUserProfile(): void {
    if (this.isLoadingProfile) {
      return;
    }

    this.isLoadingProfile = true;

    if (this.user?.role === 'donor') {
      this.profileService.getMyProfile().subscribe({
        next: (profile) => {
          this.userProfileImage = profile.profileImage || null;
          this.userFullName = profile.name || this.user?.name || 'Usuario';
          this.isDocumentVerified = profile.isVerified || false;
          this.isLoadingProfile = false;
        },
        error: (error) => {
          console.error('Error loading user profile:', error);
          this.userFullName = this.user?.name || 'Usuario';
          this.isLoadingProfile = false;
        }
      });
    } else if (this.user?.role === 'organization') {
      this.organizationProfileService.getMyOrganizationProfile().subscribe({
        next: (profile) => {
          this.userProfileImage = profile.logo || null;
          this.userFullName = profile.name || this.user?.name || 'Organización';
          this.isDocumentVerified = profile.isVerified || false;
          this.isLoadingProfile = false;
        },
        error: (error) => {
          console.error('Error loading organization profile:', error);
          this.userFullName = this.user?.name || 'Organización';
          this.isLoadingProfile = false;
        }
      });
    } else {
      this.isLoadingProfile = false;
    }
  }

  private loadNotifications(): void {
    this.notificationService.getMyNotifications().subscribe({
      next: () => {
        // Las notificaciones se actualizan automáticamente via BehaviorSubject
      },
      error: (error) => {
        if (error?.status !== 404) {
          console.error('Error loading notifications:', error);
        }
      }
    });
  }



  get displayName(): string {
    return this.userFullName || this.user?.name || 'Usuario';
  }

  get userInitial(): string {
    const name = this.displayName;
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  onHomeClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/']);
  }

  onAboutClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/about']);
  }

  onLoginClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/auth/login']);
  }

  onRegisterClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/register']);
  }

  onOrganizationRegisterClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/organization/register']);
  }

  onProfileClick(): void {
    this.closeMobileMenu();
    if (this.user?.role === 'donor') {
      this.router.navigate(['/donor/profile']);
    } else if (this.user?.role === 'organization') {
      this.router.navigate(['/organization/profile']);
    }
  }

  onLogoutClick(): void {
    this.closeMobileMenu();
    this.authService.logout();
    this.router.navigate(['/']);
  }

  onNotificationsClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/notifications']);
  }

  onPostsClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/post']);
  }

  onMyDonationsClick(): void {
    this.closeMobileMenu();
    if (this.user?.role === 'organization') {
      this.router.navigate(['/organization']);
    } else if (this.user?.role === 'donor') {
      this.router.navigate(['/organization']);
    } else {
      this.router.navigate(['/post']);
    }
  }

  onOrganizationsClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/organization/list']);
  }

  onReceivedItemsClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/organization/donations/received']);
  }

  onMessagesClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/chat']);
  }

  onStatisticsClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/dashboard/estadisticas']);
  }

  getProfileRoute(): string {
    if (this.user?.role === 'donor') {
      return '/donor/profile';
    } else if (this.user?.role === 'organization') {
      return '/organization/profile';
    }
    return '/';
  }

  onVerificationBadgeClick(): void {
    this.closeMobileMenu();
    if (this.user?.role === 'donor') {
      this.router.navigate(['/donor/profile']);
    } else if (this.user?.role === 'organization') {
      this.router.navigate(['/organization/profile']);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const mobileMenu = document.querySelector('.mobile-menu');
    const mobileMenuButton = document.querySelector('.mobile-menu-button');

    if (this.isMobileMenuOpen &&
      !mobileMenu?.contains(target) &&
      !mobileMenuButton?.contains(target)) {
      this.closeMobileMenu();
    }
  }
}
