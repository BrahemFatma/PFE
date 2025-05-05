import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { KeycloakService } from './keycloak/keycloak.service';  // Update import

@Injectable()
export class HttpTokenInterceptorService implements HttpInterceptor {
  constructor(private keycloakService: KeycloakService) {}  // Use our KeycloakService

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return from(this.keycloakService.getKeycloakInstance()).pipe(
      switchMap(keycloak => {
        if (keycloak?.token) {
          const clonedRequest = req.clone({
            setHeaders: {
              Authorization: `Bearer ${keycloak.token}`
            }
          });
          return next.handle(clonedRequest);
        }
        return next.handle(req);
      }),
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return from(this.keycloakService.init()).pipe(
            switchMap(() => this.intercept(req, next))
          );
        }
        return throwError(() => error);
      })
    );
  }
}

