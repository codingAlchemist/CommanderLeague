import { Component, inject, OnInit, Input } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
  private static cachedPlayers: Player[] | null = null;
  private static cacheTimestamp = 0;

  private http = inject(HttpClient);
  private readonly rankingsEndpoint = '/api/signups/ranked';
  private readonly rankingsCacheTtlMs = 60_000;

  // Parent can pass a pre-fetched list. If null, this component will fetch itself.
  @Input() players: Player[] | null = null;

  private internalPlayers: Player[] = [];
  isLoading = false;
  error = '';
  errorStatus: number | null = null;
  errorStatusText = '';
  errorEndpoint = '';

  ngOnInit() {
    // Only auto-load if parent did not provide players
    if (this.players === null) {
      this.loadPlayers();
    }
  }

  get displayedPlayers(): Player[] {
    return this.players !== null ? this.players : this.internalPlayers;
  }

  loadPlayers(forceRefresh = false) {
    const hasFreshCache =
      !forceRefresh &&
      CurrentPlayerRankings.cachedPlayers !== null &&
      Date.now() - CurrentPlayerRankings.cacheTimestamp < this.rankingsCacheTtlMs;

    // Render cached rankings instantly, then refresh in the background.
    if (hasFreshCache) {
      this.internalPlayers = CurrentPlayerRankings.cachedPlayers!.slice();
      this.isLoading = false;
    } else {
      this.isLoading = true;
    }

    this.error = '';
    this.errorStatus = null;
    this.errorStatusText = '';
    this.errorEndpoint = '';

    // Use the ranked endpoint to get players already sorted by points
    this.http.get<Player[]>(this.rankingsEndpoint).subscribe({
      next: (data) => {
        this.internalPlayers = data?.slice() || [];
        CurrentPlayerRankings.cachedPlayers = this.internalPlayers.slice();
        CurrentPlayerRankings.cacheTimestamp = Date.now();
        this.isLoading = false;
      },
      error: (err: unknown) => {
        console.error('Failed to load player rankings:', err);

        if (err instanceof HttpErrorResponse) {
          this.error = 'Failed to load player rankings from the server.';
          this.errorStatus = err.status;
          this.errorStatusText = err.statusText || 'Unknown Error';
          this.errorEndpoint = this.rankingsEndpoint;
        } else {
          this.error = 'Failed to load player rankings due to an unexpected error.';
          this.errorEndpoint = this.rankingsEndpoint;
        }

        this.isLoading = false;
      },
    });
  }
}
