import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

function passwordMatchValidator(control: {
  get: (name: string) => { value?: string } | null;
}): { [key: string]: boolean } | null {
  const password = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password && confirmPassword && password !== confirmPassword
    ? { passwordMismatch: true }
    : null;
}

interface PlayerLoginResponse {
  id: string;
  playerName: string;
  email: string;
  discordUsername: string;
  deckName: string;
  commander: string;
  points: number;
  absent: boolean;
  createdAt: string;
  deckList?: string[];
  requiresPasswordSetup?: boolean;
}

@Component({
  selector: 'app-player-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './player-login.html',
  styleUrl: './player-login.scss',
})
export class PlayerLogin {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  isSubmitting = signal(false);
  statusMessage = signal('');
  currentPlayer = signal<PlayerLoginResponse | null>(null);
  needsPasswordSetup = signal(false);

  loginForm = new FormGroup({
    identifier: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  passwordSetupForm = new FormGroup(
    {
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordMatchValidator },
  );

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.statusMessage.set('Enter your email or Discord username and password to sign in.');
      this.currentPlayer.set(null);
      return;
    }

    this.isSubmitting.set(true);
    this.statusMessage.set('');

    const identifier = this.loginForm.controls.identifier.value.trim();
    const password = this.loginForm.controls.password.value.trim();

    try {
      const player = await firstValueFrom(
        this.http.post<PlayerLoginResponse>('/api/player/login', { identifier, password }),
      );

      this.currentPlayer.set(player);

      if (player.requiresPasswordSetup) {
        this.needsPasswordSetup.set(true);
        this.statusMessage.set(
          `No password is set for ${player.playerName}. Create one to finish signing in.`,
        );
        return;
      }

      this.needsPasswordSetup.set(false);
      this.statusMessage.set(`Welcome back, ${player.playerName}!`);
      void this.router.navigate(['/player', player.id]);
    } catch (error) {
      this.currentPlayer.set(null);
      this.needsPasswordSetup.set(false);

      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.statusMessage.set('The password or identifier you entered is incorrect.');
      } else if (error instanceof HttpErrorResponse && error.status === 400) {
        this.statusMessage.set('Enter both your email or Discord username and a valid password.');
      } else {
        this.statusMessage.set('Unable to sign in right now. Please try again later.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async setPassword(): Promise<void> {
    if (this.passwordSetupForm.invalid) {
      this.passwordSetupForm.markAllAsTouched();
      this.statusMessage.set('Choose a password with at least 6 characters and confirm it.');
      return;
    }

    const playerId = this.currentPlayer()?.id;
    const password = this.passwordSetupForm.controls.newPassword.value.trim();

    if (!playerId) {
      this.statusMessage.set('Please log in again to create your password.');
      return;
    }

    try {
      await firstValueFrom(this.http.patch(`/api/player/${playerId}/password`, { password }));

      this.needsPasswordSetup.set(false);
      this.passwordSetupForm.reset();
      this.statusMessage.set(
        `Password created for ${this.currentPlayer()?.playerName}. You are signed in.`,
      );
      void this.router.navigate(['/player', playerId]);
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        this.statusMessage.set(error.error?.error || 'Unable to save your password right now.');
      } else {
        this.statusMessage.set('Unable to save your password right now.');
      }
    }
  }

  goToSignUp(): void {
    void this.router.navigate(['/sign-up']);
  }
}
