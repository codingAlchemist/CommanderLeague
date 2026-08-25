import { ChangeDetectionStrategy, Component } from '@angular/core';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq-and-rules',
  templateUrl: './faq-and-rules.html',
  styleUrl: './faq-and-rules.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqAndRules {
  readonly faqItems: FaqItem[] = [
    {
      question: 'What should I bring?',
      answer:
        'Bring an unaltered pre-con deck and any supplies you need to play, including sleeves, tokens, and a way to track life.',
    },
    {
      question: 'Can I use a deck I built myself?',
      answer:
        'This league is built around pre-con decks. Choose a commercially released pre-con deck and keep its original deck list for league play.',
    },
    {
      question: 'How do I join the league?',
      answer:
        'Use the Sign Up Sheet to register your name, contact details, deck, and commander. An organizer will use the list to prepare the weekly pods.',
    },
    {
      question: 'What is the end-of-league reward?',
      answer:
        'At the end of the league, players can add cards from a play booster pack to improve their deck for future games.',
    },
    {
      question:
        'Will a alternate version of card that is already in the precon count as an upgrade for that week?',
      answer:
        'No. The alternate version of a card that is already in the precon will not count as an upgrade for that week. Players are encouraged to use the original version of the card from their precon deck.',
    },
  ];
}
