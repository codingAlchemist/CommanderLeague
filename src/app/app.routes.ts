import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'tournament', pathMatch: 'full' },
  { path: 'sign-up', loadComponent: () => import('./components/sign-up/sign-up').then(m => m.SignUp) },
  { path: 'tournament', loadComponent: () => import('./components/tournament/tournament').then(m => m.Tournament) }
];
