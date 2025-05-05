import { Component, OnInit, Renderer2 } from '@angular/core';
import { Routine, StatutRoutine } from './routine.model';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarModule } from 'angular-calendar';
import { RouterModule } from '@angular/router';
import { RoutineService } from '../services/routines/routines.service';
import Swal from 'sweetalert2';
import { KeycloakService } from 'keycloak-angular';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-routines',
  templateUrl: './routines.component.html',
  styleUrls: ['./routines.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CalendarModule,
    RouterModule
  ]
})
export class RoutinesComponent implements OnInit {
  Routines: Routine[] = [];
  users: any[] = [];
  routineResponsables: { [key: number]: any[] } = {};
  selectedRoutine: Routine | null = null;
  newRoutine: Routine = {
    nomTache: '',
    description: '',
    dateDebut: new Date(),
    dateFin: new Date(),
    statut: StatutRoutine.A_FAIRE,
    userId: null // Initialize userId as null
  };
  selectedUserIds: number[] = [];
  isModalOpen = false;
  searchTerm = '';
  isTableSearchVisible = false;
  StatutRoutine = StatutRoutine;

  // Calendar properties
  view: CalendarView = CalendarView.Month;
  viewDate: Date = new Date();
  events: CalendarEvent[] = [];
  calendarVisible = false;
  CalendarView = CalendarView;

  // Theme properties
  isDarkMode: boolean = false;

  // Statistiques
  todayRoutines = 0;
  pendingRoutines = 0;
  completedRoutines = 0;
  totalRoutines = 0;

  // Access control properties
  isManager: boolean = false;
  currentUserName: string = '';
  userRoles: string[] = [];

  // Filter properties
  isFilterModalOpen = false;
  filterParams = {
    dateDebut: '',
    dateFin: '',
    responsableId: '',
    statut: ''
  };

  constructor(
    private routineService: RoutineService,
    private renderer: Renderer2,
    private keycloakService: KeycloakService,
    private themeService: ThemeService
  ) {
    // S'abonner aux changements de thème
    this.themeService.isDarkMode$.subscribe(
      isDark => {
        this.isDarkMode = isDark;
        this.applyTheme();
      }
    );
    this.initializeUserAccess();
  }

  ngOnInit() {
    this.loadRoutines();
    this.loadUsers();
    this.addSideMenuClickListener();
    this.toggleSidebar();
    this.toggleSearchForm();
    this.handleResponsiveDesign();
  }

  private applyTheme(): void {
    const theme = this.isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }

  private async initializeUserAccess() {
    try {
      const roles = this.keycloakService.getUserRoles();
      this.userRoles = roles;
      // Seuls les managers peuvent modifier/supprimer/ajouter
      this.isManager = roles.includes('MANAGER') || roles.includes('RESPONSABLE_TECHNIQUE');
      
      const userProfile = await this.keycloakService.loadUserProfile();
      this.currentUserName = userProfile.username || '';
      
      console.log('Current Username:', this.currentUserName);
      console.log('User Profile:', userProfile);
      console.log('User Roles:', this.userRoles);
      console.log('Is Manager:', this.isManager);
    } catch (error) {
      console.error('Error initializing user access:', error);
    }
  }

  loadRoutines() {
    this.routineService.getRoutines().subscribe(
      (data) => {
        let filteredRoutines = data.map(item => {
          // Log pour déboguer la structure des données
          console.log('Routine item:', item);
          
          if (item.nom && !item.nomTache) {
            item.nomTache = item.nom;
          }
          if (item.id && item.user) {
            this.routineResponsables[item.id] = [item.user];
          } else if (item.id && item.users && Array.isArray(item.users)) {
            this.routineResponsables[item.id] = item.users;
          }
          return item;
        });

        if (this.userRoles.some(role => ['Membre_equipe', 'RESSOURCES_HUMAINES'].includes(role))) {
          console.log('Filtering routines for restricted user:', this.currentUserName);
          console.log('Before filtering:', filteredRoutines);
          
          filteredRoutines = filteredRoutines.filter(routine => {
            // Vérifier le user direct de la routine
            const directMatch = routine.userId === this.currentUserName || 
                              (routine.user && 
                               (routine.user.email === this.currentUserName || 
                                routine.user.username === this.currentUserName));

            // Vérifier dans les responsables
            const responsables = this.routineResponsables[routine.id || 0] || [];
            const responsableMatch = responsables.some(user => 
              user.email === this.currentUserName || 
              user.username === this.currentUserName || 
              user.nom === this.currentUserName
            );

            // Log pour déboguer le filtrage
            console.log(`Routine ${routine.id}:`, {
              directMatch,
              responsableMatch,
              userId: routine.userId,
              user: routine.user,
              responsables: this.routineResponsables[routine.id || 0]
            });

            return directMatch || responsableMatch;
          });
          
          console.log('After filtering:', filteredRoutines);
        }

        this.Routines = filteredRoutines;
        this.calculateStatistics();
        this.loadResponsablesForRoutines();
      },
      (error) => {
        console.error('Erreur lors du chargement des routines:', error);
      }
    );
  }

  loadUsers() {
    this.routineService.getUsersShortInfo().subscribe(
      (data) => {
        this.users = data;
      },
      (error) => {
        console.error('Erreur lors du chargement des utilisateurs:', error);
      }
    );
  }

  loadResponsablesForRoutines() {
    const routineIds = this.Routines
      .filter(routine => routine.id && !this.routineResponsables[routine.id])
      .map(routine => routine.id)
      .filter((id): id is number => id !== undefined); // Filtrer les valeurs undefined

    if (routineIds.length === 0) {
      console.log('Tous les responsables sont déjà chargés.');
      return;
    }

    this.routineService.loadResponsablesForRoutines(routineIds).subscribe(
      (data) => {
        data.forEach(({ routineId, responsables }) => {
          this.routineResponsables[routineId] = responsables.map((user: any) => ({
            nom: user.nom,
            prenom: user.prenom
          }));
          console.log(`Responsables pour la routine ${routineId}:`, this.routineResponsables[routineId]);
        });
      },
      (error) => {
        console.error('Erreur lors du chargement des responsables:', error);
      }
    );
  }

  loadTestResponsables() {
    this.users = [
      { id: 1, nom: 'Dupont', prenom: 'Jean' },
      { id: 2, nom: 'Martin', prenom: 'Sophie' },
      { id: 3, nom: 'Petit', prenom: 'Marie' },
      { id: 4, nom: 'Dubois', prenom: 'Pierre' },
      { id: 5, nom: 'Leroy', prenom: 'Thomas' }
    ];
    console.log('Utilisateurs de test chargés:', this.users);
  }
  
  

  calculateStatistics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.todayRoutines = this.Routines.filter(routine => {
      const routineDate = new Date(routine.dateDebut);
      routineDate.setHours(0, 0, 0, 0);
      return routineDate.getTime() === today.getTime();
    }).length;

    this.pendingRoutines = this.Routines.filter(routine => 
      routine.statut === StatutRoutine.A_FAIRE || routine.statut === StatutRoutine.EN_COURS
    ).length;

    this.completedRoutines = this.Routines.filter(routine => 
      routine.statut === StatutRoutine.TERMINE
    ).length;

    this.totalRoutines = this.Routines.length;
  }

  openAddRoutineModal() {
    this.selectedRoutine = null;
    this.newRoutine = {
      nomTache: '',
      description: '',
      dateDebut: new Date(),
      dateFin: new Date(),
      statut: StatutRoutine.A_FAIRE,
      userId: null // Initialize userId as null
    };
    this.selectedUserIds = [];
    console.log("Initialisation des IDs des responsables:", this.selectedUserIds);
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  selectRoutine(routine: Routine) {
    this.selectedRoutine = routine;
    this.newRoutine = { ...routine };
    if (routine.id) {
      this.routineService.getRoutineResponsables(routine.id).subscribe(
        (data) => {
          this.selectedUserIds = data.map(user => user.id);
          console.log('Responsables chargés pour la routine:', this.selectedUserIds);
        },
        (error) => {
          console.error('Erreur lors du chargement des responsables:', error);
          alert('Impossible de charger les responsables pour cette routine.');
        }
      );
    }
  }

  openEditRoutineModal() {
    if (this.selectedRoutine) {
      this.isModalOpen = true;
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Aucune routine sélectionnée',
        text: 'Veuillez sélectionner une routine à modifier.',
      });
    }
  }
  

  saveRoutine() {
    if (this.selectedRoutine) {
      this.updateRoutine(this.selectedRoutine.id!);
    } else {
      this.createRoutine();
    }
  }

  createRoutine() {
    const routineToSend = { 
      ...this.newRoutine, 
      nom: this.newRoutine.nomTache
    };
  
    const userId = this.selectedUserIds.length > 0 ? this.selectedUserIds[0] : null;
  
    if (userId === null) {
      Swal.fire({
        icon: 'warning',
        title: 'Responsable manquant',
        text: 'Veuillez sélectionner un responsable avant de créer une routine.',
      });
      return;
    }
  
    console.log('Création de routine: responsables sélectionnés:', this.selectedUserIds);
  
    this.routineService.createRoutine(routineToSend, userId).subscribe({
      next: (response) => {
        console.log('Réponse de création de routine:', response);
        Swal.fire({
          position: 'top-end',
          icon: 'success',
          title: 'Routine créée avec succès',
          showConfirmButton: false,
          timer: 1500
        });
        this.loadRoutines();
        this.closeModal();
      },
      error: (error) => {
        console.error('Erreur lors de la création de la routine:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur lors de la création',
          text: "La routine n'a pas pu être créée. Veuillez réessayer plus tard.",
        });
      }
    });
  }
  updateRoutine(routineId: number | undefined) {
    if (routineId && this.selectedRoutine) {
      const routineToUpdate = { 
        ...this.newRoutine, 
        nom: this.newRoutine.nomTache, 
        userId: this.selectedUserIds.length > 0 ? this.selectedUserIds[0] : null
      };
  
      console.log('Mise à jour de la routine avec le responsable:', routineToUpdate.userId);
  
      this.routineService.updateRoutine(routineId, routineToUpdate).subscribe({
        next: (response) => {
          console.log('Routine mise à jour avec succès:', response);
          Swal.fire({
            icon: 'success',
            title: 'Routine mise à jour avec succès',
            showConfirmButton: false,
            timer: 1500
          });
          this.loadRoutines();
          this.closeModal();
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour de la routine:', error);
          Swal.fire({
            icon: 'error',
            title: 'Erreur lors de la mise à jour',
            text: "La routine n'a pas pu être mise à jour. Veuillez réessayer plus tard.",
          });
        }
      });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Aucune routine sélectionnée',
        text: 'Veuillez sélectionner une routine à modifier.',
      });
    }
  }
  
  updateRoutineResponsables(routineId: number) {
    if (!this.selectedUserIds || this.selectedUserIds.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Aucun responsable sélectionné',
        text: 'Veuillez sélectionner au moins un responsable.',
      });
      return;
    }
  
    console.log('Mise à jour des responsables pour la routine:', routineId, 'avec les IDs:', this.selectedUserIds);
  
    this.routineService.updateRoutineResponsables(routineId, this.selectedUserIds).subscribe({
      next: (response) => {
        console.log('Responsables mis à jour avec succès:', response);
        this.loadResponsablesForRoutines();
        Swal.fire({
          icon: 'success',
          title: 'Responsables mis à jour avec succès',
          showConfirmButton: false,
          timer: 1500
        });
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour des responsables:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Une erreur est survenue lors de la mise à jour des responsables.',
        });
      }
    });
  }
  deleteRoutine(routineId: number | undefined) {
    if (routineId) {
      Swal.fire({
        title: 'Êtes-vous sûr ?',
        text: 'Vous ne pourrez pas revenir en arrière !',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Oui, supprimer',
        cancelButtonText: 'Annuler'
      }).then((result) => {
        if (result.isConfirmed) {
          this.routineService.deleteRoutine(routineId).subscribe(
            () => {
              console.log('Routine supprimée avec succès');
              this.loadRoutines();
              Swal.fire({
                icon: 'success',
                title: 'Routine supprimée avec succès',
                showConfirmButton: false,
                timer: 1500
              });
            },
            (error) => {
              console.error('Erreur lors de la suppression de la routine:', error);
              Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Une erreur est survenue lors de la suppression de la routine.',
              });
            }
          );
        }
      });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Aucune routine sélectionnée',
        text: 'Veuillez sélectionner une routine à supprimer.',
      });
    }
  }
  

  exportRoutinesCsv() {
    console.log("Export CSV clic détecté");
    this.routineService.exportRoutinesCsv().subscribe(
      (response: Blob) => {
        if (response.size > 0) {
          const fileURL = window.URL.createObjectURL(response);
          const a = document.createElement('a');
          a.href = fileURL;
          a.download = 'routines.csv';
          a.click();
          window.URL.revokeObjectURL(fileURL);
          console.log("Téléchargement CSV déclenché avec succès");
        } else {
          console.error("Le fichier CSV est vide");
          alert("Une erreur est survenue: le fichier CSV est vide");
        }
      },
      (error) => {
        console.error('Erreur lors de l\'exportation des routines en CSV', error);
        alert("Une erreur est survenue lors de l'exportation des routines en CSV");
      }
    );
  }
  searchRoutines() {
    if (this.searchTerm.trim() === '') {
      this.loadRoutines();
    } else {
      this.Routines = this.Routines.filter(routine =>
        routine.nomTache.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  toggleTableSearch() {
    this.isTableSearchVisible = !this.isTableSearchVisible;
    if (!this.isTableSearchVisible) {
      this.searchTerm = '';
      this.loadRoutines();
    }
  }


  // Méthodes pour la gestion de l'interface utilisateur
  addSideMenuClickListener() {
    const allSideMenu = document.querySelectorAll('#sidebar .side-menu.top li a');
    allSideMenu.forEach(item => {
      const li = item.parentElement;
      if (li) {
        item.addEventListener('click', function () {
          allSideMenu.forEach(i => {
            const parent = i.parentElement;
            if (parent) {
              parent.classList.remove('active');
            }
          });
          li.classList.add('active');
        });
      }
    });
  }

  toggleSidebar() {
    const menuBar = document.querySelector('#content nav .bx.bx-menu');
    const sidebar = document.getElementById('sidebar');
    menuBar?.addEventListener('click', function () {
      sidebar?.classList.toggle('hide');
    });
  }

  toggleSearchForm() {
    const searchButton = document.querySelector('#content nav form .form-input button');
    const searchButtonIcon = document.querySelector('#content nav form .form-input button .bx');
    const searchForm = document.querySelector('#content nav form');
    searchButton?.addEventListener('click', function (e) {
      if (window.innerWidth < 576) {
        e.preventDefault();
        searchForm?.classList.toggle('show');
        if (searchForm?.classList.contains('show')) {
          searchButtonIcon?.classList.replace('bx-search', 'bx-x');
        } else {
          searchButtonIcon?.classList.replace('bx-x', 'bx-search');
        }
      }
    });
  }

  handleResponsiveDesign() {
    const sidebar = document.getElementById('sidebar');
    const searchButtonIcon = document.querySelector('#content nav form .form-input button .bx');
    const searchForm = document.querySelector('#content nav form');

    if (window.innerWidth < 768) {
      sidebar?.classList.add('hide');
    } else if (window.innerWidth > 576) {
      searchButtonIcon?.classList.replace('bx-x', 'bx-search');
      searchForm?.classList.remove('show');
    }

    window.addEventListener('resize', function () {
      if (window.innerWidth > 576) {
        searchButtonIcon?.classList.replace('bx-x', 'bx-search');
        searchForm?.classList.remove('show');
      }
    });
  }

  toggleCalendar() {
    this.calendarVisible = !this.calendarVisible;
  }

  setView(view: CalendarView) {
    this.view = view;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  // Méthode pour logger les utilisateurs sélectionnés
  logSelectedUsers() {
    console.log('Utilisateurs sélectionnés (IDs):', this.selectedUserIds);
    if (this.selectedUserIds.length > 0) {
      // Vérifier le type des IDs et les convertir si nécessaire
      const typesInfo = this.selectedUserIds.map(id => `${id} (${typeof id})`);
      console.log('Types des IDs sélectionnés:', typesInfo);
    }
  }

  canModifyRoutines(): boolean {
    // Seuls les managers et responsables techniques peuvent modifier/supprimer/ajouter
    return this.isManager && 
           !this.userRoles.includes('RESSOURCES_HUMAINES') && 
           !this.userRoles.includes('Membre_equipe');
  }

  openFilterModal() {
    this.isFilterModalOpen = true;
  }

  closeFilterModal() {
    this.isFilterModalOpen = false;
  }

  applyFilters() {
    let filteredRoutines = [...this.Routines];

    if (this.filterParams.dateDebut) {
      filteredRoutines = filteredRoutines.filter(routine => 
        new Date(routine.dateDebut) >= new Date(this.filterParams.dateDebut)
      );
    }

    if (this.filterParams.dateFin) {
      filteredRoutines = filteredRoutines.filter(routine => 
        new Date(routine.dateFin) <= new Date(this.filterParams.dateFin)
      );
    }

    if (this.filterParams.responsableId) {
      filteredRoutines = filteredRoutines.filter(routine => {
        const responsables = this.routineResponsables[routine.id || 0] || [];
        return responsables.some(resp => resp.id === Number(this.filterParams.responsableId));
      });
    }

    if (this.filterParams.statut) {
      filteredRoutines = filteredRoutines.filter(routine => 
        routine.statut === this.filterParams.statut
      );
    }

    this.Routines = filteredRoutines;
    this.closeFilterModal();
  }

  resetFilters() {
    this.filterParams = {
      dateDebut: '',
      dateFin: '',
      responsableId: '',
      statut: ''
    };
    this.loadRoutines();
    this.closeFilterModal();
  }

  logout(){
    this.keycloakService.logout();
  }
}


