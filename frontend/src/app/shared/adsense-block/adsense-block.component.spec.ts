import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdsenseBlockComponent } from './adsense-block.component';

describe('AdsenseBlockComponent', () => {
  let component: AdsenseBlockComponent;
  let fixture: ComponentFixture<AdsenseBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdsenseBlockComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdsenseBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
