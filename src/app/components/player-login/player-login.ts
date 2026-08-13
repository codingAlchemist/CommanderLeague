import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface PlayerLoginResponse {
  id: string;
  playerName: string;
  email: string;
  discordUsername: string;
  deckName: string;
  commander: string;
  points: number;
  createdAt: string;
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

  loginForm = new FormGroup({
    identifier: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.statusMessage.set('Enter your email or Discord username to sign in.');
      this.currentPlayer.set(null);
      return;
    }

    this.isSubmitting.set(true);
    this.statusMessage.set('');

    const identifier = this.loginForm.controls.identifier.value.trim();

    try {
      const player = await firstValueFrom(
        this.http.post<PlayerLoginResponse>('/api/player/login', { identifier }),
      );

      this.currentPlayer.set(player);
      this.statusMessage.set(`Welcome back, ${player.playerName}!`);
    } catch (error) {
      this.currentPlayer.set(null);

      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.statusMessage.set(
          'We could not find a player account for that email or Discord username.',
        );
      } else {
        this.statusMessage.set('Unable to sign in right now. Please try again later.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goToSignUp(): void {
    void this.router.navigate(['/sign-up']);
  }
}
