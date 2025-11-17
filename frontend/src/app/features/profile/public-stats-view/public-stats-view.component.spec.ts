import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PublicStatsViewComponent } from './public-stats-view.component';
import { DonationService } from '../../../core/services/donation.service';
import { PostsService } from '../../../core/services/posts.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { OrganizationProfileService } from '../../../core/services/organization-profile.service';
import { ToastService } from '../../../core/services/toast.service';

describe('PublicStatsViewComponent', () => {
  let component: PublicStatsViewComponent;
  let fixture: ComponentFixture<PublicStatsViewComponent>;
  let mockActivatedRoute: any;
  let mockRouter: any;
  let mockDonationService: any;
  let mockPostsService: any;
  let mockUserProfileService: any;
  let mockOrganizationProfileService: any;
  let mockToastService: any;

  beforeEach(async () => {
    mockActivatedRoute = {
      paramMap: of({
        get: (key: string) => 'test-user-id'
      })
    };

    mockRouter = {
      navigate: jasmine.createSpy('navigate')
    };

    mockDonationService = {
      getDonationsByDonor: jasmine.createSpy('getDonationsByDonor').and.returnValue(of([])),
      getDonationsByOrganization: jasmine.createSpy('getDonationsByOrganization').and.returnValue(of([]))
    };

    mockPostsService = {
      getPostsByUserId: jasmine.createSpy('getPostsByUserId').and.returnValue(of([]))
    };

    mockUserProfileService = {
      getUserProfile: jasmine.createSpy('getUserProfile').and.returnValue(of({
        id: 'test-user-id',
        name: 'Test User',
        username: 'testuser',
        isVerified: true
      }))
    };

    mockOrganizationProfileService = {
      getOrganizationProfile: jasmine.createSpy('getOrganizationProfile').and.returnValue(of({
        id: 'test-org-id',
        organizationName: 'Test Organization',
        isVerified: true
      }))
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
        { provide: DonationService, useValue: mockDonationService },
        { provide: PostsService, useValue: mockPostsService },
        { provide: UserProfileService, useValue: mockUserProfileService },
        { provide: OrganizationProfileService, useValue: mockOrganizationProfileService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PublicStatsViewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load user profile on init', () => {
    fixture.detectChanges();
    expect(mockUserProfileService.getUserProfile).toHaveBeenCalledWith('test-user-id');
    expect(component.userType).toBe('donor');
  });

  it('should load organization profile if user profile fails', () => {
    mockUserProfileService.getUserProfile.and.returnValue(throwError(() => new Error('Not found')));
    fixture.detectChanges();
    expect(mockOrganizationProfileService.getOrganizationProfile).toHaveBeenCalledWith('test-user-id');
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
});
