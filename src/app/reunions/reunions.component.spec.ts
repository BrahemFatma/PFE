import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReunionsComponent } from './reunions.component';

describe('ReunionsComponent', () => {
  let component: ReunionsComponent;
  let fixture: ComponentFixture<ReunionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ReunionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReunionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
