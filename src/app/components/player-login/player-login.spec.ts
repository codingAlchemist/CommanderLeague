import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { PlayerLogin } from './player-login';

describe('PlayerLogin', () => {
  let component: PlayerLogin;
  let fixture: ComponentFixture<PlayerLogin>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerLogin, HttpClientTestingModule, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerLogin);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('signs a player in with an email or Discord identifier', async () => {
    component.loginForm.controls.identifier.setValue('jane@example.com');

    await component.onSubmit();

    const req = httpMock.expectOne('/api/player/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ identifier: 'jane@example.com' });

    req.flush({
      id: '1',
      playerName: 'Jane',
      email: 'jane@example.com',
      discordUsername: 'Jane#1234',
      deckName: 'Elven Empire',
      commander: 'Lathril, Blade of the Elves',
      points: 0,
      createdAt: '2026-07-28T00:00:00.000Z',
    });

    fixture.detectChanges();

    expect(component.currentPlayer()?.playerName).toBe('Jane');
    expect(fixture.nativeElement.textContent).toContain('Welcome back, Jane!');
  });
});
