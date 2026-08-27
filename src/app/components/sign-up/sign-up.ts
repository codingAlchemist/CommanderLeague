import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../services/admin-auth.service';

function passwordMatchValidator(control: {
  get: (name: string) => { value?: string } | null;
}): { [key: string]: boolean } | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password && confirmPassword && password !== confirmPassword
    ? { passwordMismatch: true }
    : null;
}

interface Signup {
  id: string;
  playerName: string;
  email: string;
  discordUsername: string;
  deckName: string;
  commander: string;
  createdAt: string;
}

interface DeckOption {
  name: string;
  displayLabel: string;
  setCode: string;
}

@Component({
  selector: 'app-sign-up',
  imports: [ReactiveFormsModule],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.scss',
})
export class SignUp implements OnInit {
  private http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly isAdmin = inject(AdminAuthService).isAdmin;
  submitMessage = '';
  isSubmitting = false;
  isDeletingId: string | null = null;
  isClearingAll = false;
  signups: Signup[] = [];
  availableDecks: DeckOption[] = [];
  showModal = false;

  signUpForm = new FormGroup(
    {
      playerName: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
      discordUsername: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required, Validators.minLength(6)]),
      confirmPassword: new FormControl('', [Validators.required]),
      deckName: new FormControl('', [Validators.required]),
      commander: new FormControl('', [Validators.required]),
    },
    { validators: passwordMatchValidator },
  );

  ngOnInit() {
    this.loadDecks();
    this.loadSignups();
  }

  loadDecks() {
    this.http.get<DeckOption[] | { decks?: DeckOption[] } | unknown>('/api/decks/all').subscribe({
      next: (response) => {
        const deckEntries = Array.isArray(response)
          ? response
          : Array.isArray((response as { decks?: DeckOption[] })?.decks)
            ? (response as { decks: DeckOption[] }).decks
            : [];

        const deckMap = new Map<string, DeckOption>();

        deckEntries.forEach((deck) => {
          const candidate =
            typeof deck === 'string'
              ? deck
              : typeof (deck as { name?: string })?.name === 'string'
                ? (deck as { name: string }).name
                : typeof (deck as { deckName?: string })?.deckName === 'string'
                  ? (deck as { deckName: string }).deckName
                  : '';

          const trimmedName = candidate.trim();
          if (!trimmedName) {
            return;
          }

          const rawSetCode =
            typeof (deck as { set_code?: string })?.set_code === 'string'
              ? (deck as { set_code: string }).set_code
              : typeof (deck as { setCode?: string })?.setCode === 'string'
                ? (deck as { setCode: string }).setCode
                : 'UNK';

          const setCode = rawSetCode.trim() || 'UNK';
          const existing = deckMap.get(trimmedName);

          if (!existing) {
            deckMap.set(trimmedName, {
              name: trimmedName,
              setCode: setCode.toUpperCase(),
              displayLabel: `${setCode.toUpperCase()} — ${trimmedName}`,
            });
          }
        });

        this.availableDecks = [...deckMap.values()].sort((a, b) => {
          const setComparison = a.setCode.localeCompare(b.setCode);
          return setComparison !== 0 ? setComparison : a.name.localeCompare(b.name);
        });
      },
      error: (error) => {
        console.error('Failed to load decks:', error);
        this.availableDecks = [];
      },
    });
  }

  loadSignups() {
    this.http.get<Signup[]>('/api/signups').subscribe({
      next: (signups) => {
        this.signups = signups;
      },
      error: (error) => {
        console.error('Failed to load signups:', error);
      },
    });
  }

  onSubmit() {
    if (this.signUpForm.invalid) {
      this.signUpForm.markAllAsTouched();
      this.submitMessage = 'Please fix the highlighted form errors before submitting.';
      return;
    }

    this.isSubmitting = true;
    this.submitMessage = '';

    const payload = {
      ...this.signUpForm.value,
      password: this.signUpForm.value.password,
    };

    this.http.post<Signup>('/api/signups', payload).subscribe({
      next: (response) => {
        console.log('Sign up successful:', response);
        this.isSubmitting = false;
        void this.router.navigate(['/player', response.id]);
      },
      error: (error) => {
        console.error('Sign up failed:', error);
        this.submitMessage = error.error?.error || 'Sign up failed. Please try again.';
        this.isSubmitting = false;
      },
    });
  }

  openModal() {
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  deleteSignup(signup: Signup) {
    if (this.isDeletingId || this.isClearingAll) {
      return;
    }

    const shouldDelete = confirm(`Remove ${signup.playerName} from the sign-up list?`);
    if (!shouldDelete) {
      return;
    }

    this.isDeletingId = signup.id;

    this.http.delete(`/api/signups/${signup.id}`).subscribe({
      next: () => {
        this.signups = this.signups.filter((currentSignup) => currentSignup.id !== signup.id);
        this.submitMessage = 'Sign up removed successfully.';
        this.isDeletingId = null;
      },
      error: (error) => {
        console.error('Failed to delete signup:', error);
        this.submitMessage = error.error?.error || 'Failed to remove sign up. Please try again.';
        this.isDeletingId = null;
      },
    });
  }

  clearAllSignups() {
    if (this.isClearingAll || this.isDeletingId || this.signups.length === 0) {
      return;
    }

    const shouldDeleteAll = confirm('Remove all sign-ups from the list? This cannot be undone.');
    if (!shouldDeleteAll) {
      return;
    }

    this.isClearingAll = true;

    this.http.delete('/api/signups').subscribe({
      next: () => {
        this.signups = [];
        this.submitMessage = 'All sign ups removed successfully.';
        this.isClearingAll = false;
      },
      error: (error) => {
        console.error('Failed to clear signups:', error);
        this.submitMessage =
          error.error?.error || 'Failed to remove all sign ups. Please try again.';
        this.isClearingAll = false;
      },
    });
  }
}
