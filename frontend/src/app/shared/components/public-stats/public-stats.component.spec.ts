import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PublicStatsComponent } from './public-stats.component';

describe('PublicStatsComponent', () => {
  let component: PublicStatsComponent;
  let fixture: ComponentFixture<PublicStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicStatsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PublicStatsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize KPIs for donor type', () => {
    component.userType = 'donor';
    component.ngOnInit();
    
    expect(component.mainKPIs.length).toBe(4);
    expect(component.mainKPIs[0].title).toBe('Donaciones Realizadas');
  });

  it('should initialize KPIs for organization type', () => {
    component.userType = 'organization';
    component.ngOnInit();
    
    expect(component.mainKPIs.length).toBe(4);
    expect(component.mainKPIs[0].title).toBe('Donaciones Recibidas');
  });

  it('should process donations data correctly', () => {
    const mockDonations = [
      { id: 1, createdAt: new Date().toISOString() },
      { id: 2, createdAt: new Date().toISOString() }
    ];
    
    component.data = { donations: mockDonations };
    component.ngOnInit();
    
    expect(component.mainKPIs[0].value).toBe(2);
    expect(component.mainKPIs[0].loading).toBe(false);
  });

  it('should calculate monthly donations correctly', () => {
    const mockDonations = [
      { id: 1, createdAt: new Date().toISOString() },
      { id: 2, createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
    ];
    
    component.data = { donations: mockDonations };
    component.showCharts = true;
    component.ngOnInit();
    
    expect(component.monthlyDonationsData.length).toBe(6);
  });

  it('should calculate popular categories from posts', () => {
    const mockPosts = [
      { id: 1, typePost: { type: 'Ropa' }, createdAt: new Date().toISOString() },
      { id: 2, typePost: { type: 'Ropa' }, createdAt: new Date().toISOString() },
      { id: 3, typePost: { type: 'Alimentos' }, createdAt: new Date().toISOString() }
    ];
    
    component.data = { posts: mockPosts };
    component.showCharts = true;
    component.ngOnInit();
    
    expect(component.popularCategoriesData.length).toBeGreaterThan(0);
    expect(component.popularCategoriesData[0].category).toBe('Ropa');
    expect(component.popularCategoriesData[0].count).toBe(2);
  });

  it('should update on data changes', () => {
    component.ngOnInit();
    
    const newData = {
      donations: [{ id: 1, createdAt: new Date().toISOString() }]
    };
    
    component.data = newData;
    component.ngOnChanges({
      data: {
        currentValue: newData,
        previousValue: {},
        firstChange: false,
        isFirstChange: () => false
      }
    });
    
    expect(component.mainKPIs[0].value).toBe(1);
  });

  it('should calculate trend correctly', () => {
    const mockDonations = [
      { id: 1, createdAt: new Date().toISOString() },
      { id: 2, createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() }
    ];
    
    component.data = { donations: mockDonations };
    component.showTrends = true;
    component.ngOnInit();
    
    expect(component.mainKPIs[1].trend).toBeDefined();
  });

  it('should not show trends when showTrends is false', () => {
    component.showTrends = false;
    component.data = {
      donations: [{ id: 1, createdAt: new Date().toISOString() }]
    };
    component.ngOnInit();
    
    expect(component.mainKPIs[0].trend).toBeUndefined();
  });
});
