import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AuthProvider } from './core/auth/auth.provider';
import { MockAuthProvider } from './core/auth/mock-auth.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: AuthProvider, useClass: MockAuthProvider },
  ]
};
