import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin-password-change',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
  ],
  templateUrl: './admin-password-change.html',
  styleUrl: './admin-password-change.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPasswordChange {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  isSubmitting = signal(false);
  statusMessage = signal('');
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);

  passwordForm = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  toggleCurrentPasswordVisibility(): void {
    this.showCurrentPassword.update((value) => !value);
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword.update((value) => !value);
  }

  async onSubmit(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.statusMessage.set('Please complete all fields and ensure passwords match.');
      return;
    }

    const currentPassword = this.passwordForm.controls.currentPassword.value;
    const newPassword = this.passwordForm.controls.newPassword.value;
    const confirmPassword = this.passwordForm.controls.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      this.statusMessage.set('New password and confirmation do not match.');
      return;
    }

    this.isSubmitting.set(true);
    this.statusMessage.set('');

    try {
      await firstValueFrom(
        this.http.patch<{ success: boolean }>('/api/admin/password', {
          currentPassword,
          newPassword,
        }),
      );

      this.statusMessage.set('Password changed successfully. Please sign in again.');
      setTimeout(() => {
        void this.router.navigate(['/admin-login']);
      }, 1200);
    } catch (error: any) {
      if (error?.status === 401) {
        this.statusMessage.set('Current password is incorrect.');
      } else if (error?.status === 400) {
        this.statusMessage.set(error.error?.error || 'Invalid password data.');
      } else {
        this.statusMessage.set('Failed to change password. Please try again later.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
