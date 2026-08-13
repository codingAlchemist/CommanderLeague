import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

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
  selector: 'app-achievement-edit',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    RouterLink,
  ],
  templateUrl: './achievement-edit.html',
  styleUrl: './achievement-edit.scss',
})
export class AchievementEdit implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  achievementId = '';
  isSubmitting = false;
  isLoading = true;
  error = '';

  achievementForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    rarity: new FormControl<'common' | 'uncommon' | 'rare' | 'epic'>('common', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    points: new FormControl(5, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
  });

  async ngOnInit(): Promise<void> {
    this.achievementId = this.route.snapshot.paramMap.get('id') ?? '';

    if (!this.achievementId) {
      this.error = 'Achievement not found.';
      this.isLoading = false;
      return;
    }

    const routeStateAchievement = history.state?.achievement as Achievement | undefined;

    if (routeStateAchievement && routeStateAchievement.id === this.achievementId) {
      this.applyAchievementToForm(routeStateAchievement);
      this.isLoading = false;
      return;
    }

    try {
      const achievements = await firstValueFrom(this.http.get<Achievement[]>('/api/achievements'));
      const list = Array.isArray(achievements) ? achievements : [];
      const matchingAchievement = list.find((item) => item.id === this.achievementId) ?? null;

      if (!matchingAchievement) {
        this.error = 'Achievement not found.';
        this.isLoading = false;
        return;
      }

      this.applyAchievementToForm(matchingAchievement);
    } catch (error) {
      console.error('Failed to load achievement for editing:', error);
      this.error = 'Could not load this achievement.';
    } finally {
      this.isLoading = false;
    }
  }

  private applyAchievementToForm(achievement: Achievement): void {
    this.achievementForm.patchValue({
      title: achievement.title,
      description: achievement.description,
      category: achievement.category,
      rarity: achievement.rarity,
      points: achievement.points,
    });
  }

  async save(): Promise<void> {
    if (this.achievementForm.invalid) {
      this.achievementForm.markAllAsTouched();
      this.error = 'Please complete the required fields.';
      return;
    }

    this.isSubmitting = true;
    this.error = '';

    const payload = {
      title: this.achievementForm.value.title?.trim(),
      description: this.achievementForm.value.description?.trim(),
      category: this.achievementForm.value.category?.trim(),
      rarity: this.achievementForm.value.rarity,
      points: Number(this.achievementForm.value.points),
    };

    try {
      await firstValueFrom(
        this.http.patch<Achievement>(`/api/achievements/${this.achievementId}`, payload),
      );
      void this.router.navigate(['/achievements']);
    } catch (error) {
      console.error('Failed to update achievement:', error);
      if (error instanceof HttpErrorResponse) {
        this.error = error.error?.error || 'Unable to update achievement.';
      } else {
        this.error = 'Unable to update achievement.';
      }
    } finally {
      this.isSubmitting = false;
    }
  }
}
