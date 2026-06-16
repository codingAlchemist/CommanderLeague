import { Component, inject, OnInit, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

interface Player {
  id: string;
  playerName?: string;
  email?: string;
  deckName?: string;
  commander?: string;
  points?: number;
  createdAt?: string;
}

@Component({
  selector: 'app-current-player-rankings',
  imports: [CommonModule],
  templateUrl: './current-player-rankings.html',
  styleUrl: './current-player-rankings.scss',
})
export class CurrentPlayerRankings implements OnInit {
  private http = inject(HttpClient);

  // Parent can pass a pre-fetched list. If null, this component will fetch itself.
  @Input() players: Player[] | null = null;

  private internalPlayers: Player[] = [];
  isLoading = false;
  error = '';

  ngOnInit() {
    // Only auto-load if parent did not provide players
    if (this.players === null) {
      this.loadPlayers();
    }
  }

  get displayedPlayers(): Player[] {
    return this.players !== null ? this.players : this.internalPlayers;
  }

  loadPlayers() {
    this.isLoading = true;
    this.error = '';

    // Use the ranked endpoint to get players already sorted by points
    this.http.get<Player[]>('/api/signups/ranked').subscribe({
      next: (data) => {
        this.internalPlayers = data?.slice() || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load player rankings:', err);
        this.error = 'Failed to load player rankings';
        this.isLoading = false;
      },
    });
  }
}
