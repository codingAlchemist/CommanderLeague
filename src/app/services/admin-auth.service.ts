import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly storageKey = 'commander-league-admin-auth';
  private readonly adminDomain = '@commanderleague.com';
  private readonly minPasswordLength = 8;

  private readonly _isAdmin = signal(this.readStoredAuthState());
  readonly isAdmin = computed(() => this._isAdmin());

  login(email: string, password: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    const isValidAdmin =
      normalizedEmail.endsWith(this.adminDomain) && password.length >= this.minPasswordLength;

    this._isAdmin.set(isValidAdmin);
    this.persistAuthState(isValidAdmin);

    return isValidAdmin;
  }

  logout(): void {
    this._isAdmin.set(false);
    this.persistAuthState(false);
  }

  private readStoredAuthState(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    return localStorage.getItem(this.storageKey) === 'true';
  }

  private persistAuthState(isAdmin: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.storageKey, String(isAdmin));
  }
}
