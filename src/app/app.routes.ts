import { Routes } from '@angular/router';
import { adminAuthGuard } from './guards/admin-auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'sign-up', pathMatch: 'full' },
  {
    path: 'admin-login',
    loadComponent: () => import('./components/admin-login/admin-login').then((m) => m.AdminLogin),
  },
  {
    path: 'sign-up',
    loadComponent: () => import('./components/sign-up/sign-up').then((m) => m.SignUp),
  },
  {
    path: 'player-login',
    loadComponent: () =>
      import('./components/player-login/player-login').then((m) => m.PlayerLogin),
  },
  {
    path: 'tournament',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./components/tournament/tournament').then((m) => m.Tournament),
  },
  {
    path: 'rankings',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./components/current-player-rankings/current-player-rankings').then(
        (m) => m.CurrentPlayerRankings,
      ),
  },
];
