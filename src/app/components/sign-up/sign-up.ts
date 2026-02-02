import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Signup {
  id: string;
  playerName: string;
  email: string;
  deckName: string;
  commander: string;
  createdAt: string;
}

@Component({
  selector: 'app-sign-up',
  imports: [ReactiveFormsModule],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.scss',
})
export class SignUp implements OnInit {
  private http = inject(HttpClient);
  submitMessage = '';
  isSubmitting = false;
  signups: Signup[] = [];

  signUpForm = new FormGroup({
    playerName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    deckName: new FormControl('', [Validators.required]),
    commander: new FormControl('', [Validators.required]),
  });

  ngOnInit() {
    this.loadSignups();
  }

  loadSignups() {
    this.http.get<Signup[]>('http://localhost:3000/api/signups')
      .subscribe({
        next: (signups) => {
          this.signups = signups;
        },
        error: (error) => {
          console.error('Failed to load signups:', error);
        }
      });
  }

  onSubmit() {
    if (this.signUpForm.valid) {
      this.isSubmitting = true;
      this.submitMessage = '';
      
      this.http.post('http://localhost:3000/api/signups', this.signUpForm.value)
        .subscribe({
          next: (response) => {
            console.log('Sign up successful:', response);
            this.submitMessage = 'Sign up successful!';
            this.signUpForm.reset();
            this.isSubmitting = false;
            this.loadSignups();
          },
          error: (error) => {
            console.error('Sign up failed:', error);
            this.submitMessage = error.error?.error || 'Sign up failed. Please try again.';
            this.isSubmitting = false;
          }
        });
    }
  }
}
