import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PublicStatsViewComponent } from './public-stats-view.component';
import { PublicStatsService, UserPublicStats } from '../../../core/services/public-stats.service';
import { ToastService } from '../../../core/services/toast.service';

describe('PublicStatsViewComponent', () => {
  let component: PublicStatsViewComponent;
  let fixture: ComponentFixture<PublicStatsViewComponent>;
  let mockActivatedRoute: any;
  let mockRouter: any;
  let mockPublicStatsService: any;
  let mockToastService: any;

  const mockUserStats: UserPublicStats = {
    userId: 1,
    userType: 'donor',
    username: 'testuser',
    profilePhoto: 'photo.jpg',
    verified: true,
    createdAt: '2024-01-01',
    totalDonations: 10,
    donationsThisMonth: 2,
    totalPosts: 5,
    postsThisMonth: 1,
    donations: [],
    posts: [],
    monthlyActivity: [],
    categoryDistribution: []
  };

  beforeEach(async () => {
    mockActivatedRoute = {
      paramMap: of({
        get: (key: string) => 'test-user-id'
      })
    };

    mockRouter = {
      navigate: jasmine.createSpy('navigate')
    };

    mockPublicStatsService = {
      getUserPublicStats: jasmine.createSpy('getUserPublicStats').and.returnValue(of(mockUserStats))
    };

    mockToastService = {
      error: jasmine.createSpy('error'),
      success: jasmine.createSpy('success')
    };

    await TestBed.configureTestingModule({
      imports: [PublicStatsViewComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: PublicStatsService, useValue: mockPublicStatsService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PublicStatsViewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load user stats on init', () => {
    fixture.detectChanges();
    expect(mockPublicStatsService.getUserPublicStats).toHaveBeenCalledWith('test-user-id');
    expect(component.userType).toBe('donor');
    expect(component.userInfo?.name).toBe('testuser');
  });

  it('should handle organization user type', () => {
    const orgStats: UserPublicStats = { ...mockUserStats, userType: 'organization' };
    mockPublicStatsService.getUserPublicStats.and.returnValue(of(orgStats));
    
    fixture.detectChanges();
    expect(component.userType).toBe('organization');
  });

  it('should navigate to profile when goToProfile is called', () => {
    component.userId = 'test-user-id';
    component.goToProfile();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile', 'test-user-id']);
  });

  it('should handle missing user ID', () => {
    mockActivatedRoute.paramMap = of({
      get: () => null
    });
    component.ngOnInit();
    expect(component.error).toBe('ID de usuario no proporcionado');
  });

  it('should handle stats loading error', () => {
    mockPublicStatsService.getUserPublicStats.and.returnValue(
      throwError(() => new Error('Not found'))
    );
    
    fixture.detectChanges();
    expect(component.error).toBe('No se pudo cargar el perfil del usuario');
    expect(mockToastService.error).toHaveBeenCalled();
  });
});
