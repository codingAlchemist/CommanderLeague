import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatChipsModule],
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
  readonly editingAchievement = signal<Achievement | null>(null);
  isSaving = false;
  saveError = '';
  editForm = this.createEmptyForm();

  openEditDialog(achievement: Achievement): void {
    this.editForm = {
      title: achievement.title,
      description: achievement.description,
      rarity: achievement.rarity,
      category: achievement.category,
    };
    this.saveError = '';
    this.editingAchievement.set(achievement);
  }

  closeEditDialog(): void {
    if (!this.isSaving) {
      this.editingAchievement.set(null);
    }
  }

  saveAchievement(): void {
    const achievement = this.editingAchievement();
    if (!achievement || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.saveError = '';
    this.http.patch<Achievement>(`/api/achievements/${achievement.id}`, this.editForm).subscribe({
      next: (updatedAchievement) => {
        this.achievements = this.achievements.map((item) =>
          item.id === updatedAchievement.id ? updatedAchievement : item,
        );
        this.isSaving = false;
        this.editingAchievement.set(null);
      },
      error: (error: unknown) => {
        console.error('Failed to update achievement:', error);
        this.isSaving = false;
        this.saveError =
          error instanceof HttpErrorResponse
            ? `Unable to save achievement (${error.status}).`
            : 'Unable to save achievement right now.';
      },
    });
  }

  private createEmptyForm(): Omit<Achievement, 'id' | 'points' | 'createdAt'> {
    return {
      title: '',
      description: '',
      rarity: 'common',
      category: '',
    };
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
