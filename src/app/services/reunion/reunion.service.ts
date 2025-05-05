import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, timer } from 'rxjs';
import { catchError, throwError, map, shareReplay, switchMap, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReunionService {
  private apiUrl = '/hello/api/v1/Reunions';
  private cachedReunions$ = new BehaviorSubject<any[]>([]);
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  private lastCacheTime = 0;

  constructor(private http: HttpClient) {}

  getReunions(): Observable<any[]> {
    const now = Date.now();
    if (now - this.lastCacheTime > this.cacheTimeout) {
      // Cache expired or first load
      console.log('Fetching fresh reunions data');
      return this.http.get<any[]>(this.apiUrl).pipe(
        tap(reunions => {
          this.cachedReunions$.next(reunions);
          this.lastCacheTime = now;
        }),
        catchError(error => {
          console.error('Error fetching reunions:', error);
          return this.cachedReunions$; // Fallback to cached data
        }),
        shareReplay(1)
      );
    }
    
    // Return cached data
    console.log('Using cached reunions data');
    return this.cachedReunions$.asObservable();
  }

  // Mise à jour du cache après création/modification/suppression
  private updateCache(): void {
    this.lastCacheTime = 0; // Force refresh on next get
  }

  hi (): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/gg`);
  }

  createReunion(reunion: any): Observable<any> {
    const url = '/hello/api/v1/Reunions/create';
    console.log('Envoi de la requête à:', url);
    console.log('Données envoyées:', JSON.stringify(reunion, null, 2));
    
    return this.http.post<any>(url, reunion, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      observe: 'response'
    }).pipe(
      tap(() => this.updateCache()),
      catchError(error => {
        console.error('Erreur détaillée:', error);
        if (error.error) {
          console.error('Corps de l\'erreur:', JSON.stringify(error.error, null, 2));
        }
        return throwError(() => error);
      })
    );
  }

  addDocumentToReunion(reunionId: number, document: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', document);
    return this.http.post<any>(`${this.apiUrl}/${reunionId}/documents`, formData);
  }

  getReunionById(reunionId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${reunionId}`);
  }

  updateReunion(reunionId: number, reunion: any): Observable<any> {
    console.log(`Sending update request to: ${this.apiUrl}/${reunionId}`);
    console.log('Data being sent for update:', JSON.stringify(reunion, null, 2));
    return this.http.put<any>(`${this.apiUrl}/${reunionId}`, reunion).pipe(
      tap(() => this.updateCache())
    );
  }
  
  updateReunionParticipants(reunionId: number, userIds: number[]): Observable<any> {
    console.log(`Updating participants for reunion ${reunionId} with userIds:`, userIds);
    const url = `${this.apiUrl}/${reunionId}/participants`;
    return this.http.post<any>(url, { userIds: userIds }).pipe(
      catchError(error => {
        console.error('Error updating participants:', error);
        if (error.error) {
          console.error('Error details:', JSON.stringify(error.error, null, 2));
        }
        return throwError(() => error);
      })
    );
  }

  deleteReunion(reunionId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${reunionId}`).pipe(
      tap(() => this.updateCache())
    );
  }

  getDocumentUrl(reunionId: number): string {
    return `${this.apiUrl}/${reunionId}/documents`;
  }

  exportReunionsCsv(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export-reunions/csv`, { responseType: 'blob' });
  }

  getUsersShortInfo(): Observable<any[]> {
    const url = '/hello/api/v1/Users/short-info';
    console.log('Tentative de récupération des utilisateurs depuis:', url);
    return this.http.get<any[]>(url).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        if (error.error) {
          console.error('Corps de l\'erreur:', JSON.stringify(error.error, null, 2));
        }
        return throwError(() => error);
      })
    );
  }
  
  getReunionParticipants(reunionId: number): Observable<any[]> {
    const url = `${this.apiUrl}/${reunionId}/participants`;
    console.log(`🔍 DEBUG: Fetching participants for reunion ${reunionId}`);
    
    return this.http.get<any[]>(url).pipe(
      map(participants => {
        console.log(`Raw participants data for reunion ${reunionId}:`, participants);
        return participants;
      }),
      catchError(error => {
        console.error(`Error fetching participants for reunion ${reunionId}:`, error);
        return of([]);
      })
    );
  }

  loadResponsable(): Observable<any> {
    const url = '/hello/api/v1/Routines/loadResponsable/1';
    console.log('🔍 DEBUG: Chargement responsable - URL:', url);
    
    return this.http.get<any>(url).pipe(
      catchError(error => {
        console.error('❌ DEBUG: Erreur responsable:', {
          url: url,
          status: error.status,
          message: error.message,
          error: error.error,
          stack: error.stack
        });
        return throwError(() => error);
      })
    );
  }

  generateReunionReport(reunionId: number): Observable<Blob> {
    const url = `${this.apiUrl}/generateReport/${reunionId}`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      catchError(error => {
        console.error('Erreur lors de la génération du rapport PDF:', error);
        return throwError(() => error);
      })
    );
  }

  getReunionWithDetails(reunionId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${reunionId}`).pipe(
      switchMap(reunion => {
        const participants$ = this.getReunionParticipants(reunionId);
        return participants$.pipe(
          map(participants => ({
            ...reunion,
            participants
          }))
        );
      }),
      shareReplay(1)
    );
  }
}
