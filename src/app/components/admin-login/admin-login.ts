import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    RouterLink,
  ],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.scss',
})
export class AdminLogin {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly adminAuthService = inject(AdminAuthService);

  isSubmitting = signal(false);
  statusMessage = signal('');
  showPassword = signal(false);

  loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.statusMessage.set('Enter a valid admin email and password.');
      return;
    }

    this.isSubmitting.set(true);
    this.statusMessage.set('');

    const email = this.loginForm.controls.email.value;
    const password = this.loginForm.controls.password.value;

    try {
      const isAdmin = await firstValueFrom(this.adminAuthService.login(email, password));

      if (isAdmin) {
        const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo') ?? '/tournament';
        this.statusMessage.set('Admin access granted. Redirecting...');
        void this.router.navigateByUrl(redirectTo);
        return;
      }

      this.statusMessage.set('Invalid admin credentials. Please try again.');
    } catch (error) {
      this.adminAuthService.logout();

      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.statusMessage.set('Invalid admin credentials. Please try again.');
      } else {
        this.statusMessage.set('Unable to sign in right now. Please try again later.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((current) => !current);
  }
}
