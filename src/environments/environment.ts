import { KeycloakConfig } from 'keycloak-js';

export const environment = {
  production: false,
  apiUrl: '/hello/api/v1',
  keycloakConfig: {
    url: 'http://localhost:9098',
    realm: 'micro-services',
    clientId: 'micro-services-api',
    redirectUri: 'http://localhost:4200/',
    logoutRedirectUri: 'http://localhost:4200/login'
  }
};
