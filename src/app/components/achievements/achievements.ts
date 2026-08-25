import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

import { AchievementNotificationService } from '../../services/achievement-notification.service';

interface Achievement {
  id: string;
  title: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  category: string;
  points: number;
  createdAt?: string;
}

@Component({
  selector: 'app-achievements',
  imports: [CommonModule, MatButtonModule, MatCardModule, MatChipsModule],
  templateUrl: './achievements.html',
  styleUrl: './achievements.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Achievements implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(AchievementNotificationService);

  achievements: Achievement[] = [];
  isLoading = false;
  error = '';
  readonly isComingSoonDialogOpen = signal(false);

  openComingSoonDialog(): void {
    this.isComingSoonDialogOpen.set(true);
  }

  closeComingSoonDialog(): void {
    this.isComingSoonDialogOpen.set(false);
  }

  ngOnInit(): void {
    this.notificationService.observeAchievementsChanged().subscribe(() => {
      this.loadAchievements();
    });

    this.loadAchievements();
  }

  loadAchievements(): void {
    this.isLoading = true;
    this.error = '';
    console.log('Loading achievements...');

    this.http.get<Achievement[]>('/api/achievements').subscribe({
      next: (data) => {
        this.achievements = Array.isArray(data) ? data : [];
        this.isLoading = false;
        console.log('Achievements loaded:', this.achievements.length);
      },
      error: (error: unknown) => {
        console.error('Failed to load achievements:', error);
        this.isLoading = false;

        if (error instanceof HttpErrorResponse) {
          this.error = `Unable to load achievements (${error.status}).`;
        } else {
          this.error = 'Unable to load achievements right now.';
        }
      },
    });
  }

  getRarityClass(rarity: string): string {
    return `rarity-${(rarity || 'common').toLowerCase()}`;
  }
}
