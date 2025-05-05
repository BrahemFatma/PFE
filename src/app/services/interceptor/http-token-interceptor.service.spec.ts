import { TestBed } from '@angular/core/testing';
import { HttpTokenInterceptor } from './http-token-interceptor.service';
import { KeycloakService } from 'keycloak-angular';
import { of } from 'rxjs';

describe('HttpTokenInterceptor', () => {
  let service: HttpTokenInterceptor;
  let keycloakService: jasmine.SpyObj<KeycloakService>;

  beforeEach(() => {
    const keycloakSpy = jasmine.createSpyObj('KeycloakService', ['isLoggedIn', 'addTokenToHeader']);
    keycloakSpy.isLoggedIn.and.returnValue(true);
    keycloakSpy.addTokenToHeader.and.returnValue(of({}));

    TestBed.configureTestingModule({
      providers: [
        HttpTokenInterceptor,
        { provide: KeycloakService, useValue: keycloakSpy }
      ]
    });
    service = TestBed.inject(HttpTokenInterceptor);
    keycloakService = TestBed.inject(KeycloakService) as jasmine.SpyObj<KeycloakService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
