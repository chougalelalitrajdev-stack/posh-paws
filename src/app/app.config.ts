import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { AuthProvider } from './core/auth/auth.provider';
import { MockAuthProvider } from './core/auth/mock-auth.provider';
import { PetsProvider } from './core/pets/pets.provider';
import { MockPetsProvider } from './core/pets/mock-pets.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: AuthProvider, useClass: MockAuthProvider },
    { provide: PetsProvider, useClass: MockPetsProvider },
  ]
};
