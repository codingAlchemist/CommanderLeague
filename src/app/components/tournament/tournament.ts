import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

interface Player {
  id: string;
  playerName: string;
  email: string;
  discordUsername: string;
  deckName: string;
  commander: string;
  points: number;
  createdAt: string;
}

interface PlayerGroup {
  groupNumber: number;
  players: Player[];
}

@Component({
  selector: 'app-tournament',
  imports: [CommonModule],
  templateUrl: './tournament.html',
  styleUrl: './tournament.scss',
})
export class Tournament implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  
  players: Player[] = [];
  groups: PlayerGroup[] = [];
  groupWinners = new Map<number, Player>(); // Track winner per group
  winnersGroup: PlayerGroup | null = null;
  winnersPodWinnerId: string | null = null;
  allSignups: Player[] = [];
  showSignups = false;
  isLoading = false;
  isLoadingSignups = false;
  errorMessage = '';
  readonly minWinnersBracketSize = 3;
  readonly maxWinnersBracketSize = 4;

  ngOnInit() {
    this.loadRandomPlayers();
  }

  loadRandomPlayers() {
    this.isLoading = true;
    this.errorMessage = '';
    console.log('Loading started, isLoading:', this.isLoading);
    
    this.http.get<Player[]>('/api/groups/random').subscribe({
      next: (players) => {
        console.log('Received players:', players);
        this.players = players;
        this.createGroups();
        this.isLoading = false;
        this.cdr.detectChanges();
        console.log('Loading complete, isLoading:', this.isLoading);
      },
      error: (error) => {
        console.error('Failed to load players:', error);
        this.errorMessage = 'Failed to load tournament players';
        this.isLoading = false;
        this.cdr.detectChanges();
        console.log('Error occurred, isLoading:', this.isLoading);
      }
    });
  }

  createGroups() {
    this.groups = [];
    const totalPlayers = this.players.length;

    if (totalPlayers === 0) {
      return;
    }

    const minGroupSize = this.minWinnersBracketSize;
    const maxGroupSize = this.maxWinnersBracketSize;
    const minGroups = Math.ceil(totalPlayers / maxGroupSize);
    const maxGroups = Math.floor(totalPlayers / minGroupSize);

    // Strictly enforce 3-4 players per group for tournament pods.
    if (minGroups > maxGroups) {
      this.errorMessage = `Cannot create groups with ${minGroupSize}-${maxGroupSize} players each from ${totalPlayers} players.`;
      return;
    }

    this.errorMessage = '';

    const groupCount = minGroups;
    const baseSize = Math.floor(totalPlayers / groupCount);
    const groupsWithExtraPlayer = totalPlayers % groupCount;

    let startIndex = 0;
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      const currentGroupSize = baseSize + (groupIndex < groupsWithExtraPlayer ? 1 : 0);
      const groupPlayers = this.players.slice(startIndex, startIndex + currentGroupSize);

      this.groups.push({
        groupNumber: groupIndex + 1,
        players: groupPlayers
      });

      startIndex += currentGroupSize;
    }
  }

  shuffleGroups() {
    // Clear winners and winners group when shuffling
    this.groupWinners.clear();
    this.winnersGroup = null;
    this.winnersPodWinnerId = null;
    this.loadRandomPlayers();
  }

  selectWinner(player: Player, groupNumber: number) {
    const originalWinner = this.groupWinners.get(groupNumber) ?? null;
    const isCurrentWinner = originalWinner?.id === player.id;
    const groupHasWinner = !!originalWinner;

    // Only allow creating new winners while there is room in the bracket.
    if (!isCurrentWinner && !groupHasWinner && this.groupWinners.size >= this.maxWinnersBracketSize) {
      this.errorMessage = `Winners bracket can only have ${this.maxWinnersBracketSize} players.`;
      return;
    }

    this.errorMessage = '';

    const originalPointsByPlayerId = new Map<string, number>();
    originalPointsByPlayerId.set(player.id, player.points);
    if (originalWinner) {
      originalPointsByPlayerId.set(originalWinner.id, originalWinner.points);
    }
    
    if (isCurrentWinner) {
      // Unselecting winner removes the winner point for this game.
      player.points = Math.max(0, player.points - 1);
      this.groupWinners.delete(groupNumber);
    } else {
      // If a different winner was selected for this game, remove their winner point.
      if (originalWinner && originalWinner.id !== player.id) {
        originalWinner.points = Math.max(0, originalWinner.points - 1);
      }

      // Assign at most one winner point for this game.
      player.points += 1;
      this.groupWinners.set(groupNumber, player);
    }
    
    this.updateWinnersGroup();

    const pointUpdates: Array<{ id: string; points: number }> = [{ id: player.id, points: player.points }];
    if (originalWinner && originalWinner.id !== player.id) {
      pointUpdates.push({ id: originalWinner.id, points: originalWinner.points });
    }
    
    forkJoin(
      pointUpdates.map(update =>
        this.http.patch(`/api/signups/${update.id}/points`, { points: update.points })
      )
    ).subscribe({
        next: () => {
          console.log('Updated winner points for group', groupNumber);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Failed to update points:', error);

          for (const [playerId, originalPoints] of originalPointsByPlayerId.entries()) {
            const affectedPlayer = this.players.find(currentPlayer => currentPlayer.id === playerId);
            if (affectedPlayer) {
              affectedPlayer.points = originalPoints;
            }
          }

          if (originalWinner) {
            this.groupWinners.set(groupNumber, originalWinner);
          } else {
            this.groupWinners.delete(groupNumber);
          }

          this.updateWinnersGroup();
          this.cdr.detectChanges();
        }
      });
  }

  updateWinnersGroup() {
    const winners = Array.from(this.groupWinners.entries())
      .sort(([groupA], [groupB]) => groupA - groupB)
      .map(([, winner]) => winner)
      .slice(0, this.maxWinnersBracketSize);
    
    if (winners.length >= this.minWinnersBracketSize) {
      this.winnersGroup = {
        groupNumber: 0, // Special number for winners group
        players: winners
      };
    } else {
      this.winnersGroup = null;
    }

    if (!this.winnersGroup || !this.winnersGroup.players.some(player => player.id === this.winnersPodWinnerId)) {
      this.winnersPodWinnerId = null;
    }
  }

  isWinner(player: Player, groupNumber: number): boolean {
    return this.groupWinners.get(groupNumber)?.id === player.id;
  }

  selectWinnersPodWinner(player: Player) {
    this.winnersPodWinnerId = this.winnersPodWinnerId === player.id ? null : player.id;
  }

  isWinnersPodWinner(player: Player): boolean {
    return this.winnersPodWinnerId === player.id;
  }

  toggleSignups() {
    this.showSignups = !this.showSignups;
    if (this.showSignups && this.allSignups.length === 0) {
      this.loadAllSignups();
    }
  }

  loadAllSignups() {
    this.isLoadingSignups = true;
    
    this.http.get<Player[]>('/api/signups').subscribe({
      next: (signups) => {
        this.allSignups = signups.sort((a, b) => b.points - a.points);
        this.isLoadingSignups = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to load signups:', error);
        this.isLoadingSignups = false;
        this.cdr.detectChanges();
      }
    });
  }
}
