import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AchievementNotificationService {
  private readonly achievementsChangedSubject = new Subject<void>();

  notifyAchievementsChanged(): void {
    this.achievementsChangedSubject.next();
  }

  observeAchievementsChanged(): Observable<void> {
    return this.achievementsChangedSubject.asObservable();
  }
}
