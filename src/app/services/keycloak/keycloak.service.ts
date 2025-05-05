import { Injectable } from '@angular/core';
import { KeycloakService as KeycloakAngularService } from 'keycloak-angular';
import { KeycloakConfig, KeycloakInitOptions, KeycloakInstance, KeycloakProfile } from 'keycloak-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class KeycloakService {
  private keycloak: KeycloakInstance;

  constructor(private keycloakAngular: KeycloakAngularService) {
    // Initialiser keycloak dans le constructeur
    this.keycloak = this.keycloakAngular.getKeycloakInstance();
  }

  async init(options?: { config: KeycloakConfig; initOptions: KeycloakInitOptions }): Promise<boolean> {
    try {
      const defaultOptions = {
        config: environment.keycloakConfig,
        initOptions: {
          onLoad: 'check-sso' as const,
          checkLoginIframe: false,
          silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html'
        }
      };
      return await this.keycloakAngular.init(options || defaultOptions);
    } catch (error) {
      console.error('Error initializing Keycloak', error);
      return false;
    }
  }

  async getKeycloakInstance(): Promise<KeycloakInstance | undefined> {
    return this.keycloakAngular.getKeycloakInstance();
  }

  async getToken(): Promise<string> {
    try {
      return await this.keycloakAngular.getToken();
    } catch {
      return '';
    }
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      return await this.keycloakAngular.isLoggedIn();
    } catch {
      return false;
    }
  }

  login(): Promise<void> {
    return this.keycloakAngular.login();
  }

  logout(redirectUri?: string): Promise<void> {
    return this.keycloakAngular.logout(redirectUri);
  }

  async getUserInfo(): Promise<KeycloakProfile | null> {
    try {
      const isAuthenticated = await this.isLoggedIn();
      if (isAuthenticated) {
        const profile = await this.keycloak.loadUserProfile();
        return {
          ...profile,
          username: profile.firstName || profile.username
        };
      }
      return null;
    } catch (error) {
      console.error('Error loading user info:', error);
      return null;
    }
  }
}