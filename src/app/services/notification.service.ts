import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { KeycloakService } from './keycloak/keycloak.service';
import { Observable, from, of, throwError, interval, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, map, retry } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private apiUrl = '/hello/api/v1/Notifications';  
  private cachedNotifications: Map<string, any[]> = new Map();
  private notificationsSubject = new BehaviorSubject<any[]>([]);
  private cacheTimeout = 2000; // Réduit à 2 secondes
  private lastFetch: number = 0;
  private refreshInterval = 5000; // Réduit à 5 secondes
  private refreshSubscription: any;
  private readNotifications = new Set<number>();  // Pour suivre les notifications lues
  private newNotifications = new Set<number>();  // Pour suivre les nouvelles notifications

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService
  ) {
    this.initializeNotifications();
  }

  private async getAuthHeaders(): Promise<HttpHeaders> {
    try {
      if (await this.keycloakService.isLoggedIn()) {
        const token = await this.keycloakService.getToken();
        return new HttpHeaders()
          .set('Authorization', `Bearer ${token}`)
          .set('Content-Type', 'application/json')
          .set('Accept', 'application/json');
      }
    } catch (error) {
      console.error('Error getting auth headers:', error);
    }
    return new HttpHeaders();
  }

  private async initializeNotifications() {
    const headers = await this.getAuthHeaders();
    this.loadInitialData(headers);
    this.startAutoRefresh();
  }

  private loadInitialData(headers: HttpHeaders) {
    this.http.get<any[]>(this.apiUrl, { headers }).pipe(
      retry(1)
    ).subscribe(notifications => {
      this.notificationsSubject.next(notifications);
      this.lastFetch = Date.now();
    });
  }

  getNotifications(): Observable<any[]> {
    console.log('Fetching notifications from:', this.apiUrl);
    return this.notificationsSubject.asObservable();
  }

  getNotificationsByUser(username: string): Observable<any[]> {
    // Si pas de données en cache, forcer un rechargement
    if (!this.lastFetch || Date.now() - this.lastFetch > this.cacheTimeout) {
      this.fetchNotifications(username).subscribe();
    }

    // Retourner le flux de notifications filtré
    return this.notificationsSubject.pipe(
      map(notifications => {
        const userNotifications = notifications
          .filter(notif => notif.user && notif.user.nom === username)
          .sort((a, b) => new Date(b.dateEnvoi).getTime() - new Date(a.dateEnvoi).getTime())
          .map(notif => ({
            ...notif,
            dateEnvoi: new Date(notif.dateEnvoi)
          }))
          .slice(0, 20);

        console.log('Filtered notifications:', userNotifications.length);
        return userNotifications;
      })
    );
  }

  private fetchNotifications(username: string): Observable<any[]> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => this.http.get<any[]>(this.apiUrl, { headers })),
      map(notifications => {
        this.notificationsSubject.next(notifications);
        this.lastFetch = Date.now();
        return notifications;
      })
    );
  }

  markAsRead(notificationId: number): Observable<any> {
    if (!this.readNotifications.has(notificationId)) {
      this.readNotifications.add(notificationId);
      this.newNotifications.delete(notificationId); // Supprimer de nouvelles notifications
      // Forcer une mise à jour du BehaviorSubject
      const currentNotifications = this.notificationsSubject.value;
      this.notificationsSubject.next([...currentNotifications]);
    }
    return of({ success: true });
  }

  markAllAsRead(): void {
    const currentNotifications = this.notificationsSubject.value;
    currentNotifications.forEach(notification => {
      this.readNotifications.add(notification.id);
      this.newNotifications.delete(notification.id);
    });
    this.notificationsSubject.next([...currentNotifications]);
  }

  isRead(notificationId: number): boolean {
    return this.readNotifications.has(notificationId);
  }

  isNewNotification(notificationId: number): boolean {
    return this.newNotifications.has(notificationId) && !this.readNotifications.has(notificationId);
  }

  deleteNotification(notificationId: number): Observable<any> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => 
        this.http.delete(`${this.apiUrl}/${notificationId}`, { headers })
      ),
      retry(3),
      catchError(this.handleError)
    );
  }

  clearCache() {
    this.cachedNotifications.clear();
    this.readNotifications.clear(); // Nettoyer aussi les notifications lues
    this.lastFetch = 0;
  }

  private startAutoRefresh() {
    this.refreshSubscription = interval(this.refreshInterval).pipe(
      switchMap(() => this.getAuthHeaders()),
      switchMap(headers => this.http.get<any[]>(this.apiUrl, { headers }))
    ).subscribe({
      next: (notifications) => {
        // Identifier uniquement les nouvelles notifications
        const currentIds = new Set(this.notificationsSubject.value.map(n => n.id));
        const now = Date.now();
        notifications.forEach(notif => {
          if (!currentIds.has(notif.id) && 
              new Date(notif.dateEnvoi).getTime() > (now - this.refreshInterval)) {
            this.newNotifications.add(notif.id);
          }
        });
        this.notificationsSubject.next(notifications);
        this.lastFetch = now;
      },
      error: (error) => console.error('Refresh error:', error)
    });
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  private handleError(error: HttpErrorResponse) {
    console.error('API Error:', error);
    let errorMessage = 'An error occurred while fetching notifications';
    
    if (error.status === 0) {
      console.error('Server is not responding. Please check if backend is running.');
      return of([]);
    }
    
    return of([]); 
  }
}
