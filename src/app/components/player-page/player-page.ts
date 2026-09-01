import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

interface PlayerProfile {
  id: string;
  playerName: string;
  email: string;
  discordUsername: string;
  deckName: string;
  commander: string;
  points: number;
  absent: boolean;
  createdAt: string;
  deckList?: string[];
}

interface DeckSwapRequest {
  cardIndex: number;
  replacementCard: string;
  replacementCardType: string;
}

interface PlayerDeck {
  name: string;
  cards: string[];
  commander: string;
  cardTypes?: Record<string, string>;
}

interface DeckCard {
  name: string;
  index: number;
  type: string;
}

interface ScryfallCard {
  name: string;
  type_line?: string;
}

interface ScryfallCollectionResponse {
  data: ScryfallCard[];
}

@Component({
  selector: 'app-player-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './player-page.html',
  styleUrl: './player-page.scss',
})
export class PlayerPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly player = signal<PlayerProfile | null>(null);
  readonly isLoading = signal(true);
  readonly selectedSwapIndex = signal<number | null>(null);
  readonly swapMessage = signal('');
  readonly swapSuccess = signal(false);
  readonly cardTypes = signal<Record<string, string>>({});
  replacementCard = '';
  replacementCardType = '';

  readonly groupedDeckList = computed(() => {
    const cards = this.player()?.deckList ?? [];
    const groups = new Map<string, DeckCard[]>();

    cards.forEach((name, index) => {
      const type = this.cardTypes()[name] ?? 'Other';
      const group = groups.get(type) ?? [];
      group.push({ name, index, type });
      groups.set(type, group);
    });

    return [...groups.entries()]
      .sort(
        ([firstType], [secondType]) =>
          this.cardTypeOrder(firstType) - this.cardTypeOrder(secondType),
      )
      .map(([type, groupCards]) => ({ type, cards: groupCards }));
  });

  ngOnInit(): void {
    const playerId = this.route.snapshot.paramMap.get('id');
    if (!playerId) {
      this.isLoading.set(false);
      return;
    }

    this.http.get<PlayerProfile>(`/api/player/${playerId}`).subscribe({
      next: (profile) => {
        this.http
          .get<PlayerDeck>(`/api/decks/player/${encodeURIComponent(profile.playerName)}`)
          .subscribe({
            next: (deck) => {
              this.player.set({ ...profile, deckList: deck.cards });
              this.cardTypes.set(deck.cardTypes ?? {});
              this.loadCardTypes(deck.cards);
              this.isLoading.set(false);
            },
            error: (error: HttpErrorResponse) => {
              console.error('Failed to load player deck:', error);
              this.player.set(profile);
              this.isLoading.set(false);
            },
          });
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to load player profile:', error);
        this.player.set(null);
        this.isLoading.set(false);
      },
    });
  }

  signOut(): void {
    void this.router.navigate(['/player-login']);
  }

  private loadCardTypes(cardNames: string[]): void {
    const nextTypes: Record<string, string> = {};

    for (let start = 0; start < cardNames.length; start += 75) {
      const identifiers = cardNames.slice(start, start + 75).map((name) => ({ name }));
      this.http
        .post<ScryfallCollectionResponse>('https://api.scryfall.com/cards/collection', {
          identifiers,
        })
        .subscribe({
          next: (response) => {
            response.data.forEach((card) => {
              nextTypes[card.name] = this.cardTypeFromLine(card.type_line);
            });
            this.cardTypes.update(() => ({ ...nextTypes }));
          },
          error: (error: HttpErrorResponse) => {
            console.error('Failed to load card types:', error);
          },
        });
    }
  }

  private cardTypeFromLine(typeLine: string | undefined): string {
    const typeOrder = [
      'Creature',
      'Instant',
      'Sorcery',
      'Artifact',
      'Enchantment',
      'Planeswalker',
      'Battle',
      'Land',
    ];
    return typeOrder.find((type) => typeLine?.includes(type)) ?? 'Other';
  }

  private cardTypeOrder(type: string): number {
    return [
      'Creature',
      'Instant',
      'Sorcery',
      'Artifact',
      'Enchantment',
      'Planeswalker',
      'Battle',
      'Land',
      'Other',
    ].indexOf(type);
  }

  selectCardToSwap(index: number): void {
    this.selectedSwapIndex.set(index);
    this.swapMessage.set('');
    this.swapSuccess.set(false);
    this.replacementCard = '';
    this.replacementCardType = '';
  }

  swapSelectedCard(): void {
    const player = this.player();
    const selectedIndex = this.selectedSwapIndex();
    const cardName = this.replacementCard.trim();
    const cardType = this.replacementCardType.trim();

    if (!player || selectedIndex === null || selectedIndex < 0 || !cardName || !cardType) {
      this.swapMessage.set('Choose a card, enter a replacement name, and select its type before saving.');
      this.swapSuccess.set(false);
      return;
    }

    const request: DeckSwapRequest = {
      cardIndex: selectedIndex,
      replacementCard: cardName,
      replacementCardType: cardType,
    };

    this.http.patch<PlayerProfile>(`/api/player/${player.id}/deck`, request).subscribe({
      next: (updatedPlayer) => {
        this.player.set(updatedPlayer);
        this.cardTypes.update((types) => ({ ...types, [cardName]: cardType }));
        this.selectedSwapIndex.set(null);
        this.replacementCard = '';
        this.replacementCardType = '';
        this.swapMessage.set('Deck updated successfully.');
        this.swapSuccess.set(true);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to swap card:', error);
        this.swapMessage.set(error.error?.error || 'Unable to update your deck right now.');
        this.swapSuccess.set(false);
      },
    });
  }

  formatDate(dateString: string): string {
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) {
      return 'Unknown';
    }

    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
