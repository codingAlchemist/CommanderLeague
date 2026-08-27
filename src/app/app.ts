import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AdminAuthService } from './services/admin-auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly router = inject(Router);
  readonly adminAuthService = inject(AdminAuthService);

  protected readonly title = signal('commander-sign-up-sheet');

  logout(): void {
    this.adminAuthService.logout();
    void this.router.navigate(['/sign-up']);
  }
}
