import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { CurrentPlayerRankings } from '../current-player-rankings/current-player-rankings';

interface Player {
  id: string;
  playerName: string;
  email: string;
  discordUsername: string;
  deckName: string;
  commander: string;
  points: number;
  absent: boolean;
  createdAt: string;
}

interface PlayerGroup {
  groupNumber: number;
  players: Player[];
  winnerId?: string | null;
}

interface WeekState {
  currentWeek: number | null;
  startedWeeks: number[];
  totalWeeks: number;
  updatedAt: string;
}

@Component({
  selector: 'app-tournament',
  imports: [CommonModule, CurrentPlayerRankings],
  templateUrl: './tournament.html',
  styleUrl: './tournament.scss',
})
export class Tournament implements OnInit, OnDestroy {
  private eventSource: EventSource | null = null;
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  players: Player[] = [];
  groups: PlayerGroup[] = [];
  groupWinners = new Map<number, Player>(); // Track winner per group
  winnersGroup: PlayerGroup | null = null;
  winnersPodWinnerId: string | null = null;
  isWinnersBracketEnabled = false;
  selectedWeek: number | null = null;
  allSignups: Player[] = [];
  showSignups = false;
  showRankings = false;
  isLoading = false;
  isLoadingSignups = false;
  isLoadingWeekState = false;
  isStartingWeek = false;
  isResettingWeeks = false;
  isAdjustingWeeks = false;
  errorMessage = '';
  readonly minWinnersBracketSize = 3;
  readonly maxWinnersBracketSize = 4;
  readonly minTotalWeeks = 1;
  readonly maxTotalWeeks = 10;
  weeks: number[] = [1, 2, 3, 4, 5, 6, 7, 8];
  weekState: WeekState = {
    currentWeek: null,
    startedWeeks: [],
    totalWeeks: 8,
    updatedAt: '',
  };

  ngOnInit() {
    this.setupEventSource();
    this.loadWeekState();
  }

  ngOnDestroy(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private setupEventSource(): void {
    try {
      this.eventSource = new EventSource('/api/events');

      this.eventSource.addEventListener('pods-reshuffled', (ev: any) => {
        try {
          const data = JSON.parse(ev.data);
          const week = data?.week;
          console.log('Received pods-reshuffled for week', week);
          if (week && this.weekState.currentWeek === week) {
            this.loadPodsForWeek(week);
          }
        } catch (err) {
          console.error('Failed to parse pods-reshuffled event', err);
        }
      });

      this.eventSource.addEventListener('signups-updated', (ev: any) => {
        try {
          const payload = JSON.parse(ev.data);
          console.log('Received signups-updated', payload);
          if (this.showSignups) {
            this.loadAllSignups();
          }
          // Refresh groups for current week (pods-reshuffled event will also arrive)
          this.loadGroupsForSelectedWeek();
        } catch (err) {
          console.error('Failed to parse signups-updated event', err);
        }
      });

      this.eventSource.onerror = (err) => {
        console.warn('EventSource error', err);
      };
    } catch (err) {
      console.error('Failed to create EventSource', err);
    }
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
      },
    });
  }

  loadGroupsForSelectedWeek() {
    if (this.selectedWeek !== null) {
      this.loadPodsForWeek(this.selectedWeek);
    } else if (this.weekState.currentWeek !== null) {
      this.loadPodsForWeek(this.weekState.currentWeek);
    } else {
      this.groups = [];
      this.players = [];
    }
  }

  loadPodsForWeek(week: number) {
    this.isLoading = true;
    this.errorMessage = '';
    this.selectedWeek = week;

    this.http.get<any>(`/api/pods?week=${week}`).subscribe({
      next: (pod) => {
        if (!pod || !Array.isArray(pod.groups) || pod.groups.length === 0) {
          this.groups = [];
          this.players = [];
          this.groupWinners.clear();
          this.winnersGroup = null;
          this.winnersPodWinnerId = null;
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        this.groupWinners.clear();
        this.winnersPodWinnerId = null;
        this.groups = pod.groups.map((g: any) => ({
          groupNumber: g.groupNumber,
          players: g.players,
          winnerId: g.winnerId ?? null,
        }));

        this.players = this.groups.flatMap((g) => g.players);
        this.syncGroupWinnersFromLoadedGroups();

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to load pods for week:', error);
        this.errorMessage = 'Failed to load tournament pods for selected week';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
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
        players: groupPlayers,
      });

      startIndex += currentGroupSize;
    }
  }

  shuffleGroups() {
    // Clear winners and winners group when shuffling
    this.groupWinners.clear();
    this.winnersGroup = null;
    this.winnersPodWinnerId = null;
    // If a week is active, reshuffle pods for that week and reload; otherwise shuffle random players
    if (this.weekState.currentWeek !== null) {
      this.isLoading = true;
      this.http.post<any>('/api/pods/reshuffle', { week: this.weekState.currentWeek }).subscribe({
        next: (pod) => {
          this.loadPodsForWeek(this.weekState.currentWeek!);
        },
        error: (error) => {
          console.error('Failed to reshuffle pods:', error);
          // fall back to random players on error
          this.loadRandomPlayers();
        },
      });
    } else {
      this.loadRandomPlayers();
    }
  }

  selectWinner(player: Player, groupNumber: number) {
    if (player.absent) {
      this.errorMessage = 'Absent players cannot be selected as winners.';
      return;
    }

    const originalWinner = this.groupWinners.get(groupNumber) ?? null;
    const isCurrentWinner = originalWinner?.id === player.id;
    const groupHasWinner = !!originalWinner;

    // Only allow creating new winners while there is room in the bracket.
    if (
      !isCurrentWinner &&
      !groupHasWinner &&
      this.groupWinners.size >= this.maxWinnersBracketSize
    ) {
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

    const pointUpdates: Array<{ id: string; points: number }> = [
      { id: player.id, points: player.points },
    ];
    if (originalWinner && originalWinner.id !== player.id) {
      pointUpdates.push({ id: originalWinner.id, points: originalWinner.points });
    }

    forkJoin(
      pointUpdates.map((update) =>
        this.http.patch(`/api/signups/${update.id}/points`, { points: update.points }),
      ),
    ).subscribe({
      next: () => {
        console.log('Updated winner points for group', groupNumber);
        const winnerId = isCurrentWinner ? null : player.id;
        this.http
          .patch(`/api/pods/${this.selectedWeek}/groups/${groupNumber}/winner`, { winnerId })
          .subscribe({
            next: () => {
              this.cdr.detectChanges();
            },
            error: (error) => {
              console.error('Failed to persist pod winner:', error);
            },
          });
      },
      error: (error) => {
        console.error('Failed to update points:', error);

        for (const [playerId, originalPoints] of originalPointsByPlayerId.entries()) {
          const affectedPlayer = this.players.find(
            (currentPlayer) => currentPlayer.id === playerId,
          );
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
      },
    });
  }

  updateWinnersGroup() {
    if (!this.isWinnersBracketEnabled) {
      this.winnersGroup = null;
      this.winnersPodWinnerId = null;
      return;
    }

    const winners = Array.from(this.groupWinners.entries())
      .sort(([groupA], [groupB]) => groupA - groupB)
      .map(([, winner]) => winner)
      .slice(0, this.maxWinnersBracketSize);

    if (winners.length >= this.minWinnersBracketSize) {
      this.winnersGroup = {
        groupNumber: 0, // Special number for winners group
        players: winners,
      };
    } else {
      this.winnersGroup = null;
    }

    if (
      !this.winnersGroup ||
      !this.winnersGroup.players.some((player) => player.id === this.winnersPodWinnerId)
    ) {
      this.winnersPodWinnerId = null;
    }
  }

  private syncGroupWinnersFromLoadedGroups(): void {
    this.groupWinners.clear();
    for (const group of this.groups) {
      if (group.winnerId) {
        const player = group.players.find((p) => p.id === group.winnerId);
        if (player) {
          this.groupWinners.set(group.groupNumber, player);
        }
      }
    }

    this.updateWinnersGroup();
  }

  isWinner(player: Player, groupNumber: number): boolean {
    return this.groupWinners.get(groupNumber)?.id === player.id;
  }

  selectWinnersPodWinner(player: Player) {
    if (!this.isActiveWeekSelected()) {
      this.errorMessage = 'Cannot edit winners for a past week.';
      return;
    }

    if (player.absent) {
      this.errorMessage = 'Absent players cannot be selected as winners.';
      return;
    }

    this.winnersPodWinnerId = this.winnersPodWinnerId === player.id ? null : player.id;
  }

  isWinnersPodWinner(player: Player): boolean {
    return this.winnersPodWinnerId === player.id;
  }

  toggleAbsent(player: Player) {
    const newAbsentStatus = !player.absent;
    this.isLoadingSignups = true;
    this.errorMessage = '';

    this.http.patch<Player>(`/api/signups/${player.id}`, { absent: newAbsentStatus }).subscribe({
      next: (updatedPlayer) => {
        this.allSignups = this.allSignups.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p));
        if (this.weekState.currentWeek !== null) {
          this.loadGroupsForSelectedWeek();
        }
        this.isLoadingSignups = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to update absent status:', error);
        this.errorMessage = 'Failed to update absent status';
        this.isLoadingSignups = false;
        this.cdr.detectChanges();
      },
    });
  }

  toggleWinnersBracket(): void {
    this.isWinnersBracketEnabled = !this.isWinnersBracketEnabled;
    this.updateWinnersGroup();
  }

  get canCreateWinnersBracket(): boolean {
    return (
      this.groupWinners.size >= this.minWinnersBracketSize &&
      this.groupWinners.size <= this.maxWinnersBracketSize
    );
  }

  toggleSignups() {
    // ensure rankings view is cleared when showing signups
    this.showRankings = false;
    this.showSignups = !this.showSignups;
    if (this.showSignups && this.allSignups.length === 0) {
      this.loadAllSignups();
    }
  }

  toggleRankings() {
    // Show or hide the rankings view and clear signups view when activating rankings
    this.showSignups = false;
    this.showRankings = !this.showRankings;
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
      },
    });
  }

  dropPlayer(id: string) {
    const shouldDrop = confirm('Drop this player?');
    if (!shouldDrop) {
      return;
    }

    this.isLoadingSignups = true;

    this.http.delete(`/api/signups/${id}`).subscribe({
      next: () => {
        this.allSignups = this.allSignups.filter((p) => p.id !== id);
        this.isLoadingSignups = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to drop player:', error);
        this.errorMessage = 'Failed to drop player';
        this.isLoadingSignups = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadWeekState() {
    this.isLoadingWeekState = true;

    this.http.get<WeekState>('/api/week-state').subscribe({
      next: (state) => {
        this.weekState = state;
        this.refreshWeeks(state.totalWeeks);
        if (this.selectedWeek === null) {
          this.selectedWeek = state.currentWeek;
        }
        this.isLoadingWeekState = false;
        // Load pods for the selected or current week after obtaining week state
        this.loadGroupsForSelectedWeek();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to load week state:', error);
        this.errorMessage = 'Failed to load week progress';
        this.isLoadingWeekState = false;
        this.cdr.detectChanges();
      },
    });
  }

  resetWeeks() {
    if (this.isResettingWeeks) {
      return;
    }

    const shouldReset = confirm('Reset all weeks and clear started status?');
    if (!shouldReset) {
      return;
    }

    this.isResettingWeeks = true;
    this.http.post<WeekState>('/api/week-state/reset', {}).subscribe({
      next: (state) => {
        // After resetting on the server, reload the authoritative week state
        this.loadWeekState();
        this.isResettingWeeks = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to reset week state:', error);
        this.errorMessage = 'Failed to reset weeks';
        this.isResettingWeeks = false;
        this.cdr.detectChanges();
      },
    });
  }

  handleWeekAction(week: number) {
    if (this.isStartingWeek) {
      return;
    }

    const alreadyStarted = this.isWeekStarted(week);
    const isCurrent = this.weekState.currentWeek === week;
    const isViewingPastWeek = this.selectedWeek !== null && this.weekState.currentWeek !== null && this.selectedWeek !== this.weekState.currentWeek;

    if (isCurrent && isViewingPastWeek) {
      this.selectedWeek = week;
      this.loadGroupsForSelectedWeek();
      return;
    }

    if (isCurrent) {
      const shouldProceed = confirm(`End Week ${week}?`);
      if (!shouldProceed) {
        return;
      }

      this.isStartingWeek = true;
      const newStartedWeeks = [...this.weekState.startedWeeks];
      const newCurrentWeek = null;

      this.http
        .patch<WeekState>('/api/week-state', {
          currentWeek: newCurrentWeek,
          startedWeeks: newStartedWeeks,
        })
        .subscribe({
          next: (state) => {
            this.weekState = state;
            this.selectedWeek = week;
            this.isStartingWeek = false;
            this.loadGroupsForSelectedWeek();
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Failed to end week:', error);
            this.errorMessage = 'Failed to end week';
            this.isStartingWeek = false;
            this.cdr.detectChanges();
          },
        });

      return;
    }

    if (alreadyStarted) {
      this.selectedWeek = week;
      this.loadGroupsForSelectedWeek();
      return;
    }

    const shouldProceed = confirm(`Start Week ${week}?`);
    if (!shouldProceed) {
      return;
    }

    this.isStartingWeek = true;
    const newStartedWeeks = Array.from(new Set([...this.weekState.startedWeeks, week])).sort(
      (a, b) => a - b,
    );
    const newCurrentWeek = week;

    this.http
      .patch<WeekState>('/api/week-state', {
        currentWeek: newCurrentWeek,
        startedWeeks: newStartedWeeks,
      })
      .subscribe({
        next: (state) => {
          this.weekState = state;
          this.selectedWeek = week;
          this.isStartingWeek = false;
          this.loadGroupsForSelectedWeek();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Failed to start week:', error);
          this.errorMessage = 'Failed to start week';
          this.isStartingWeek = false;
          this.cdr.detectChanges();
        },
      });
  }

  adjustWeeks(delta: 1 | -1): void {
    if (this.isAdjustingWeeks) {
      return;
    }

    this.isAdjustingWeeks = true;

    this.http.patch<WeekState>('/api/week-state/total-weeks', { delta }).subscribe({
      next: (state) => {
        this.weekState = state;
        this.refreshWeeks(state.totalWeeks);
        this.isAdjustingWeeks = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to adjust total weeks:', error);
        this.errorMessage = 'Failed to update number of weeks';
        this.isAdjustingWeeks = false;
        this.cdr.detectChanges();
      },
    });
  }

  private refreshWeeks(totalWeeks: number): void {
    const clampedTotalWeeks = Math.max(
      this.minTotalWeeks,
      Math.min(this.maxTotalWeeks, Math.floor(totalWeeks)),
    );
    this.weeks = Array.from({ length: clampedTotalWeeks }, (_, index) => index + 1);
  }

  isWeekStarted(week: number): boolean {
    return this.weekState.startedWeeks.includes(week);
  }

  isWeekEnded(week: number): boolean {
    return this.isWeekStarted(week) && this.weekState.currentWeek !== week;
  }

  isActiveWeekSelected(): boolean {
    return this.selectedWeek !== null && this.weekState.currentWeek === this.selectedWeek;
  }
}
