import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

interface PlayerProfile {
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
}

interface DeckSwapRequest {
  cardIndex: number;
  replacementCard: string;
}

@Component({
  selector: 'app-player-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="player-page-shell">
      @if (isLoading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading player profile...</p>
        </div>
      } @else if (player()) {
        <article class="player-card">
          <header class="player-header">
            <div>
              <p class="eyebrow">League Player</p>
              <h1>{{ player()!.playerName }}</h1>
            </div>
            <div class="header-actions">
              <span class="status-pill" [class.absent]="player()!.absent">
                {{ player()!.absent ? 'Absent' : 'Active' }}
              </span>
              <button type="button" class="sign-out-btn" (click)="signOut()">
                Sign Out
              </button>
            </div>
          </header>

          <div class="stats-grid">
            <div class="stat-box">
              <span class="label">Points</span>
              <strong>{{ player()!.points }}</strong>
            </div>
            <div class="stat-box">
              <span class="label">Deck</span>
              <strong>{{ player()!.deckName }}</strong>
            </div>
            <div class="stat-box">
              <span class="label">Commander</span>
              <strong>{{ player()!.commander }}</strong>
            </div>
            <div class="stat-box">
              <span class="label">Discord</span>
              <strong>{{ player()!.discordUsername }}</strong>
            </div>
          </div>

          <div class="details-card">
            <h2>Player Details</h2>
            <div class="detail-list">
              <p><strong>Email:</strong> {{ player()!.email }}</p>
              <p><strong>Deck Name:</strong> {{ player()!.deckName }}</p>
              <p><strong>Commander:</strong> {{ player()!.commander }}</p>
              <p><strong>Joined:</strong> {{ formatDate(player()!.createdAt) }}</p>
            </div>
          </div>

          <div class="deck-card">
            <h2>Current Deck List</h2>
            @if (player()!.deckList && player()!.deckList!.length) {
              <ul class="deck-list">
                @for (card of player()!.deckList; track card; let index = $index) {
                  <li>
                    <span>{{ card }}</span>
                    <button type="button" class="swap-btn" (click)="selectCardToSwap(index)">
                      Swap
                    </button>
                  </li>
                }
              </ul>
            } @else {
              <p class="empty-state">No deck list available for this player yet.</p>
            }

            @if (selectedSwapIndex() !== null) {
              <div class="swap-form">
                <label for="replacement-card">Replace card {{ selectedSwapIndex()! + 1 }}</label>
                <div class="swap-controls">
                  <input
                    id="replacement-card"
                    type="text"
                    [(ngModel)]="replacementCard"
                    placeholder="Enter replacement card"
                  />
                  <button type="button" class="save-swap-btn" (click)="swapSelectedCard()">
                    Save Swap
                  </button>
                </div>
              </div>
            }

            @if (swapMessage()) {
              <p class="swap-message" [class.success]="swapSuccess()">{{ swapMessage() }}</p>
            }
          </div>
        </article>
      } @else {
        <div class="error-state">
          <h2>Player not found</h2>
          <p>We couldn’t load that player profile.</p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
      }

      .player-page-shell {
        max-width: 1100px;
        margin: 0 auto;
        padding: 2rem 1.25rem 3rem;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }

      .loading-state,
      .error-state {
        display: grid;
        place-items: center;
        min-height: 250px;
        padding: 2rem;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        text-align: center;
      }

      .spinner {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 4px solid #e2e8f0;
        border-top-color: #2563eb;
        animation: spin 0.8s linear infinite;
        margin-bottom: 1rem;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .player-card {
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        border-radius: 20px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
        border: 1px solid rgba(148, 163, 184, 0.18);
        padding: 2rem;
      }

      .player-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #e2e8f0;
      }

      .eyebrow {
        margin: 0 0 0.35rem;
        color: #64748b;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 700;
      }

      h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3rem);
        color: #0f172a;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.55rem 1rem;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        box-shadow: 0 8px 18px rgba(34, 197, 94, 0.25);
      }

      .status-pill.absent {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        box-shadow: 0 8px 18px rgba(239, 68, 68, 0.22);
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .sign-out-btn {
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: white;
        color: #334155;
        padding: 0.55rem 0.85rem;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 0.15s ease, border-color 0.15s ease;
      }

      .sign-out-btn:hover {
        background: #f1f5f9;
        border-color: #94a3b8;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .stat-box {
        background: linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%);
        border: 1px solid rgba(37, 99, 235, 0.08);
        border-radius: 16px;
        padding: 1rem 1.1rem;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
      }

      .label {
        display: block;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #475569;
        margin-bottom: 0.5rem;
      }

      .stat-box strong {
        color: #0f172a;
        font-size: 1.1rem;
        line-height: 1.5;
      }

      .details-card,
      .deck-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 1.25rem 1.4rem;
        margin-top: 1rem;
      }

      .details-card h2,
      .deck-card h2 {
        margin: 0 0 1rem;
        font-size: 1.2rem;
        color: #0f172a;
      }

      .detail-list {
        display: grid;
        gap: 0.5rem;
      }

      .detail-list p {
        margin: 0;
        color: #334155;
      }

      .deck-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.5rem 1rem;
      }

      .deck-list li {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.7rem 0.8rem;
        color: #1e293b;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .swap-btn,
      .save-swap-btn {
        border: none;
        border-radius: 999px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: white;
        padding: 0.5rem 0.8rem;
        font-weight: 700;
        cursor: pointer;
        transition:
          transform 0.15s ease,
          box-shadow 0.2s ease;
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.25);
      }

      .swap-btn:hover,
      .save-swap-btn:hover {
        transform: translateY(-1px);
      }

      .swap-form {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e2e8f0;
      }

      .swap-form label {
        display: block;
        font-weight: 700;
        color: #334155;
        margin-bottom: 0.5rem;
      }

      .swap-controls {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .swap-controls input {
        flex: 1 1 220px;
        min-height: 42px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 0.7rem 0.9rem;
        font-size: 1rem;
      }

      .swap-message {
        margin-top: 0.9rem;
        font-weight: 600;
        color: #b91c1c;
      }

      .swap-message.success {
        color: #166534;
      }

      .empty-state {
        margin: 0;
        color: #64748b;
      }

      @media (max-width: 640px) {
        .player-card {
          padding: 1.25rem;
        }

        .player-header {
          flex-direction: column;
          align-items: flex-start;
        }

        .header-actions {
          width: 100%;
          justify-content: space-between;
        }
      }
    `,
  ],
})
export class PlayerPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly player = signal<PlayerProfile | null>(null);
  readonly isLoading = signal(true);
  readonly selectedSwapIndex = signal<number | null>(null);
  readonly swapMessage = signal('');
  readonly swapSuccess = signal(false);
  replacementCard = '';

  ngOnInit(): void {
    const playerId = this.route.snapshot.paramMap.get('id');
    if (!playerId) {
      this.isLoading.set(false);
      return;
    }

    this.http.get<PlayerProfile>(`/api/player/${playerId}`).subscribe({
      next: (profile) => {
        this.player.set(profile);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to load player profile:', error);
        this.player.set(null);
        this.isLoading.set(false);
      },
    });
  }

  signOut(): void {
    void this.router.navigate(['/player-login']);
  }

  selectCardToSwap(index: number): void {
    this.selectedSwapIndex.set(index);
    this.swapMessage.set('');
    this.swapSuccess.set(false);
    this.replacementCard = '';
  }

  swapSelectedCard(): void {
    const player = this.player();
    const selectedIndex = this.selectedSwapIndex();
    const cardName = this.replacementCard.trim();

    if (!player || selectedIndex === null || selectedIndex < 0 || !cardName) {
      this.swapMessage.set('Choose a card and enter a replacement name before saving.');
      this.swapSuccess.set(false);
      return;
    }

    const request: DeckSwapRequest = {
      cardIndex: selectedIndex,
      replacementCard: cardName,
    };

    this.http.patch<PlayerProfile>(`/api/player/${player.id}/deck`, request).subscribe({
      next: (updatedPlayer) => {
        this.player.set(updatedPlayer);
        this.selectedSwapIndex.set(null);
        this.replacementCard = '';
        this.swapMessage.set('Deck updated successfully.');
        this.swapSuccess.set(true);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to swap card:', error);
        this.swapMessage.set(error.error?.error || 'Unable to update your deck right now.');
        this.swapSuccess.set(false);
      },
    });
  }

  formatDate(dateString: string): string {
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) {
      return 'Unknown';
    }

    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
