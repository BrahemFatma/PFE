import { Component, OnInit, Renderer2 } from '@angular/core';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { startOfDay } from 'date-fns';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { ReunionService } from '../services/reunion/reunion.service';
import { KeycloakService } from 'keycloak-angular';
import { Router } from '@angular/router'; 
import Swal from 'sweetalert2';
import { ThemeService } from '../services/theme.service';
import { environment } from '../../environments/environment';

interface Reunion {
  id?: number;
  titre: string;
  description: string;
  date: string;
  heure: string;
  lieu: string;
  pv: string;
  status?: string;
  documents?: File;
  userIds: number[];
  participants?: any[];
}

interface ReunionCreate {
  titre: string;
  description: string;
  date: Date;
  heure: string;
  lieu: string;
  pv: string;
}

interface User {
  id: number;
  nom: string;
  prenom: string;
}

interface Responsable {
  id: number;
  nom: string;
  prenom: string;
  email: string;
}

interface ParsedParticipant {
  nom?: string;
  prenom?: string;
  fullName: string;
}

function parseParticipantString(participant: string): ParsedParticipant {
  const parts = participant.split(' ');
  if (parts.length >= 2) {
    return {
      nom: parts[0],
      prenom: parts[1],
      fullName: participant
    };
  }
  return {
    fullName: participant
  };
}

@Component({
    selector: 'app-reunions',
    templateUrl: './reunions.component.html',
    styleUrl: './reunions.component.css',
    standalone: false
})
export class ReunionsComponent implements OnInit {
  apiUrl = 'http://localhost:8010/api/v1/Reunions';
  reunions: Reunion[] = [];
  totalReunions: number = 0; 
  todayReunions: number = 0; 
  upcomingReunions: number = 0;

  isModalOpen = false;
  isDocumentModalOpen = false;
  selectedReunion: Reunion | null = null;
  selectedDocument: File | null = null;
  newReunion: Reunion = {
    titre: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    heure: '',
    lieu: '',
    pv: '',
    documents: undefined,
    userIds: []
  };
  newReunionDocument: File | null = null;

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
  
  currentDate: string = '';
  showCalendrier = false;
  isDarkMode = false;
  calendarVisible = false;

  users: User[] = [];
  selectedUserIds: number[] = [];

  searchTerm: string = '';
  filteredReunions: Reunion[] = [];

  isSearchVisible = false;
  isTableSearchVisible = false;

  private loggedInUserName: string = '';
  private userRoles: string[] = [];
  canManageReunions: boolean = false;

  isFilterModalOpen = false;
  filterTitre = '';
  filterDate = '';
  filterParticipant = '';
  uniqueTitres: string[] = [];
  uniqueDates: string[] = [];
  uniqueParticipants: User[] = [];

  constructor(
    private renderer: Renderer2,
    private reunionService: ReunionService,
    private keycloakService: KeycloakService,
    private themeService: ThemeService
  ) {
    this.themeService.isDarkMode$.subscribe(
      isDark => {
        this.isDarkMode = isDark;
        document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
      }
    );
  }

  ngOnInit() {
    this.addSideMenuClickListener();
    this.toggleSidebar();
    this.toggleSearchForm();
    this.handleResponsiveDesign();
    this.getCurrentUser();
    this.loadUsers();
    this.hi();
    this.checkUserRoles();
   
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.isDarkMode = true;
      document.body.setAttribute('data-theme', 'dark');
      document.body.style.backgroundColor = 'var(--grey)';
    } else {
      this.isDarkMode = false;
      document.body.setAttribute('data-theme', 'light');
      document.body.style.backgroundColor = 'var(--light)';
    }
  }

  checkUserRoles() {
    const keycloakInstance = this.keycloakService.getKeycloakInstance();
    this.userRoles = keycloakInstance.realmAccess?.roles || [];
    this.canManageReunions = this.userRoles.some(role => 
      ['MANAGER', 'RESSOURCES_HUMAINES'].includes(role)
    );
    console.log('User roles:', this.userRoles);
    console.log('Can manage reunions:', this.canManageReunions);
  }

  getCurrentUser() {
    try {
      const keycloakInstance = this.keycloakService.getKeycloakInstance();
      console.log('Keycloak full instance:', keycloakInstance);
      
      keycloakInstance.loadUserProfile()
        .then(profile => {
          console.log('Full Keycloak profile:', profile);
          this.loggedInUserName = profile.username || '';
          console.log('Username from profile:', this.loggedInUserName);
          
          // Load meetings directly without responsable check
          this.loadReunions();
        })
        .catch(error => {
          console.error('Error loading user profile:', error);
        });
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
    }
  }

  loadReunions() {
    console.log('=== DEBUG: Début de loadReunions() pour utilisateur:', this.loggedInUserName);
    this.reunionService.getReunions().subscribe({
      next: async (data: Reunion[]) => {
        console.log('1. Toutes les réunions reçues:', data);
        const mappedReunions = data.map(reunion => ({
          ...reunion,
          date: new Date(reunion.date).toISOString().split('T')[0]
        }));

        const processedReunions: Reunion[] = [];
        
        // Load participants for all reunions regardless of role
        for (const reunion of mappedReunions) {
          if (reunion.id) {
            try {
              const participants = await this.reunionService.getReunionParticipants(reunion.id).toPromise();
              reunion.participants = participants;
              
              if (this.canManageReunions) {
                // Pour MANAGER et RESSOURCES_HUMAINES, ajouter toutes les réunions
                processedReunions.push({
                  ...reunion,
                  participants: participants
                });
              } else {
                // Pour autres rôles, filtrer par participant
                if (participants && Array.isArray(participants)) {
                  const isParticipant = participants.some(participant => {
                    if (typeof participant === 'string') {
                      const parsed = parseParticipantString(participant);
                      return parsed.fullName.toLowerCase().includes(this.loggedInUserName.toLowerCase()) ||
                             (parsed.nom && parsed.nom.toLowerCase() === this.loggedInUserName.toLowerCase());
                    }
                    return false;
                  });

                  if (isParticipant) {
                    processedReunions.push(reunion);
                  }
                }
              }
            } catch (error) {
              console.error(`❌ Erreur lors du traitement de la réunion ${reunion.id}:`, error);
            }
          }
        }
        
        this.reunions = processedReunions;
        this.filteredReunions = [...processedReunions];
        console.log('Réunions traitées:', this.reunions);
        
        this.updateReunionCounts();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des réunions:', error);
      }
    });
  }

  updateReunionCounts() {
    this.totalReunions = this.reunions.length;
    
    const today = new Date().toISOString().split('T')[0];
    this.todayReunions = this.reunions.filter(reunion => reunion.date === today).length;
    
    this.upcomingReunions = this.reunions.filter(reunion => 
      reunion.date > today
    ).length;
  }

  loadParticipantsForReunion(reunionId: number) {
    console.log(`Tentative de chargement des participants pour la réunion ${reunionId}`);
    this.reunionService.getReunionParticipants(reunionId).subscribe({
      next: (participants) => {
        console.log(`Participants chargés pour la réunion ${reunionId}:`, participants);
        const reunion = this.reunions.find(r => r.id === reunionId);
        if (reunion) {
          reunion.participants = participants;
          
          if (Array.isArray(participants)) {
            if (participants.length > 0) {
              if (typeof participants[0] === 'object' && participants[0]?.id) {
                reunion.userIds = participants.map(p => p.id);
                console.log(`Extracted userIds from participant objects for reunion ${reunionId}:`, reunion.userIds);
              } else if (typeof participants[0] === 'number') {
                reunion.userIds = [...participants];
                console.log(`Using participant numbers directly as userIds for reunion ${reunionId}:`, reunion.userIds);
              } else if (typeof participants[0] === 'string') {
                console.log(`Participant data is strings, will need to look up IDs for reunion ${reunionId}`);
                
                fetch(`http://localhost:8010/api/v1/Reunions/${reunionId}/participant-ids`)
                  .then(response => response.json())
                  .then(userIds => {
                    if (Array.isArray(userIds)) {
                      reunion.userIds = userIds;
                      console.log(`Retrieved userIds from alternate endpoint for reunion ${reunionId}:`, reunion.userIds);
                    }
                  })
                  .catch(error => {
                    console.log(`Alternate endpoint not available for reunion ${reunionId}:`, error);
                  });
              }
            } else {
              reunion.userIds = [];
              console.log(`No participants for reunion ${reunionId}, setting empty userIds array`);
            }
          } else {
            console.warn(`Participants data for reunion ${reunionId} is not an array:`, participants);
          }
          
          console.log(`Réunion mise à jour avec les participants:`, reunion);
        } else {
          console.warn(`Réunion ${reunionId} non trouvée dans la liste des réunions`);
        }
      },
      error: (error) => {
        console.error(`Erreur lors du chargement des participants pour la réunion ${reunionId}:`, error);
        console.error('Détails de l\'erreur:', {
          status: error.status,
          message: error.message,
          error: error.error
        });
        
        console.log(`Trying direct fetch for participants of reunion ${reunionId}`);
        fetch(`http://localhost:8010/api/v1/Reunions/${reunionId}/participants`)
          .then(response => response.ok ? response.json() : Promise.reject(`HTTP error ${response.status}`))
          .then(directParticipants => {
            console.log(`Direct fetch participants for reunion ${reunionId}:`, directParticipants);
            const reunion = this.reunions.find(r => r.id === reunionId);
            if (reunion && Array.isArray(directParticipants)) {
              reunion.participants = directParticipants;
              
              if (directParticipants.length > 0) {
                if (typeof directParticipants[0] === 'object' && directParticipants[0]?.id) {
                  reunion.userIds = directParticipants.map(p => p.id);
                } else if (typeof directParticipants[0] === 'number') {
                  reunion.userIds = [...directParticipants];
                }
                console.log(`Updated userIds from direct fetch for reunion ${reunionId}:`, reunion.userIds);
              }
            }
          })
          .catch(fetchError => {
            console.error(`Direct fetch also failed for reunion ${reunionId}:`, fetchError);
            
            Swal.fire({
              icon: 'error',
              title: 'Erreur de chargement',
              text: 'Impossible de charger les participants de la réunion. Veuillez réessayer plus tard.',
              showConfirmButton: false,
              timer: 3000
            });
          });
      }
    });
  }

  openModal() {
    this.selectedReunion = null;
    this.resetForm();
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.resetForm();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file instanceof File) {
      this.newReunionDocument = file;
    }
  }

  addReunion() {
    const reunionToCreate = {
      ...this.newReunion,
      userIds: this.selectedUserIds
    };

    this.reunionService.createReunion(reunionToCreate).subscribe({
      next: (response) => {
        if (this.newReunionDocument && response.id) {
          this.reunionService.addDocumentToReunion(response.id, this.newReunionDocument).subscribe({
            next: (docResponse) => {
              Swal.fire({
                position: "top-end",
                icon: "success",
                title: "Votre réunion a été créée avec succès",
                showConfirmButton: false,
                timer: 1500
              });
              this.closeModal();
              this.selectedUserIds = [];
              this.loadReunions(); // Recharger les données
            },
            error: (error) => {
              Swal.fire({
                position: "center",
                icon: "error",
                title: "Erreur lors de l'ajout du document",
                text: "Le document n'a pas pu être ajouté à la réunion",
                showConfirmButton: true
              });
              console.error('Erreur lors de l\'ajout du document', error);
            }
          });
        } else {
          Swal.fire({
            position: "top-end",
            icon: "success",
            title: "Votre réunion a été créée avec succès",
            showConfirmButton: false,
            timer: 1500
          });
          this.closeModal();
          this.selectedUserIds = [];
          this.loadReunions(); // Recharger les données
        }
      },
      error: (error) => {
        Swal.fire({
          position: "center",
          icon: "error",
          title: "Erreur lors de la création de la réunion",
          text: "La réunion n'a pas pu être créée. Veuillez vérifier les informations saisies.",
          showConfirmButton: true
        });
        console.error('Erreur lors de la création de la réunion', error);
      }
    });
  }

  resetForm() {
    this.newReunion = {
      titre: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      heure: '',
      lieu: '',
      pv: '',
      documents: undefined,
      userIds: []
    };
    this.newReunionDocument = null;
  }

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

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

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
    console.log('Calendar visibility toggled:', this.calendarVisible);
  }
  

  setView(view: CalendarView) {
    this.view = view;
    console.log('View changed to:', view);
  }

  openDocumentModal(reunion: Reunion) {
    this.selectedReunion = reunion;
    this.isDocumentModalOpen = true;
  }

  closeDocumentModal() {
    this.isDocumentModalOpen = false;
    this.selectedReunion = null;
    this.selectedDocument = null;
  }

  onDocumentSelected(event: any) {
    const file = event.target.files[0];
    if (file instanceof File) {
      this.selectedDocument = file;
    }
  }

  addDocument() {
    if (this.selectedReunion && this.selectedDocument && this.selectedReunion.id && this.selectedDocument instanceof File) {
      this.reunionService.addDocumentToReunion(this.selectedReunion.id, this.selectedDocument).subscribe(
        (response) => {
          Swal.fire({
            title: "Document ajouté !",
            icon: "success",
            showConfirmButton: false,
            timer: 1500
          });
          this.loadReunions(); // Recharger les données
          this.closeDocumentModal();
        },
        (error) => {
          Swal.fire({
            icon: "error",
            title: "Oops...",
            text: "Une erreur est survenue lors de l'ajout du document !",
            footer: '<a href="#">Pourquoi cette erreur ?</a>'
          });
          console.error('Erreur lors de l\'ajout du document', error);
        }
      );
    }
  }

  deleteReunion(reunionId: number | undefined) {
    if (reunionId) {
      Swal.fire({
        title: "Êtes-vous sûr ?",
        text: "Vous ne pourrez pas revenir en arrière !",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Oui, supprimer !",
        cancelButtonText: "Annuler"
      }).then((result) => {
        if (result.isConfirmed) {
          this.reunionService.deleteReunion(reunionId).subscribe(
            () => {
              this.loadReunions(); // Recharger les données
              this.selectedReunion = null; // Réinitialiser la sélection
              Swal.fire({
                title: "Supprimé !",
                text: "La réunion a été supprimée.",
                icon: "success"
              });
            },
            (error: any) => {
              Swal.fire({
                title: "Erreur !",
                text: "La réunion n'a pas pu être supprimée.",
                icon: "error"
              });
              console.error('Erreur lors de la suppression de la réunion', error);
            }
          );
        }
      });
    } else {
      console.warn('Aucune réunion sélectionnée pour la suppression');
    }
  }

  editReunion(reunion: Reunion | null) {
    console.log('editReunion called with:', reunion);
    if (reunion && reunion.id !== undefined) {
      if (reunion.userIds && Array.isArray(reunion.userIds) && reunion.userIds.length > 0) {
        console.log('Using userIds directly from the reunion object:', reunion.userIds);
        this.selectedUserIds = [...reunion.userIds];
      }
      
      this.reunionService.getReunionById(reunion.id).subscribe(
        (data: Reunion) => {
          console.log('Data retrieved for editing:', data);
          if (!data) {
            console.error('Aucune donnée récupérée pour cette réunion.');
            return;
          }
          this.selectedReunion = data;
          this.newReunion = {
            ...data,
            date: new Date(data.date).toISOString().split('T')[0]
          };
          
          console.log('Full reunion data for editing:', JSON.stringify(data, null, 2));
          
          if (data.userIds && Array.isArray(data.userIds)) {
            console.log('Setting userIds from retrieved data:', data.userIds);
            this.selectedUserIds = [...data.userIds];
          } else {
            if (reunion.userIds && Array.isArray(reunion.userIds) && reunion.userIds.length > 0) {
              console.log('Using userIds from initial reunion object:', reunion.userIds);
              this.selectedUserIds = [...reunion.userIds];
            } else {
              this.selectedUserIds = [];
              if (data.id) {
                console.log(`Attempting to fetch participants for reunion ID ${data.id}`);
                this.reunionService.getReunionParticipants(data.id).subscribe({
                  next: (participants) => {
                    console.log(`Participants for editing reunion ${data.id}:`, participants);
                    if (participants && Array.isArray(participants)) {
                      if (participants.length > 0) {
                        if (typeof participants[0] === 'object' && participants[0]?.id) {
                          this.selectedUserIds = participants.map(p => p.id);
                        } else if (typeof participants[0] === 'number') {
                          this.selectedUserIds = [...participants];
                        }
                      }
                    }
                    console.log('selectedUserIds set to:', this.selectedUserIds);
                    
                    console.log('Fetching from direct endpoint for debugging:');
                    fetch(`http://localhost:8010/api/v1/Reunions/${data.id}/participants`)
                      .then(response => response.json())
                      .then(directData => {
                        console.log('Direct fetch result:', directData);
                        if (directData && Array.isArray(directData) && directData.length > 0) {
                          if (typeof directData[0] === 'object' && directData[0]?.id) {
                            this.selectedUserIds = directData.map(p => p.id);
                          } else if (typeof directData[0] === 'number') {
                            this.selectedUserIds = [...directData];
                          }
                          console.log('Updated selectedUserIds from direct fetch:', this.selectedUserIds);
                        }
                      })
                      .catch(error => console.error('Error in direct fetch:', error));
                  },
                  error: (error) => {
                    console.error(`Error fetching participants for editing:`, error);
                  }
                });
              }
            }
          }
          
          console.log('New reunion data set for modal:', this.newReunion);
          console.log('Selected user IDs:', this.selectedUserIds);
          this.isModalOpen = true;
        },
        (error: any) => {
          console.error('Erreur lors de la récupération de la réunion', error);
        }
      );
    } else {
      console.warn('Aucune réunion valide sélectionnée pour modification.');
    }
  }

  formatDateForInput(date: Date): string {
    if (!date) return '';

    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  updateReunion() {
    const reunionId = this.selectedReunion?.id;
    if (reunionId) {
      Swal.fire({
        title: "Voulez-vous enregistrer les modifications ?",
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "Enregistrer",
        denyButtonText: `Ne pas enregistrer`,
        cancelButtonText: "Annuler"
      }).then((result) => {
        if (result.isConfirmed) {
          const reunionToUpdate = {
            ...this.newReunion,
            userIds: this.selectedUserIds || []
          };
          
          console.log('Updating reunion with data:', reunionToUpdate);
          
          this.reunionService.updateReunion(reunionId, reunionToUpdate).subscribe(
            (response) => {
              console.log('Reunion update response:', response);
              
              
              this.reunionService.updateReunionParticipants(reunionId, this.selectedUserIds || [])
                .subscribe(
                  (participantsResponse) => {
                    console.log('Participants update response:', participantsResponse);
                  },
                  (participantsError) => {
                    console.error('Error updating participants separately:', participantsError);
                    console.log('But participants were included in the main update, so this might be ok');
                  }
                );
              
              Swal.fire("Modifications enregistrées !", "", "success");
              
              this.loadReunions(); // Recharger les données
              this.isModalOpen = false;
              this.selectedReunion = null;
              this.newReunion = {
                titre: '',
                description: '',
                date: new Date().toISOString().split('T')[0],
                heure: '',
                lieu: '',
                pv: '',
                documents: undefined,
                userIds: []
              };
              this.selectedUserIds = [];
            },
            (error) => {
              Swal.fire("Erreur", "Les modifications n'ont pas pu être enregistrées", "error");
              console.error('Erreur lors de la mise à jour de la réunion:', error);
            }
          );
        } else if (result.isDenied) {
          Swal.fire("Les modifications n'ont pas été enregistrées", "", "info");
          this.isModalOpen = false;
        }
      });
    }
  }

  getDocumentUrl(reunionId: number): string {
    return `${this.apiUrl}/${reunionId}/documents`;
  }

  getParticipantsNames(userIds: number[]): string {
    console.log('getParticipantsNames appelé avec userIds:', userIds);
    console.log('Liste des utilisateurs disponibles:', this.users);
    
    if (!this.users || !userIds || userIds.length === 0) {
      console.log('Aucun utilisateur ou userIds disponible');
      return 'Aucun participant';
    }

    const names = userIds
      .map(id => {
        const user = this.users.find(u => u.id === id);
        console.log(`Recherche de l'utilisateur avec l'ID ${id}:`, user);
        return user ? `${user.nom} ${user.prenom}` : '';
      })
      .filter(name => name !== '');
    
    console.log('Noms des participants trouvés:', names);
    return names.length > 0 ? names.join(', ') : 'Aucun participant';
  }

  getParticipantsDisplay(participants: any[]): string {
    console.log('getParticipantsDisplay called with:', participants);
    
    if (!participants || participants.length === 0) {
      return 'Aucun participant';
    }
    
    if (Array.isArray(participants)) {
      return participants.map(participant => {
        if (typeof participant === 'string') {
          return participant;
        } else if (typeof participant === 'object') {
          return `${participant.nom || ''} ${participant.prenom || ''}`.trim();
        }
        return String(participant);
      }).filter(name => name).join(', ');
    }
    
    return 'Aucun participant';
  }

  exportReunionsCsv() {
    console.log("Export CSV clic détecté");
    this.reunionService.exportReunionsCsv().subscribe(
      (response: Blob) => {
        const fileURL = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = fileURL;
        a.download = 'reunions.csv';
        a.click();
        window.URL.revokeObjectURL(fileURL);
      },
      (error) => {
        console.error('Erreur lors de l\'exportation des réunions en CSV', error);
      }
    );
  }

  getReunionsByDate(date: string): Reunion[] {
    return this.reunions.filter(reunion => reunion.date === date);
  }

  getReunionsByMonth(month: number, year: number): Reunion[] {
    return this.reunions.filter(reunion => {
      const reunionDate = new Date(reunion.date);
      return reunionDate.getMonth() === month && reunionDate.getFullYear() === year;
    });
  }

  getReunionsByYear(year: number): Reunion[] {
    return this.reunions.filter(reunion => {
      const reunionDate = new Date(reunion.date);
      return reunionDate.getFullYear() === year;
    });
  }

  getReunionsByDateRange(startDate: string, endDate: string): Reunion[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.reunions.filter(reunion => {
      const reunionDate = new Date(reunion.date);
      return reunionDate >= start && reunionDate <= end;
    });
  }

  createReunion() {
    if (this.newReunion.titre && this.newReunion.date && this.newReunion.heure && this.newReunion.lieu) {
      const reunionToCreate = {
        titre: this.newReunion.titre,
        date: this.newReunion.date,
        heure: this.newReunion.heure,
        lieu: this.newReunion.lieu,
        description: this.newReunion.description || '',
        pv: this.newReunion.pv || '',
        userIds: this.selectedUserIds || []
      };
      
      console.log('Données envoyées pour la création de la réunion:', reunionToCreate);
      
      this.reunionService.createReunion(reunionToCreate).subscribe({
        next: (response) => {
          console.log('Réponse du serveur:', response);
          if (response.status === 201 || response.status === 200) {
            Swal.fire({
              position: "top-end",
              icon: "success",
              title: "Votre réunion a été créée avec succès",
              showConfirmButton: false,
              timer: 1500
            });
            this.loadReunions();
            this.isModalOpen = false;
            this.resetForm();
          } else {
            Swal.fire({
              position: "center",
              icon: "warning",
              title: "Réponse inattendue du serveur",
              text: "Le serveur a répondu avec un statut inattendu: " + response.status,
              showConfirmButton: true
            });
          }
        },
        error: (error) => {
          console.error('Erreur lors de la création de la réunion:', error);
          let errorMessage = "La réunion n'a pas pu être créée. Veuillez vérifier les informations saisies.";
          
          if (error.error) {
            console.error('Corps de l\'erreur:', error.error);
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            }
          }
          
          Swal.fire({
            position: "center",
            icon: "error",
            title: "Erreur lors de la création de la réunion",
            text: errorMessage,
            showConfirmButton: true
          });
        }
      });
    } else {
      Swal.fire({
        position: "center",
        icon: "warning",
        title: "Champs manquants",
        text: "Veuillez remplir tous les champs obligatoires (titre, date, heure, lieu)",
        showConfirmButton: true
      });
    }
  }

  loadUsers() {
    console.log('Chargement des utilisateurs...');
    this.reunionService.getUsersShortInfo().subscribe({
      next: (users) => {
        console.log('Utilisateurs chargés avec succès:', users);
        this.users = users;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        Swal.fire({
          position: "center",
          icon: "error",
          title: "Erreur lors du chargement des utilisateurs",
          text: "Impossible de charger la liste des utilisateurs",
          showConfirmButton: true
        });
      }
    });
  }

  searchReunions() {
    if (!this.searchTerm) {
      this.filteredReunions = [...this.reunions];
      return;
    }
    
    this.filteredReunions = this.reunions.filter(reunion => 
      reunion.titre.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  toggleSearch() {
    this.isSearchVisible = !this.isSearchVisible;
  }

  toggleTableSearch() {
    this.isTableSearchVisible = !this.isTableSearchVisible;
  }

  generateReport(reunionId: number | undefined) {
    if (!reunionId || !this.selectedReunion) {
      Swal.fire({
        icon: 'warning',
        title: 'Aucune réunion sélectionnée',
        text: 'Veuillez sélectionner une réunion pour générer le PV.',
        showConfirmButton: true
      });
      return;
    }

    this.reunionService.generateReunionReport(reunionId).subscribe(
      (response: Blob) => {
        const fileURL = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = fileURL;
        a.download = `pv${reunionId}.pdf`;

        a.addEventListener('click', () => {
          setTimeout(() => {
            window.URL.revokeObjectURL(fileURL);
            a.remove();
          }, 100);
        });

        document.body.appendChild(a);
        a.click();
      },
      (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Une erreur est survenue lors de la génération du PV.',
          showConfirmButton: true
        });
        console.error('Erreur lors de la génération du rapport PDF:', error);
      }
    );
  }

  logout() {
    this.keycloakService.logout(environment.keycloakConfig.logoutRedirectUri).then(() => {
      console.log('Déconnexion réussie');
    }).catch((error) => {
      console.error('Erreur lors de la déconnexion:', error);
    });
  }

  hi(){
    this.reunionService.hi().subscribe(
      (response) => {
        console.log('Response from hi endpoint:', response);
      }
    );
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
    // Get unique titles
    this.uniqueTitres = [...new Set(this.reunions.map(r => r.titre))];
    
    // Get unique dates
    this.uniqueDates = [...new Set(this.reunions.map(r => r.date))].sort();
    
    // Get unique participants
    const participantsSet = new Set<string>();
    const participantsMap = new Map<string, User>();
    
    this.reunions.forEach(reunion => {
      if (reunion.participants) {
        reunion.participants.forEach(part => {
          if (typeof part === 'object' && part.id) {
            const key = `${part.id}-${part.nom}-${part.prenom}`;
            if (!participantsSet.has(key)) {
              participantsSet.add(key);
              participantsMap.set(key, part);
            }
          }
        });
      }
    });
    
    this.uniqueParticipants = Array.from(participantsMap.values());
  }

  applyFilters() {
    this.filteredReunions = this.reunions.filter(reunion => {
      const titreMatch = !this.filterTitre || reunion.titre === this.filterTitre;
      const dateMatch = !this.filterDate || reunion.date === this.filterDate;
      const participantMatch = !this.filterParticipant || 
        reunion.participants?.some(part => {
          if (typeof part === 'object' && part.id) {
            return part.id.toString() === this.filterParticipant;
          }
          return false;
        });
      
      return titreMatch && dateMatch && participantMatch;
    });
    
    this.closeFilterModal();
  }

  resetFilters() {
    this.filterTitre = '';
    this.filterDate = '';
    this.filterParticipant = '';
    this.filteredReunions = [...this.reunions];
    this.closeFilterModal();
  }
  
} // Ajout de l'accolade manquante pour fermer la classe


