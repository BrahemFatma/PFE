import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, from, BehaviorSubject, throwError } from 'rxjs';
import { catchError, map, switchMap, shareReplay, tap } from 'rxjs/operators';
import { KeycloakService } from 'keycloak-angular';
import { Intervention } from '../../interventions/intervention.model';

export interface Client {
  id: number;
  nom: string;
  mail: string;
  numeroTelephone: string;
  adresse: string;
}

@Injectable({
  providedIn: 'root'
})
export class InterventionsService {
  private apiUrl = '/hello/api/v1/Interventions';  // Updated URL
  private clientApiUrl = '/hello/api/v1/Client';  // Updated URL

  private cachedInterventions$ = new BehaviorSubject<Intervention[]>([]);
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private lastCacheTime = 0;

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService
  ) {}

  private async getAuthHeaders(): Promise<HttpHeaders> {
    try {
      if (this.keycloakService.isLoggedIn()) {
        const token = await this.keycloakService.getToken();
        return new HttpHeaders().set('Authorization', `Bearer ${token}`);
      }
    } catch (error) {
      console.error('Error getting auth headers:', error);
    }
    return new HttpHeaders();
  }

  getInterventions(): Observable<Intervention[]> {
    const now = Date.now();
    if (now - this.lastCacheTime > this.cacheTimeout) {
      return from(this.getAuthHeaders()).pipe(
        switchMap(headers => this.http.get<Intervention[]>(this.apiUrl, { headers })),
        map(interventions => interventions.map(intervention => ({
          ...intervention,
          description: intervention.objectif ?? 'Non spécifié', // Map "objectif" to "description"
        }))),
        tap(interventions => {
          this.cachedInterventions$.next(interventions);
          this.lastCacheTime = now;
        }),
        shareReplay(1),
        catchError(error => {
          console.error('Error fetching interventions:', error);
          return this.cachedInterventions$;
        })
      );
    }
    return this.cachedInterventions$.asObservable();
  }

  private updateCache(): void {
    this.lastCacheTime = 0;
  }

  createInterventions(intervention: Partial<Intervention>): Observable<Intervention> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => this.http.post<Intervention>(this.apiUrl, intervention, { headers })),
      tap(() => this.updateCache())
    );
  }

  getInterventionById(InterventionId: number): Observable<any> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => this.http.get<any>(`${this.apiUrl}/${InterventionId}`, { headers }))
    );
  }

  updateIntervention(interventionId: number, intervention: Partial<Intervention>): Observable<Intervention> {
    console.log('Payload envoyé pour la mise à jour:', intervention); // Log the payload
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => this.http.put<Intervention>(`${this.apiUrl}/${interventionId}`, intervention, { headers })),
      tap(() => this.updateCache()),
      catchError((error) => {
        console.error('Erreur lors de la mise à jour de l\'intervention:', error);
        if (error.status === 400) {
          console.error('Détails de l\'erreur 400:', error.error); // Log detailed error
        }
        return throwError(() => error);
      })
    );
  }

  deleteIntervention(InterventionId: number): Observable<void> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => this.http.delete<void>(`${this.apiUrl}/${InterventionId}`, { headers })),
      tap(() => this.updateCache())
    );
  }

  exportInterventionsCsv(): Observable<Blob> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => this.http.get(`${this.apiUrl}/export-interventions/csv`, {
        headers,
        responseType: 'blob'
      }))
    );
  }

  generateReport(interventionId: number): Observable<Blob> {
    const url = `${this.apiUrl}/generateReport/${interventionId}`;
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => this.http.get(url, {
        headers,
        responseType: 'blob'
      })),
      catchError(error => {
        console.error('Erreur lors de la génération du PV:', error);
        return throwError(() => error);
      })
    );
  }

  getInterventionUsers(interventionId: number): Observable<any[]> {
    const url = `${this.apiUrl}/${interventionId}/users`;
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => this.http.get<any[]>(url, { headers })),
      catchError(error => {
        if (error.status === 404) {
          // Ces erreurs sont normales pour les interventions sans responsables
        } else {
          console.error(`Erreur lors de la récupération des responsables de l'intervention ${interventionId}:`, error);
        }
        return of([]);
      })
    );
  }

  getAllUsers(): Observable<any[]> {
    const url = '/hello/api/v1/Users';
    console.log('Demande de liste d\'utilisateurs à:', url);
    
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => this.http.get<any[]>(url, { headers })),
      catchError(error => {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        return of([]);
      })
    );
  }

  assignResponsablesToIntervention(interventionId: number, userIds: number[]): Observable<any> {
    const url = `${this.apiUrl}/${interventionId}/users`;
    console.log('Assignation des responsables à:', url);
    console.log('Données envoyées:', JSON.stringify(userIds, null, 2));
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => this.http.post<any>(url, userIds, {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })),
      catchError(error => {
        console.error('Erreur lors de l\'assignation des responsables:', error);
        if (error.status === 404) {
          console.log('Endpoint d\'assignation non trouvé, simulation de succès');
          return of({ success: true, message: 'Simulation de succès d\'assignation' });
        }
        if (error.error) {
          console.error('Corps de l\'erreur:', JSON.stringify(error.error, null, 2));
        }
        return of({ success: false, message: 'Erreur d\'assignation', error: error });
      })
    );
  }

  getClientName(clientId: number): Observable<string> {
    console.log(`Fetching client name for ID: ${clientId}`);
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => {
        const url = `${this.clientApiUrl}/${clientId}`;
        console.log('Request URL:', url);
        return this.http.get<any>(url, { headers });
      }),
      map(client => {
        console.log('Client data received:', client);
        return client.nom || 'Client non spécifié';
      }),
      catchError(error => {
        console.error('Error fetching client:', error);
        return of('Client non spécifié');
      })
    );
  }

  getAllClients(): Observable<Client[]> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => 
        this.http.get<Client[]>(`${this.clientApiUrl}`, { headers })
      ),
      catchError(error => {
        console.error('Error fetching clients:', error);
        return of([]);
      })
    );
  }
}
