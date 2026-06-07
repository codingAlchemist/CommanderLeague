import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Signup {
  id: string;
  playerName: string;
  email: string;
  discordUsername: string;
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
  isDeletingId: string | null = null;
  signups: Signup[] = [];
  showModal = false;

  signUpForm = new FormGroup({
    playerName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    discordUsername: new FormControl('', [Validators.required]),
    deckName: new FormControl('', [Validators.required]),
    commander: new FormControl('', [Validators.required]),
  });

  ngOnInit() {
    this.loadSignups();
  }

  loadSignups() {
    this.http.get<Signup[]>('/api/signups')
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
      
      this.http.post('/api/signups', this.signUpForm.value)
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

  openModal() {
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  deleteSignup(signup: Signup) {
    if (this.isDeletingId) {
      return;
    }

    const shouldDelete = confirm(`Remove ${signup.playerName} from the sign-up list?`);
    if (!shouldDelete) {
      return;
    }

    this.isDeletingId = signup.id;

    this.http.delete(`/api/signups/${signup.id}`)
      .subscribe({
        next: () => {
          this.signups = this.signups.filter(currentSignup => currentSignup.id !== signup.id);
          this.submitMessage = 'Sign up removed successfully.';
          this.isDeletingId = null;
        },
        error: (error) => {
          console.error('Failed to delete signup:', error);
          this.submitMessage = error.error?.error || 'Failed to remove sign up. Please try again.';
          this.isDeletingId = null;
        }
      });
  }
}
