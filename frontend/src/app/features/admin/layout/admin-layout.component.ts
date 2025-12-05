import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService, User } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Subject, takeUntil, filter, audit } from 'rxjs';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  user: User | null = null;
  isSidebarOpen = true;
  currentRoute = '';
  unreadNotificationsCount = 0;
  showNotificationsDropdown = false;
  notifications: any[] = [];
  
  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/admin' },
    { label: 'Estadísticas', icon: 'stats', route: '/admin/stats' },
    { label: 'Panel de Indicadores', icon: 'kpi', route: '/admin/kpi-test' },
    { label: 'Usuarios', icon: 'users', route: '/admin/users' },
    { label: 'Categorías', icon: 'category', route: '/admin/categories' },
    { label: 'Roles', icon: 'role', route: '/admin/roles' },
    { label: 'Tags', icon: 'tag', route: '/admin/tags' },
    { label: 'Artículos', icon: 'article', route: '/admin/articles' },
    { label: 'Organizaciones', icon: 'organization', route: '/admin/organizations' },
    { label: 'Publicaciones', icon: 'post', route: '/admin/posts' },
    { label: 'Donaciones', icon: 'donation', route: '/admin/donations' },
    { label: 'Soporte de Identificación', icon: 'support', route: '/admin/support-identification' },
    { label: 'Sistema', icon: 'system', route: '/admin/system' },
    { label: 'Usuarios Sistema', icon: 'users', route: '/admin/user-system' },
    { label: 'Notificaciones', icon: 'notification', route: '/admin/notifications' },
    { label: 'Reportes', icon: 'report', route: '/admin/reports' },
    { label: 'Chats', icon: 'chat', route: '/admin/chats' },
    {label: "auditoria",icon:"auditoria", route:'/admin/auditoria'},
    {label: "Métricas", icon: "bar_chart", route: "/admin/metrics"}
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.user = user;
        if (user) {
          this.loadNotifications();
        }
      });

    // Detectar ruta actual
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: any) => {
        this.currentRoute = event.url;
      });
    
    this.currentRoute = this.router.url;

    // Suscribirse al contador de notificaciones no leídas
    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.unreadNotificationsCount = count;
      });

    // Suscribirse a las notificaciones
    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        this.notifications = Array.isArray(notifications) ? notifications : [];
      });
  }

  /**
   * Cargar notificaciones del admin
   */
  loadNotifications(): void {
    this.notificationService.getMyNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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

  /**
   * Toggle dropdown de notificaciones
   */
  toggleNotificationsDropdown(): void {
    this.showNotificationsDropdown = !this.showNotificationsDropdown;
  }

  /**
   * Ir al centro de notificaciones
   */
  goToNotificationsCenter(): void {
    this.router.navigate(['/notifications']);
    this.showNotificationsDropdown = false;
  }

  /**
   * Ir al perfil del admin
   * Mantiene al admin dentro del panel de administración
   */
  goToProfile(): void {
    if (this.user?.id) {
      // Navegar a la ruta de perfil dentro del admin panel
      this.router.navigate(['/admin/profile']);
    }
  }

  /**
   * Cerrar dropdown al hacer clic fuera
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-dropdown-container')) {
      this.showNotificationsDropdown = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  isActiveRoute(route: string): boolean {
    if (route === '/admin') {
      return this.currentRoute === '/admin' || this.currentRoute === '/admin/';
    }
    return this.currentRoute.startsWith(route);
  }

  getPageTitle(): string {
    const currentItem = this.menuItems.find(item => this.isActiveRoute(item.route));
    return currentItem?.label || 'Dashboard';
  }

  getUserInitial(): string {
    if (!this.user || !this.user.name) {
      return 'A';
    }
    return this.user.name.charAt(0).toUpperCase();
  }

  getIconPath(icon: string): string {
    const icons: { [key: string]: string } = {
      dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      stats: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      kpi: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
      category: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
      role: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      tag: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
      article: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      organization: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      post: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      donation: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
      support: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      system: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      notification: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
      report: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      auditoria: 'M9 2a1 1 0 00-1 1v1H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2V3a1 1 0 00-1-1H9zM9 4h6v2H9V4zm3 9l-2-2 1.414-1.414L12 9.172l1.586-1.586L15 9l-3 3z'
    };
    return icons[icon] || '';
  }
}

