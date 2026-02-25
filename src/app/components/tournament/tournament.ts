import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

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
  allSignups: Player[] = [];
  showSignups = false;
  isLoading = false;
  isLoadingSignups = false;
  errorMessage = '';

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
    for (let i = 0; i < this.players.length; i += 4) {
      this.groups.push({
        groupNumber: Math.floor(i / 4) + 1,
        players: this.players.slice(i, i + 4)
      });
    }
  }

  shuffleGroups() {
    // Clear winners and winners group when shuffling
    this.groupWinners.clear();
    this.winnersGroup = null;
    this.loadRandomPlayers();
  }

  selectWinner(player: Player, groupNumber: number) {
    // Check if this player is already the winner
    const isCurrentWinner = this.groupWinners.get(groupNumber)?.id === player.id;
    
    if (isCurrentWinner) {
      // Remove winner status and deduct a point
      player.points -= 1;
      this.groupWinners.delete(groupNumber);
    } else {
      // Add 1 point to the new winner
      player.points += 1;
      // Track this player as the winner of their group
      this.groupWinners.set(groupNumber, player);
    }
    
    // Update winners group
    this.updateWinnersGroup();
    
    // Update on the server
    this.http.patch(`/api/signups/${player.id}/points`, { points: player.points })
      .subscribe({
        next: () => {
          console.log(`Updated points for ${player.playerName} to ${player.points}`);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Failed to update points:', error);
          // Rollback on error
          if (isCurrentWinner) {
            player.points += 1;
            this.groupWinners.set(groupNumber, player);
          } else {
            player.points -= 1;
            this.groupWinners.delete(groupNumber);
          }
          this.updateWinnersGroup();
          this.cdr.detectChanges();
        }
      });
  }

  updateWinnersGroup() {
    const winners = Array.from(this.groupWinners.values());
    
    if (winners.length >= 4) {
      this.winnersGroup = {
        groupNumber: 0, // Special number for winners group
        players: winners
      };
    } else {
      this.winnersGroup = null;
    }
  }

  isWinner(player: Player, groupNumber: number): boolean {
    return this.groupWinners.get(groupNumber)?.id === player.id;
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
