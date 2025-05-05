import { Component, OnInit, OnDestroy } from '@angular/core';
import { ThemeService } from './services/theme.service';
import { NotificationService } from './services/notification.service';
import { KeycloakService } from './services/keycloak/keycloak.service';
import { KeycloakProfile } from 'keycloak-js';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'pfe';
  currentDate: string = ''; 
  showCalendrier = false;
  isDarkMode: boolean = false; // Initialize with a default value
  isSidebarHidden: boolean = false;
  calendarVisible: boolean = false; // Ajout de la propriété
  notifications: any[] = [];
  showNotificationModal = false;
  loggedInUsername: string = ''; // Remplacer la valeur codée en dur
  private currentMaxId = 0;
  private lastCheckedTime: Date = new Date();
  private isFirstLoad = true;
  private refreshInterval: any;
  private lastNotificationCount = 0;
  private previousNotifications: any[] = [];
  private knownNotificationIds: Set<number> = new Set();
  private newNotifications: any[] = [];
  private lastSeenNotifications = new Set<number>();
  private newNotificationsCount = 0;
  private seenNotificationIds = new Set<number>();
  private lastCheckTime = new Date();
  private unreadNotifications = new Set<number>();
  private lastFetchTime = new Date();
  private readNotificationsCache = new Set<number>();

  constructor(
    private themeService: ThemeService,
    private notificationService: NotificationService,
    private keycloakService: KeycloakService
  ) {
    this.themeService.isDarkMode$.subscribe(
      isDark => {
        this.isDarkMode = isDark;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      }
    );
    // Obtenir le nom d'utilisateur de Keycloak
    this.keycloakService.getUserInfo().then((userInfo: KeycloakProfile | null) => {
      this.loggedInUsername = userInfo?.username || '';
    });
  }

  ngOnInit() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.themeService.setDarkMode(savedTheme === 'dark');
    }
    // Charger les notifications une seule fois au démarrage
    this.loadNotifications(true);

    // Charger les notifications lues depuis le localStorage
    const savedReadNotifications = localStorage.getItem('readNotifications');
    if (savedReadNotifications) {
      this.readNotificationsCache = new Set(JSON.parse(savedReadNotifications));
    }

    // Réduire l'intervalle de rafraîchissement à 10 secondes
    this.refreshInterval = setInterval(() => {
      this.checkNewNotifications();
    }, 10000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  toggleTheme() {
    this.themeService.toggleTheme(); // Utiliser la nouvelle méthode
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
  }
  
  toggleCalendar() {
    this.calendarVisible = !this.calendarVisible;
    console.log('Calendar visibility toggled:', this.calendarVisible);
  }
  
  toggleSidebar() {
    this.isSidebarHidden = !this.isSidebarHidden;
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('hide');
    }
  }

  loadNotifications(isInitial: boolean = false, username?: string) {
    const userToLoad = username || this.loggedInUsername;
    if (!userToLoad) {
      console.log('Username not available');
      return;
    }
    
    this.notificationService.getNotificationsByUser(userToLoad).subscribe({
      next: (notifications) => {
        // Marquer les notifications comme nouvelles si leur date est plus récente que lastCheckTime
        this.notifications = notifications.map(notif => ({
          ...notif,
          dateEnvoi: new Date(notif.dateEnvoi),
          isNew: new Date(notif.dateEnvoi) > this.lastCheckTime
        }));

        if (isInitial) {
          this.lastCheckTime = new Date();
        }

        // Ajouter les nouvelles notifications à unreadNotifications
        notifications.forEach(notif => {
          if (new Date(notif.dateEnvoi) > this.lastCheckTime) {
            this.unreadNotifications.add(notif.id);
          }
        });
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
      }
    });
  }

  checkNewNotifications() {
    if (!this.loggedInUsername) return;
    
    const currentTime = new Date();
    this.notificationService.getNotificationsByUser(this.loggedInUsername).subscribe({
      next: (notifications) => {
        // Ne considérer comme nouvelles que les notifications qui ne sont pas dans le cache
        const newNotifs = notifications.filter(notif => 
          new Date(notif.dateEnvoi) > this.lastFetchTime && 
          !this.readNotificationsCache.has(notif.id)
        );
        
        // Mettre à jour la liste complète en excluant les notifications déjà lues
        this.notifications = notifications.map(notif => ({
          ...notif,
          dateEnvoi: new Date(notif.dateEnvoi),
          isNew: !this.readNotificationsCache.has(notif.id)
        }));

        this.lastFetchTime = currentTime;
        this.updateNotificationCount();
      },
      error: (error) => {
        console.error('Error checking notifications:', error);
      }
    });
  }

  getNotificationCount(): number {
    return this.notifications.filter(
      notif => !this.readNotificationsCache.has(notif.id)
    ).length;
  }

  isUnread(notification: any): boolean {
    return !this.readNotificationsCache.has(notification.id);
  }

  markAsRead(notificationId: number) {
    this.unreadNotifications.delete(notificationId);
    this.readNotificationsCache.add(notificationId);
    // Sauvegarder dans localStorage
    localStorage.setItem('readNotifications', 
      JSON.stringify(Array.from(this.readNotificationsCache)));
    this.notificationService.markAsRead(notificationId);
    this.updateNotificationCount();
  }

  async toggleNotificationModal() {
    this.showNotificationModal = !this.showNotificationModal;
    
    if (this.showNotificationModal) {
      try {
        const keycloak = await this.keycloakService.getKeycloakInstance();
        if (keycloak) {
          const profile = await keycloak.loadUserProfile();
          if (profile.username) {
            this.loadNotifications(true, profile.username);
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    } else {
      // Marquer toutes les notifications comme lues lors de la fermeture du modal
      this.notifications.forEach(notif => {
        this.markAsRead(notif.id);
      });
      // Forcer la mise à jour du compteur
      this.updateNotificationCount();
    }
  }

  private updateNotificationCount() {
    // Filtrer les notifications non lues
    const unreadCount = this.notifications.filter(
      notif => !this.readNotificationsCache.has(notif.id)
    ).length;

    if (unreadCount === 0) {
      this.lastCheckTime = new Date();
      this.lastFetchTime = new Date();
    }
  }

  isRead(notificationId: number): boolean {
    return this.notificationService.isRead(notificationId);
  }
}
