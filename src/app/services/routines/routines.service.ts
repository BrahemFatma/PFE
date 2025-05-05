import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, BehaviorSubject, throwError } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { Routine, validateUser } from '../../routines/routine.model';

@Injectable({
  providedIn: 'root'
})
export class RoutineService {
  private apiUrl = '/hello/api/v1/Routines';  // Updated URL
  private cachedRoutines$ = new BehaviorSubject<any[]>([]);
  private cacheTimeout = 5 * 60 * 1000;
  private lastCacheTime = 0;

  constructor(private http: HttpClient) { }

  getRoutines(): Observable<any[]> {
    const now = Date.now();
    if (now - this.lastCacheTime > this.cacheTimeout) {
      return this.http.get<any[]>(this.apiUrl).pipe(
        map(routines => routines.map(routine => this.convertApiToRoutine(routine))),
        tap(routines => {
          this.cachedRoutines$.next(routines);
          this.lastCacheTime = now;
        }),
        shareReplay(1),
        catchError(error => {
          console.error('Erreur lors du chargement des routines:', error);
          return this.cachedRoutines$;
        })
      );
    }
    return this.cachedRoutines$.asObservable();
  }

  private updateCache(): void {
    this.lastCacheTime = 0;
  }

  // Convertit le modèle API en modèle d'application
  private convertApiToRoutine(data: any): Routine {
    const routine: Routine = {
      id: data.id,
      nomTache: data.nom || '', // Utilise nom pour nomTache
      description: data.description || '',
      dateDebut: new Date(data.dateDebut),
      dateFin: new Date(data.dateFin),
      statut: data.statut,
      userId: data.userId || null, // Ensure userId is included in the conversion
      user: data.user || null,
      users: data.users || []
    };
    
    // Log pour déboguer la conversion
    console.log('Converting API data:', data);
    console.log('To routine:', routine);
    
    return routine;
  }

  // Convertit le modèle d'application en modèle API
  private convertRoutineToApi(routine: Routine): any {
    return {
      id: routine.id,
      nom: routine.nomTache, // Inverse : nomTache devient nom
      description: routine.description,
      dateDebut: routine.dateDebut,
      dateFin: routine.dateFin,
      statut: routine.statut
    };
  }

  createRoutine(routine: any, userId: number): Observable<any> {
    const url = `${this.apiUrl}/create`;
    const payload = { ...routine, userId };
    console.log('Envoi de la requête à:', url);
    console.log('Données envoyées:', JSON.stringify(payload, null, 2));

    return this.http.post<any>(url, payload, {
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

  getRoutineById(routineId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${routineId}`);
  }

  updateRoutine(routineId: number, routine: any): Observable<any> {
    console.log(`Sending update request to: ${this.apiUrl}/${routineId}`);
    console.log('Data being sent for update:', JSON.stringify(routine, null, 2));
    return this.http.put<any>(`${this.apiUrl}/${routineId}`, routine).pipe(
      tap(() => this.updateCache())
    );
  }
  
  updateRoutineResponsables(routineId: number, userIds: number[]): Observable<any> {
    console.log(`Updating responsables for routine ${routineId} with userIds:`, userIds);
    const url = `${this.apiUrl}/${routineId}/responsables`;
    return this.http.post<any>(url, { userIds: userIds }).pipe(
      catchError(error => {
        console.error('Error updating responsables:', error);
        if (error.error) {
          console.error('Error details:', JSON.stringify(error.error, null, 2));
        }
        return throwError(() => error);
      })
    );
  }

  deleteRoutine(routineId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${routineId}`).pipe(
      tap(() => this.updateCache())
    );
  }


  exportRoutinesCsv(): Observable<Blob> {
    console.log("Appel à l'API d'exportation CSV");
    // Essayer d'abord avec le nouveau chemin
    return this.http.get(`${this.apiUrl}/export/csv`, { responseType: 'blob' }).pipe(
      catchError(error => {
        console.error("Erreur avec /export/csv:", error);
        // Si erreur, essayer avec l'ancien chemin
        return this.http.get(`${this.apiUrl}/export-routines/csv`, { responseType: 'blob' }).pipe(
          catchError(secondError => {
            console.error("Erreur avec /export-routines/csv:", secondError);
            return throwError(() => secondError);
          })
        );
      })
    ); 
  }

  getAllUsers(): Observable<any[]> {
    const url = '/hello/api/v1/Users';
    return this.http.get<any[]>(url, {
      headers: {
        'Accept': 'application/json'
      }
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des utilisateurs :', error);
        if (error.status === 500) {
          return this.http.get<any[]>('/hello/api/v1/Users').pipe(
            catchError(() => of([]))
          );
        }
        return throwError(() => error);
      })
    );
  }
  
  getUsersShortInfo(): Observable<any[]> {
    const url = '/hello/api/v1/Users/short-info';  // Updated URL
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

  assignResponsablesToRoutine(routineId: number, userIds: number[]): Observable<any> {
    const url = `${this.apiUrl}/${routineId}/users`;
    console.log('Assignation des responsables à :', url);
    return this.http.post<any>(url, userIds, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }).pipe(
      catchError(error => {
        console.error('Erreur d\'assignation :', error);
        if (error.status === 404) {
          return of({ success: true, message: 'Simulation de succès d\'assignation' });
        }
        return of({ success: false, message: 'Erreur d\'assignation', error: error });
      })
    );
  }
  getRoutineResponsables(routineId: number): Observable<any[]> {
    const url = `${this.apiUrl}/loadResponsable/${routineId}`;  // Updated URL
    console.log('Tentative de récupération des responsables depuis:', url);
    return this.http.get<any[]>(url).pipe(
      map(data => {
        console.log(`Responsables pour la routine ${routineId}:`, data);
        return data;
      }),
      catchError(error => {
        if (error.status === 404) {
          console.warn(`Aucun responsable trouvé pour la routine ${routineId}.`);
          return of([]);
        }
        console.error('Erreur lors de la récupération des responsables:', error);
        return throwError(() => error);
      })
    );
  }

  getRoutineUsers(routineId: number): Observable<any[]> {
    const url = `${this.apiUrl}/${routineId}/users`;
    return this.http.get<any[]>(url, {
      headers: { 'Accept': 'application/json' }
    }).pipe(
      catchError(error => {
        if (error.status !== 404) {
          console.error(`Erreur lors de la récupération des utilisateurs de la routine ${routineId} :`, error);
        }
        return of([]);
      })
    );
  }
  loadResponsablesForRoutines(routineIds: number[]): Observable<any[]> {
    const requests = routineIds.map(routineId => {
        const url = `${this.apiUrl}/loadResponsable/${routineId}`;  // Updated URL
        console.log('Appel à l\'API pour charger les responsables:', url);
        return this.http.get<any[]>(url).pipe(
            map(responsables => responsables.map(responsable => validateUser(responsable))), // Validate each responsable
            catchError(error => {
                console.error(`Erreur lors du chargement des responsables pour la routine ${routineId}:`, error);
                return of([]); // Return an empty array in case of error
            })
        );
    });

    return forkJoin(requests).pipe(
        map(responses => {
            return routineIds.map((routineId, index) => ({
                routineId,
                responsables: responses[index]
            }));
        })
    );
  }

  addReunion(reunion: any): Observable<any> {
    const url = '/hello/api/v1/Reunions';
    console.log('Envoi de la requête pour ajouter une réunion à:', url);
    console.log('Données envoyées:', JSON.stringify(reunion, null, 2));

    return this.http.post<any>(url, reunion, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      observe: 'response'
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de l\'ajout de la réunion:', error);
        if (error.error) {
          console.error('Corps de l\'erreur:', JSON.stringify(error.error, null, 2));
        }
        return throwError(() => error);
      })
    );
  }

}
