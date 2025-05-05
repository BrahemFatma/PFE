import { Component, OnInit, Renderer2 } from '@angular/core';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { startOfDay } from 'date-fns';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { InterventionsService } from '../services/interventions/interventions.service';
import Swal from 'sweetalert2';
import { KeycloakService } from 'keycloak-angular';
import { Intervention } from './intervention.model'; // Ensure this import exists
import { ThemeService } from '../services/theme.service';

export enum StatutIntervention {
  EN_ATTENTE = 'EN_ATTENTE',
  EN_COURS = 'EN_COURS',
  TERMINEE = 'TERMINEE'
}

interface Responsable {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
}

interface Utilisateur {
  nomUtilisateur: string;
  service: string;
  pointsADiscuter: string[] | string;
}

interface User {
  id: number;
  nom: string;
  prenom: string;
  email?: string;
  role?: string;
}

@Component({
    selector: 'app-interventions',
    templateUrl: './interventions.component.html',
    styleUrl: './interventions.component.css',
    standalone: false
})
export class InterventionsComponent implements OnInit {
  apiUrl = 'http://localhost:8030/api/v1/Interventions';
  Interventions: Intervention[] = [];
  totalInterventions: number = 0; // Total des réunions
  todayInterventions: number = 0; // Réunions planifiées aujourd'hui
  pendingInterventions: number = 0; // Interventions en attente
  completedInterventions: number = 0; // Interventions terminées
  view: CalendarView = CalendarView.Month;
  CalendarView = CalendarView;
  viewDate: Date = new Date();
  events: CalendarEvent[] = [
    {
      start: startOfDay(new Date()),
      title: 'Exemple d\'événement',
      color: { primary: '#3C91E6', secondary: '#CFE8FF' }
    }
  ];
  isModalOpen = false;
  isDocumentModalOpen = false;
  isDetailsModalOpen = false;
  selectedIntervention: Intervention | null = null;
  selectedDocument: File | null = null;
  newIntervention: Intervention = {
    clientId: 0,  // Changed from client to clientId
    date: new Date(),
    objectif: '',
    description: '',
    statut: StatutIntervention.EN_ATTENTE,
    // Note: La gestion des responsables se fait via l'API
  };
  searchTerm: string = '';

  currentDate: string = '';
  showCalendrier = false;
  isDarkMode = false;
  calendarVisible = false;

  StatutIntervention = StatutIntervention;
  isTableSearchVisible: boolean = false;

  // Variable pour stocker toutes les interventions (pour filtrage)
  allInterventions: Intervention[] = [];
  
  // Variable pour stocker les responsables des interventions
  interventionResponsables: { [interventionId: number]: User[] } = {};

  // Liste des utilisateurs disponibles pour l'assignation
  users: User[] = [];
  // Ids des utilisateurs sélectionnés dans le formulaire
  selectedUserIds: number[] = [];

  userRole: string = '';
  username: string = '';
  canManageInterventions: boolean = false;

  isFilterModalOpen = false;
  filterClient = '';
  filterResponsable = '';
  uniqueClients: string[] = [];
  uniqueResponsables: User[] = [];

  clients: { id: number; nom: string }[] = [];

  constructor( 
    private keycloakService: KeycloakService,
    private renderer: Renderer2,
    private interventionsService: InterventionsService,
    private themeService: ThemeService
  ) {
    this.currentDate = this.getCurrentDate();
    const savedTheme = localStorage.getItem('theme');
    this.isDarkMode = savedTheme === 'dark';
    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark');
    }
    this.themeService.isDarkMode$.subscribe(
      isDark => {
        this.isDarkMode = isDark;
        document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
      }
    );
  }

  private async initializeUserInfo(): Promise<void> {
    try {
      if (this.keycloakService.isLoggedIn()) {
        this.username = await this.keycloakService.loadUserProfile()
          .then(profile => profile.username || '');
        const roles = this.keycloakService.getUserRoles();
        console.log('Roles utilisateur:', roles);

        this.userRole = roles.find(role => 
          ['Membre_equipe', 'MANAGER', 'RESPONSABLE_TECHNIQUE', 'RESSOURCES_HUMAINES'].includes(role)
        ) || 'Membre_equipe';

        this.canManageInterventions = ['MANAGER', 'RESPONSABLE_TECHNIQUE', 'RESSOURCES_HUMAINES'].includes(this.userRole);
        console.log('Role:', this.userRole, 'Can manage:', this.canManageInterventions);
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des informations utilisateur:', error);
      this.userRole = 'Membre_equipe';
      this.canManageInterventions = false;
    }
  }

  async ngOnInit() {
    try {
      await this.initializeUserInfo();
      if (this.keycloakService.isLoggedIn()) {
        this.loadUsers();
        this.loadInterventions();
        this.loadClients();
        this.addSideMenuClickListener();
        this.toggleSidebar();
        this.toggleSearchForm();
        this.handleResponsiveDesign();
      } else {
        console.error('Utilisateur non connecté');
        this.keycloakService.login();
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error);
      this.keycloakService.login();
    }
  }

  loadClients() {
    this.interventionsService.getAllClients().subscribe({
      next: (clients) => {
        this.clients = clients;
        console.log('Clients loaded:', this.clients);
      },
      error: (error) => {
        console.error('Error loading clients:', error);
      }
    });
  }

  // Méthode pour gérer les événements sur le menu latéral
  addSideMenuClickListener() {
    const allSideMenu = document.querySelectorAll('#sidebar .side-menu.top li a');
  
    allSideMenu.forEach(item => {
      const li = item.parentElement;
      
      if (li) {  // Vérification que 'li' n'est pas null
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
  

  // TOGGLE SIDEBAR
  toggleSidebar() {
    const menuBar = document.querySelector('#content nav .bx.bx-menu');
    const sidebar = document.getElementById('sidebar');
    
    menuBar?.addEventListener('click', function () {
      sidebar?.classList.toggle('hide');
    });
  }

  // Gérer l'affichage du formulaire de recherche
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

  // Gérer la responsivité
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

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  // Méthode pour obtenir la date actuelle
  getCurrentDate() {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return today.toLocaleDateString('fr-FR', options);
  }

  toggleCalendar() {
    this.calendarVisible = !this.calendarVisible;
    const calendarElement = document.getElementById('calendarSection');
    if (calendarElement) {
      if (this.calendarVisible) {
        calendarElement.classList.add('show'); // Affiche le calendrier avec animation
      } else {
        calendarElement.classList.remove('show'); // Cache le calendrier avec animation
      }
    }
  }
  

  setView(view: CalendarView) {
    this.view = view;
  }
  
  loadInterventions() {
    this.interventionsService.getInterventions().subscribe({
      next: (data: Intervention[]) => {
        console.log('Données reçues:', data);
        
        Promise.all(
          data.map(intervention => 
            new Promise<Intervention>(resolve => {
              if (intervention.clientId) {
                this.interventionsService.getClientName(intervention.clientId).subscribe({
                  next: (clientName) => {
                    resolve({
                      ...intervention,
                      client: clientName // Set the client name
                    });
                  },
                  error: (error) => {
                    console.error(`Erreur lors du chargement du nom du client pour l'intervention ${intervention.id}:`, error);
                    resolve({
                      ...intervention,
                      client: 'Client non trouvé' // Better default value
                    });
                  }
                });
              } else {
                resolve({
                  ...intervention,
                  client: 'Client non spécifié'
                });
              }
            })
          )
        ).then(interventionsWithNames => {
          console.log('Interventions avec noms de clients:', interventionsWithNames);
          
          if (this.userRole === 'Membre_equipe') {
            this.Interventions = interventionsWithNames.filter(intervention => 
              intervention.responsable?.some(resp => 
                resp.nom.toLowerCase() === this.username.toLowerCase()
              )
            );
          } else {
            this.Interventions = interventionsWithNames;
          }

          this.Interventions = this.Interventions.map((intervention: Intervention) => ({
            ...intervention,
            description: intervention.objectif || 'Non spécifié',
          }));

          this.allInterventions = [...this.Interventions];
          this.totalInterventions = this.Interventions.length;

          // Mise à jour des compteurs
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          this.todayInterventions = this.Interventions.filter((intervention: Intervention) => {
            const interventionDate = new Date(intervention.date);
            interventionDate.setHours(0, 0, 0, 0);
            return interventionDate.getTime() === today.getTime();
          }).length;

          this.pendingInterventions = this.Interventions.filter((intervention: Intervention) =>
            intervention.statut === StatutIntervention.EN_ATTENTE
          ).length;

          this.completedInterventions = this.Interventions.filter((intervention: Intervention) =>
            intervention.statut === StatutIntervention.TERMINEE
          ).length;

          this.loadResponsables();
        });
      },
      error: (error) => {
        console.error('Erreur lors du chargement des interventions:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur de chargement',
          text: 'Impossible de charger les interventions. Veuillez réessayer plus tard.',
        });
        this.Interventions = [];
      }
    });
  }

  // Méthode pour charger les responsables des interventions
  loadResponsables() {
    // Réinitialiser le dictionnaire des responsables
    this.interventionResponsables = {};
    
    // Tenter de récupérer les responsables du localStorage
    this.loadLocalStorageResponsables();
    
    // Pour chaque intervention, récupérer ses responsables
    this.Interventions.forEach((intervention: Intervention) => {
        if (intervention?.id) {
            // Ne pas réinitialiser si on a déjà chargé des données du localStorage
            if (!this.interventionResponsables[intervention.id]) {
                // Initialisation par défaut avec un tableau vide (pour marquer explicitement "Non assigné")
                this.interventionResponsables[intervention.id] = [];
            }
            
            // Si l'intervention a un userId défini directement dans l'objet
            if (intervention.userId) {
                // Trouver l'utilisateur correspondant dans la liste des utilisateurs
                const user = this.users.find(u => u.id === intervention.userId);
                if (user) {
                    console.log(`Utilisateur trouvé pour userId ${intervention.userId}:`, user);
                    this.interventionResponsables[intervention.id] = [user];
                    // Ne pas faire l'appel API puisqu'on a déjà l'information
                    return;
                }
            }
            
            // Sinon, essayer de récupérer via l'API comme avant
            this.interventionsService.getInterventionUsers(intervention.id).subscribe({
                next: (responsables) => {
                    // On ne met à jour le tableau que si on a reçu des responsables valides
                    if (responsables && Array.isArray(responsables) && responsables.length > 0) {
                        // Vérifier que chaque élément est un objet avec les propriétés nom et prenom
                        const validResponsables = responsables.filter((user: User) => 
                            user && typeof user === 'object' && 'nom' in user && 'prenom' in user
                        );
                        
                        if (validResponsables.length > 0) {
                            this.interventionResponsables[intervention.id!] = validResponsables;
                            // Sauvegarder dans le localStorage
                            this.saveLocalStorageResponsables();
                        }
                    }
                },
                error: (error) => {
                    console.error(`Erreur lors du chargement des responsables pour l'intervention ${intervention.id}:`, error);
                    // En cas d'erreur, on garde le tableau vide initialisé au-dessus ou les données du localStorage
                }
            });
        }
    });
  }

  // Nouvelle méthode pour sauvegarder les responsables dans le localStorage
  saveLocalStorageResponsables() {
    try {
      // Transformer l'objet en string JSON
      const responsablesData = JSON.stringify(this.interventionResponsables);
      // Sauvegarder dans le localStorage
      localStorage.setItem('interventionResponsables', responsablesData);
      console.log('Responsables sauvegardés dans le localStorage');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des responsables dans le localStorage:', error);
    }
  }

  // Nouvelle méthode pour charger les responsables depuis le localStorage
  loadLocalStorageResponsables() {
    try {
      // Récupérer les données du localStorage
      const responsablesData = localStorage.getItem('interventionResponsables');
      if (responsablesData) {
        // Parser les données JSON
        const savedResponsables = JSON.parse(responsablesData);
        
        // Vérifier si les données sont valides
        if (savedResponsables && typeof savedResponsables === 'object') {
          // Fusionner avec le dictionnaire existant
          this.interventionResponsables = savedResponsables;
          console.log('Responsables chargés depuis le localStorage');
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des responsables depuis le localStorage:', error);
    }
  }

  // Méthode pour afficher le nom et prénom des responsables d'une intervention
  getResponsableDisplay(interventionId?: number): string {
    if (!interventionId) return 'Non assigné';
    
    const responsables = this.interventionResponsables[interventionId];
    if (!responsables || responsables.length === 0) return 'Non assigné';
    
    // Formatter les noms des responsables
    return responsables.map(user => `${user.prenom} ${user.nom}`).join(', ');
  }

  addIntervention() {
    if (!this.newIntervention.clientId || !this.newIntervention.description || !this.newIntervention.date || !this.newIntervention.statut) {
      Swal.fire({
        icon: 'warning',
        title: 'Champs obligatoires manquants',
        text: 'Merci de remplir tous les champs avant de soumettre.'
      });
      return;
    }
  
    const validUserIds = this.selectedUserIds.filter(id => typeof id === 'number' && !isNaN(id));
  
    const interventionToCreate = {
      ...this.newIntervention,
      date: new Date(this.newIntervention.date).toISOString(),
      userIds: validUserIds,
      utilisateurs: this.newIntervention.utilisateurs?.map((u: Utilisateur) => {
        const points: string[] = typeof u.pointsADiscuter === 'string' 
            ? u.pointsADiscuter.split(',')
                .map((point: string): string => point.trim())
                .filter((point: string): boolean => point.length > 0)
            : Array.isArray(u.pointsADiscuter)
                ? u.pointsADiscuter
                    .map((point: string): string => point.trim())
                    .filter((point: string): boolean => point.length > 0)
                : [];

        return {
            nomUtilisateur: (u.nomUtilisateur || '').trim(),
            service: (u.service || '').trim(),
            pointsADiscuter: points
        };
      }) || []
    };
  
    this.interventionsService.createInterventions(interventionToCreate).subscribe({
      next: (response) => {
        if (response?.id) {
          const selectedUsers = validUserIds
            .map(id => this.users.find(u => u.id === id))
            .filter((u): u is User => u !== undefined);
  
          this.interventionResponsables[response.id] = selectedUsers;
          this.saveLocalStorageResponsables();
  
          Swal.fire({
            position: 'top-end',
            icon: 'success',
            title: 'Intervention créée avec succès',
            showConfirmButton: false,
            timer: 1500
          });
  
          this.resetForm();
          this.closeModal();
          this.loadInterventions();
          this.selectedUserIds = [];
        }
      },
      error: (error) => {
        console.error("Erreur lors de la création:", error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur de création',
          text: error.error?.message || "Échec de la création de l'intervention"
        });
      }
    });
  }
  

  resetForm() {
    const today = new Date();
    this.newIntervention = {
        clientId: 0,  // Changed from client to clientId
        date: today,
        objectif: '',
        description: '',
        statut: StatutIntervention.EN_ATTENTE,
        heureDebutVisite: '',
        heureFinVisite: '',
        actionsMiseEnPlace: '',
        utilisateurs: []
    };
    
    this.selectedUserIds = [];
    console.log('Formulaire réinitialisé :', {
        intervention: this.newIntervention,
        selectedUserIds: this.selectedUserIds
    });
  }

  updateIntervention(interventionId: number | undefined) {
    if (interventionId && this.selectedIntervention) {
      this.newIntervention = { ...this.selectedIntervention };
      this.isModalOpen = true;
    } else {
      Swal.fire('Aucune intervention sélectionnée', '', 'warning');
    }
  }
  

  deleteIntervention(interventionId: number | undefined) {
    if (interventionId) {
      Swal.fire({
        title: 'Êtes-vous sûr ?',
        text: 'Vous ne pourrez pas revenir en arrière !',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Oui, supprimer !',
        cancelButtonText: 'Annuler'
      }).then((result) => {
        if (result.isConfirmed) {
          this.interventionsService.deleteIntervention(interventionId).subscribe({
            next: () => {
              this.Interventions = this.Interventions.filter(intervention => intervention.id !== interventionId);
              Swal.fire('Supprimé !', 'L\'intervention a été supprimée.', 'success');
            },
            error: (error) => {
              Swal.fire('Erreur !', 'L\'intervention n\'a pas pu être supprimée.', 'error');
            }
          });
        }
      });
    }
  }

  searchInterventions() {
    if (!this.searchTerm.trim()) {
      this.Interventions = [...this.allInterventions];
      this.loadResponsables();
      return;
    }
    
    const searchTermLower = this.searchTerm.toLowerCase();
    
    this.Interventions = this.allInterventions.filter(intervention => 
      intervention.client?.toLowerCase().includes(searchTermLower) ?? false
    );
    
    this.loadResponsables();
    
    console.log(`Filtrage effectué avec le terme "${this.searchTerm}"`, this.Interventions);
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedIntervention = null;
  }

  closeDetailsModal() {
    this.isDetailsModalOpen = false;
  }

  toggleTableSearch() {
    this.isTableSearchVisible = !this.isTableSearchVisible;
    
    // Si on ferme la barre de recherche, on réinitialise la recherche
    if (!this.isTableSearchVisible) {
      this.searchTerm = '';
      this.loadInterventions(); // Recharger toutes les interventions
    }
  }

  openAddInterventionModal() {
    // Réinitialise complètement le formulaire avec des valeurs vides
    this.resetForm();
    // Enlève toute intervention sélectionnée
    this.selectedIntervention = null;
    // Ouvre le modal
    this.isModalOpen = true;
  }

  addUtilisateur() {
    if (!this.newIntervention.utilisateurs) {
        this.newIntervention.utilisateurs = [];
    }
    this.newIntervention.utilisateurs.push({
        nomUtilisateur: '',
        service: '',
        pointsADiscuter: [] // Always initialize as empty array
    });
}

  editIntervention(intervention: Intervention) {
    console.log('Modification de l\'intervention:', intervention);
    this.selectedIntervention = intervention;

    // Ensure utilisateurs is properly formatted
    const formattedUtilisateurs = (intervention.utilisateurs || []).map(u => ({
        ...u,
        pointsADiscuter: Array.isArray(u.pointsADiscuter) ? u.pointsADiscuter : 
            (typeof u.pointsADiscuter === 'string' ? 
                u.pointsADiscuter.split(',').map(p => p.trim()).filter(p => p.length > 0) : 
                [])
    }));

    this.newIntervention = {
        ...intervention,
        utilisateurs: formattedUtilisateurs,
        date: new Date(intervention.date) // Convert to Date object first
    };

    this.selectedUserIds = [];
    if (intervention.userId) {
        this.selectedUserIds.push(intervention.userId);
    } else if (intervention?.id) {
        this.interventionsService.getInterventionUsers(intervention.id).subscribe({
            next: (responsables) => {
                if (responsables && Array.isArray(responsables)) {
                    this.selectedUserIds = responsables.map(user => user.id);
                    console.log('Responsables chargés pour l\'intervention:', this.selectedUserIds);
                }
            },
            error: (error) => {
                console.error('Erreur lors du chargement des responsables:', error);
            }
        });
    }

    console.log("IDs des utilisateurs sélectionnés:", this.selectedUserIds);
    this.isModalOpen = true;
  }

  saveIntervention() {
    // Add debug logging
    console.log('Validation des champs:', {
        clientId: this.newIntervention.clientId,  // Changed from client to clientId
        description: this.newIntervention.description,
        objectif: this.newIntervention.objectif,
        date: this.newIntervention.date,
        statut: this.newIntervention.statut
    });

    // Update validation check to use either description or objectif
    if (!this.newIntervention.clientId || 
        !(this.newIntervention.description || this.newIntervention.objectif) || 
        !this.newIntervention.date || 
        !this.newIntervention.statut) {
        Swal.fire({
            icon: 'warning',
            title: 'Champs obligatoires manquants',
            text: 'Veuillez remplir les champs suivants : Client, Objectif, Date et Statut'
        });
        return;
    }

    const formattedDate = new Date(this.newIntervention.date);
    const validUserIds = this.selectedUserIds.filter(id => typeof id === 'number' && !isNaN(id));

    // Format the selected users
    const selectedUsers = validUserIds
        .map(id => this.users.find(u => u.id === id))
        .filter((u): u is User => u !== undefined);

    const formattedUtilisateurs = (this.newIntervention.utilisateurs || []).map((u: Utilisateur) => {
        const points: string[] = typeof u.pointsADiscuter === 'string' 
            ? u.pointsADiscuter.split(',')
                .map((point: string): string => point.trim())
                .filter((point: string): boolean => point.length > 0)
            : Array.isArray(u.pointsADiscuter)
                ? u.pointsADiscuter
                    .map((point: string): string => point.trim())
                    .filter((point: string): boolean => point.length > 0)
                : [];

        return {
            nomUtilisateur: (u.nomUtilisateur || '').trim(),
            service: (u.service || '').trim(),
            pointsADiscuter: points
        };
    });

    const payload = {
        ...(this.newIntervention.id ? { id: this.newIntervention.id } : {}),
        clientId: Number(this.newIntervention.clientId),  // Changed from client to clientId
        objectif: (this.newIntervention.description || '').trim(),
        date: formattedDate.toISOString(),
        statut: this.newIntervention.statut,
        userId: validUserIds[0], // Primary responsible
        responsable: selectedUsers.map(user => ({  // Add all selected users as responsables
            id: user.id,
            nom: user.nom,
            prenom: user.prenom,
            role: user.role || 'Non spécifié'
        })),
        heureDebutVisite: this.newIntervention.heureDebutVisite?.trim() || undefined,
        heureFinVisite: this.newIntervention.heureFinVisite?.trim() || undefined,
        actionsMiseEnPlace: this.newIntervention.actionsMiseEnPlace?.trim() || undefined,
        utilisateurs: formattedUtilisateurs.map(u => ({
            nomUtilisateur: u.nomUtilisateur.trim(),
            service: u.service.trim(),
            pointsADiscuter: u.pointsADiscuter
                .map((point: string) => point.trim())
                .filter((point: string) => point.length > 0)
        }))
    } as Partial<Intervention>;

    console.log('Clean payload being sent:', payload);

    if (this.newIntervention.id) {
        this.interventionsService.updateIntervention(this.newIntervention.id, payload)
            .subscribe({
                next: (response: any) => {
                    try {
                        if (response && response.id) {
                            this.interventionResponsables[response.id] = selectedUsers;
                            this.saveLocalStorageResponsables();
                        }
                        Swal.fire({
                            position: 'top-end',
                            icon: 'success',
                            title: 'Intervention mise à jour avec succès',
                            showConfirmButton: false,
                            timer: 1500
                        });
                        this.closeModal();
                        this.loadInterventions();
                    } catch (error) {
                        console.error('Error processing response:', error);
                        throw error;
                    }
                },
                error: (error) => {
                    console.error('Error updating intervention:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Erreur lors de la mise à jour',
                        text: error.error?.message || "L'intervention n'a pas pu être mise à jour"
                    });
                }
            });
    } else {
        this.interventionsService.createInterventions(payload)
            .subscribe({
                next: (response: any) => {
                    try {
                        if (response && response.id) {
                            this.interventionResponsables[response.id] = selectedUsers;
                            this.saveLocalStorageResponsables();
                        }
                        Swal.fire({
                            position: 'top-end',
                            icon: 'success',
                            title: 'Intervention créée avec succès',
                            showConfirmButton: false,
                            timer: 1500
                        });
                        this.closeModal();
                        this.loadInterventions();
                    } catch (error) {
                        console.error('Error processing response:', error);
                        throw error;
                    }
                },
                error: (error) => {
                    console.error('Error creating intervention:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Erreur lors de la création',
                        text: error.error?.message || "L'intervention n'a pas pu être créée"
                    });
                }
            });
    }
  }

  selectIntervention(intervention: Intervention) {
    console.log('Intervention sélectionnée:', intervention);
    this.selectedIntervention = intervention;

    // Create a new date from the intervention date
    const date = new Date(intervention.date);
    
    this.newIntervention = {
        ...intervention,
        date: date // Use the date object directly
    };

    console.log('Date formatée pour le formulaire:', this.formatDateForInput(this.newIntervention.date));
    
    this.selectedUserIds = [];
    if (intervention.userId) {
      this.selectedUserIds.push(intervention.userId);
    } else if (intervention?.id && this.interventionResponsables[intervention.id]) {
      this.selectedUserIds = this.interventionResponsables[intervention.id].map(user => user.id);
    }

    console.log("IDs des utilisateurs sélectionnés:", this.selectedUserIds);
  }

  formatDateForInput(date: string | Date): string {
    if (!date) return '';

    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) {
            return '';
        }
        return d.toISOString().split('T')[0];
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
  }

  handleDateChange(dateString: string) {
    if (dateString) {
        this.newIntervention.date = new Date(dateString);
    }
  }

  exportInterventionsCsv() {
    console.log("Export CSV clic détecté");
    this.interventionsService.exportInterventionsCsv().subscribe(
      (response: Blob) => {
        const fileURL = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = fileURL;
        a.download = 'interventions.csv';
        a.click();
        window.URL.revokeObjectURL(fileURL);
      },
      (error) => {
        console.error('Erreur lors de l\'exportation des réunions en CSV', error);
      }
    );
  }

  generatePv(interventionId: number | undefined) {
    if (!interventionId) {
      Swal.fire({
        icon: 'warning',
        title: 'Aucune intervention sélectionnée',
        text: 'Veuillez sélectionner une intervention pour générer un PV.'
      });
      return;
    }

    this.interventionsService.generateReport(interventionId).subscribe({
      next: (response: Blob) => {
        const fileURL = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = fileURL;
        a.download = `PV_Intervention_${interventionId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(fileURL);
        Swal.fire({
          icon: 'success',
          title: 'PV généré avec succès',
          text: 'Le PV a été téléchargé.'
        });
      },
      error: (error) => {
        console.error('Erreur lors de la génération du PV:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de générer le PV. Veuillez réessayer plus tard.'
        });
      }
    });
  }

  logDateValue(event: Event) {
    const input = event.target as HTMLInputElement;
    console.log('Valeur actuelle du champ date:', input.value);
  }

  loadUsers() {
    if (!this.keycloakService.isLoggedIn()) {
      console.error('Utilisateur non connecté lors du chargement des utilisateurs');
      return;
    }

    console.log('Chargement des utilisateurs...');
    this.interventionsService.getAllUsers().subscribe({
      next: (users) => {
        if (users && users.length > 0) {
          this.users = users;
          console.log('Utilisateurs chargés avec succès:', users);
        } else {
          console.warn('Aucun utilisateur retourné par l\'API');
          this.loadTestUsers();
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        this.loadTestUsers();
      }
    });
  }

  // Méthode pour charger des utilisateurs de test en cas d'échec de l'API
  loadTestUsers() {
    this.users = [
      { id: 1, nom: 'Dupont', prenom: 'Jean' },
      { id: 2, nom: 'Martin', prenom: 'Sophie' },
      { id: 3, nom: 'Petit', prenom: 'Marie' },
      { id: 4, nom: 'Dubois', prenom: 'Pierre' },
      { id: 5, nom: 'Leroy', prenom: 'Thomas' }
    ];
    console.log('Utilisateurs de test chargés:', this.users);
  }

  // Méthode d'aide pour vérifier si une intervention a des responsables assignés
  hasResponsables(intervention: Intervention): boolean {
    return intervention?.id !== undefined && 
           this.interventionResponsables[intervention.id] !== undefined && 
           this.interventionResponsables[intervention.id].length > 0;
  }

  // Helper method to get points as array
  getPointsAsArray(points: string | string[]): string[] {
    if (Array.isArray(points)) {
      return points;
    }
    return typeof points === 'string' ? [points] : [];
  }

  // Ajouter cette méthode dans la classe InterventionsComponent
  filterValidUtilisateurs(utilisateurs: Utilisateur[] | undefined): Utilisateur[] {
    if (!utilisateurs) return [];
    
    return utilisateurs.filter(utilisateur => 
      utilisateur.nomUtilisateur?.trim() && 
      utilisateur.service?.trim() && 
      (
        Array.isArray(utilisateur.pointsADiscuter) ? 
        utilisateur.pointsADiscuter.some(point => point?.trim()) :
        utilisateur.pointsADiscuter?.trim()
      )
    );
  }

  openDetailsModal(intervention: Intervention, event: MouseEvent) {
    this.selectedIntervention = intervention;
    this.isDetailsModalOpen = true;
    event.stopPropagation();
  }

  toggleFilterModal() {
    this.isFilterModalOpen = !this.isFilterModalOpen;
    if (this.isFilterModalOpen) {
      this.updateFilterOptions();
    }
  }

  closeFilterModal() {
    this.isFilterModalOpen = false;
  }

  updateFilterOptions() {
    // Get unique clients while filtering out undefined values
    this.uniqueClients = [...new Set(
      this.allInterventions
        .map(i => i.client)
        .filter((client): client is string => client !== undefined)
    )];
    
    // Get unique responsables
    const responsablesSet = new Set<string>();
    const responsablesMap = new Map<string, User>();
    
    Object.values(this.interventionResponsables).flat().forEach(resp => {
      const key = `${resp.id}-${resp.nom}-${resp.prenom}`;
      if (!responsablesSet.has(key)) {
        responsablesSet.add(key);
        responsablesMap.set(key, resp);
      }
    });
    
    this.uniqueResponsables = Array.from(responsablesMap.values());
  }

  applyFilters() {
    this.Interventions = this.allInterventions.filter(intervention => {
      const clientMatch = !this.filterClient || intervention.client === this.filterClient;
      const responsableMatch = !this.filterResponsable || 
        intervention.responsable?.some(resp => resp.id.toString() === this.filterResponsable);
      
      return clientMatch && responsableMatch;
    });
    
    this.closeFilterModal();
  }

  resetFilters() {
    this.filterClient = '';
    this.filterResponsable = '';
    this.Interventions = [...this.allInterventions];
    this.closeFilterModal();
  }

  logout(){
    this.keycloakService.logout();
  }
}



