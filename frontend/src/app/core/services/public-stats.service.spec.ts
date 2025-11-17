import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PublicStatsService, UserPublicStats } from './public-stats.service';
import { environment } from '../../../environments/environment';

describe('PublicStatsService', () => {
  let service: PublicStatsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PublicStatsService]
    });
    service = TestBed.inject(PublicStatsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get user public stats from dedicated endpoint', (done) => {
    const mockStats: UserPublicStats = {
      userId: 1,
      userType: 'donor',
      username: 'testuser',
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

    service.getUserPublicStats(1).subscribe(stats => {
      expect(stats).toEqual(mockStats);
      done();
    });

    const req = httpMock.expectOne(`${environment.apiBackendUrl}/user/1/public-stats`);
    expect(req.request.method).toBe('GET');
    req.flush(mockStats);
  });

  it('should build stats from multiple endpoints when dedicated endpoint fails', (done) => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      rol: 'donor',
      verified: true,
      createdAt: '2024-01-01',
      profilePhoto: 'photo.jpg'
    };

    const mockDonations = [
      { id: 1, createdAt: '2024-11-01', articles: [{}, {}], statusDonation: { status: 'completed' } }
    ];

    const mockPosts = [
      { id: 1, title: 'Test Post', createdAt: '2024-11-01', category: { id: 1, name: 'Test' } }
    ];

    service.getUserPublicStats(1).subscribe(stats => {
      expect(stats.userId).toBe(1);
      expect(stats.userType).toBe('donor');
      expect(stats.totalDonations).toBe(1);
      expect(stats.totalPosts).toBe(1);
      done();
    });

    // Primera solicitud falla (endpoint dedicado no existe)
    const req1 = httpMock.expectOne(`${environment.apiBackendUrl}/user/1/public-stats`);
    req1.flush(null, { status: 404, statusText: 'Not Found' });

    // Solicitudes de fallback
    const req2 = httpMock.expectOne(`${environment.apiBackendUrl}/user/minimal/1`);
    req2.flush(mockUser);

    const req3 = httpMock.expectOne(`${environment.apiBackendUrl}/donation/users/1`);
    req3.flush(mockDonations);

    const req4 = httpMock.expectOne(`${environment.apiBackendUrl}/post/user/1`);
    req4.flush(mockPosts);
  });

  it('should get basic stats', (done) => {
    const mockStats: UserPublicStats = {
      userId: 1,
      userType: 'donor',
      username: 'testuser',
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

    service.getBasicStats(1).subscribe(stats => {
      expect(stats.totalDonations).toBe(10);
      expect(stats.donationsThisMonth).toBe(2);
      expect(stats.totalPosts).toBe(5);
      expect(stats.verified).toBe(true);
      done();
    });

    const req = httpMock.expectOne(`${environment.apiBackendUrl}/user/1/public-stats`);
    req.flush(mockStats);
  });

  it('should return default values on error in getBasicStats', (done) => {
    service.getBasicStats(999).subscribe(stats => {
      expect(stats.totalDonations).toBe(0);
      expect(stats.donationsThisMonth).toBe(0);
      expect(stats.totalPosts).toBe(0);
      expect(stats.verified).toBe(false);
      done();
    });

    const req1 = httpMock.expectOne(`${environment.apiBackendUrl}/user/999/public-stats`);
    req1.flush(null, { status: 404, statusText: 'Not Found' });

    const req2 = httpMock.expectOne(`${environment.apiBackendUrl}/user/minimal/999`);
    req2.flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('should identify organization user type correctly', (done) => {
    const mockUser = {
      id: 2,
      username: 'testorg',
      rol: 'organization',
      verified: true,
      createdAt: '2024-01-01'
    };

    service.getUserPublicStats(2).subscribe(stats => {
      expect(stats.userType).toBe('organization');
      done();
    });

    const req1 = httpMock.expectOne(`${environment.apiBackendUrl}/user/2/public-stats`);
    req1.flush(null, { status: 404, statusText: 'Not Found' });

    const req2 = httpMock.expectOne(`${environment.apiBackendUrl}/user/minimal/2`);
    req2.flush(mockUser);

    const req3 = httpMock.expectOne(`${environment.apiBackendUrl}/donation/users/2`);
    req3.flush([]);

    const req4 = httpMock.expectOne(`${environment.apiBackendUrl}/post/user/2`);
    req4.flush([]);
  });
});
