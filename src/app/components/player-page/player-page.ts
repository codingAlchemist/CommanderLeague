import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

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
  deckList?: (string | DeckCardResponse)[];
}

interface DeckSwapRequest {
  cardIndex: number;
  replacementCard: string;
  replacementCardType: string;
}

interface CommanderSwapRequest {
  replacementCommander: string;
  replacementCommanderType: string;
}

interface PlayerDeck {
  name: string;
  cards: DeckCardData[];
  commander: string;
  swaps?: CardSwap[];
}

interface DeckCardData {
  name: string;
  type: string;
}

interface DeckCardResponse {
  name: string;
  type: string;
  commander: boolean;
}

interface CardSwap {
  card: string;
  cardType: string;
  date: string;
  week: number | null;
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

interface ScryfallAutocompleteResponse {
  data: string[];
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

  @ViewChild('replacementCardInput') replacementCardInput?: ElementRef<HTMLInputElement>;

  readonly player = signal<PlayerProfile | null>(null);
  readonly isLoading = signal(true);
  readonly selectedSwapIndex = signal<number | null>(null);
  readonly swapMessage = signal('');
  readonly swapSuccess = signal(false);
  readonly cardTypes = signal<Record<string, string>>({});
  readonly cardSuggestions = signal<string[]>([]);
  readonly swaps = signal<CardSwap[]>([]);
  readonly isSwapHistoryOpen = signal(false);
  readonly isCommanderSwap = signal(false);
  private readonly cardSearch = new Subject<string>();
  replacementCard = '';
  replacementCardType = '';

  readonly groupedDeckList = computed(() => {
    const cards = this.player()?.deckList ?? [];
    const groups = new Map<string, DeckCard[]>();

    cards.forEach((card, index) => {
      const name = typeof card === 'string' ? card : card.name;
      const type = typeof card === 'string' ? (this.cardTypes()[name] ?? 'Other') : card.type;
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
    this.cardSearch
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) =>
          this.http.get<ScryfallAutocompleteResponse>('/api/scryfall/autocomplete', {
            params: { q: query },
          }),
        ),
      )
      .subscribe({
        next: (response) => this.cardSuggestions.set(response.data),
        error: (error: HttpErrorResponse) => {
          console.error('Failed to load card suggestions:', error);
          this.cardSuggestions.set([]);
        },
      });

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
              this.player.set({ ...profile, deckList: deck.cards.map((card) => card.name) });
              this.cardTypes.set(
                Object.fromEntries(deck.cards.map((card) => [card.name, card.type])),
              );
              this.swaps.set(deck.swaps ?? []);
              this.loadCardTypes(deck.cards.map((card) => card.name));
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

  openSwapHistory(): void {
    this.isSwapHistoryOpen.set(true);
  }

  closeSwapHistory(): void {
    this.isSwapHistoryOpen.set(false);
  }

  formatSwapDate(dateString: string): string {
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
    this.isCommanderSwap.set(false);
    this.selectedSwapIndex.set(index);
    this.resetSwapForm();
    this.scrollToReplacementInput();
  }

  selectCommanderToSwap(): void {
    this.isCommanderSwap.set(true);
    this.selectedSwapIndex.set(null);
    this.resetSwapForm();
    this.scrollToReplacementInput();
  }

  private scrollToReplacementInput(): void {
    setTimeout(() => {
      this.replacementCardInput?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }

  private applyPlayerUpdate(updatedPlayer: PlayerProfile): void {
    const deckList = updatedPlayer.deckList ?? [];
    const hasCardObjects = deckList.some((card) => typeof card !== 'string');

    if (!hasCardObjects) {
      this.player.set(updatedPlayer);
      return;
    }

    const names: string[] = [];
    const types: Record<string, string> = {};
    let commander = updatedPlayer.commander;

    for (const card of deckList as (string | DeckCardResponse)[]) {
      if (typeof card === 'string') {
        names.push(card);
        continue;
      }

      names.push(card.name);
      types[card.name] = card.type;
      if (card.commander) {
        commander = card.name;
      }
    }

    this.cardTypes.update((existing) => ({ ...existing, ...types }));
    this.player.set({ ...updatedPlayer, commander, deckList: names });
  }

  private resetSwapForm(): void {
    this.swapMessage.set('');
    this.swapSuccess.set(false);
    this.replacementCard = '';
    this.replacementCardType = '';
    this.cardSuggestions.set([]);
  }

  searchReplacementCard(): void {
    const query = this.replacementCard.trim();
    if (query.length < 2) {
      this.cardSuggestions.set([]);
      return;
    }

    this.cardSearch.next(query);
  }

  selectReplacementCard(cardName: string): void {
    this.replacementCard = cardName;
    this.cardSuggestions.set([]);
  }

  cancelSwap(): void {
    this.selectedSwapIndex.set(null);
    this.isCommanderSwap.set(false);
    this.resetSwapForm();
  }

  swapSelectedCard(): void {
    const player = this.player();
    const selectedIndex = this.selectedSwapIndex();
    const cardName = this.replacementCard.trim();
    const cardType = this.replacementCardType.trim();

    if (
      !player ||
      (!this.isCommanderSwap() && (selectedIndex === null || selectedIndex < 0)) ||
      !cardName ||
      !cardType
    ) {
      this.swapMessage.set(
        'Choose a card, enter a replacement name, and select its type before saving.',
      );
      this.swapSuccess.set(false);
      return;
    }

    const isCommanderSwap = this.isCommanderSwap();
    const request: DeckSwapRequest | CommanderSwapRequest = isCommanderSwap
      ? { replacementCommander: cardName, replacementCommanderType: cardType }
      : {
          cardIndex: selectedIndex as number,
          replacementCard: cardName,
          replacementCardType: cardType,
        };
    const endpoint = isCommanderSwap ? 'commander' : 'deck';

    this.http.patch<PlayerProfile>(`/api/player/${player.id}/${endpoint}`, request).subscribe({
      next: (updatedPlayer) => {
        this.applyPlayerUpdate(updatedPlayer);
        this.swaps.update((swaps) => [
          ...swaps,
          { card: cardName, cardType, date: new Date().toISOString(), week: null },
        ]);
        this.selectedSwapIndex.set(null);
        this.isCommanderSwap.set(false);
        this.replacementCard = '';
        this.replacementCardType = '';
        this.cardSuggestions.set([]);
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
