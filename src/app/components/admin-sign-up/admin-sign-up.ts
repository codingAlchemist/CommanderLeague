import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin-sign-up',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    RouterLink,
  ],
  templateUrl: './admin-sign-up.html',
  styleUrl: './admin-sign-up.scss',
})
export class AdminSignUp {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly statusMessage = signal('');
  readonly isSuccessful = signal(false);

  readonly signUpForm = new FormGroup({
    token: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  async onSubmit(): Promise<void> {
    if (this.signUpForm.invalid) {
      this.signUpForm.markAllAsTouched();
      this.statusMessage.set('Complete all fields with valid information.');
      return;
    }

    const { token, email, password, confirmPassword } = this.signUpForm.getRawValue();
    if (password !== confirmPassword) {
      this.signUpForm.controls.confirmPassword.setErrors({ passwordMismatch: true });
      this.statusMessage.set('Passwords must match.');
      return;
    }

    this.isSubmitting.set(true);
    this.statusMessage.set('');
    this.isSuccessful.set(false);

    try {
      await firstValueFrom(
        this.http.post<{ username: string }>('/api/admins', {
          token: token.trim(),
          username: email.trim(),
          password,
        }),
      );
      this.isSuccessful.set(true);
      this.statusMessage.set('Admin account created. You can sign in now.');
      this.signUpForm.reset();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 403) {
        this.statusMessage.set('That admin sign-up token is invalid or unavailable.');
      } else if (error instanceof HttpErrorResponse && error.status === 409) {
        this.statusMessage.set('An admin with that email already exists.');
      } else {
        this.statusMessage.set('Unable to create the admin account right now.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
