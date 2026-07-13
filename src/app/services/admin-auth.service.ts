import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

interface AdminLoginResponse {
  authenticated: boolean;
  isAdmin: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'commander-league-admin-auth';

  private readonly _isAdmin = signal(this.readStoredAuthState());
  readonly isAdmin = computed(() => this._isAdmin());

  login(email: string, password: string): Observable<boolean> {
    return this.http
      .post<AdminLoginResponse>('/api/admin/login', {
        username: email,
        password,
      })
      .pipe(
        map((response) => Boolean(response.authenticated && response.isAdmin)),
        tap((isAdmin) => {
          this._isAdmin.set(isAdmin);
          this.persistAuthState(isAdmin);
        }),
      );
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
