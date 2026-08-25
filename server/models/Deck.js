class Deck {
    constructor(name, cards = [], commander = '') {
        this.name = name;
        this.cards = cards;
        this.commander = commander;
    }

    static validate(data) {
        const errors = [];

        if (typeof data?.name !== 'string' || data.name.trim() === '') {
            errors.push('Deck name is required.');
        }

        if (!Array.isArray(data?.cards)) {
            errors.push('Deck cards must be an array.');
        } else {
            for (const card of data.cards) {
                if (typeof card !== 'object' || !card.id || !card.name) {
                    errors.push('Each card must be a valid object with id and name.');
                    break;
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    static fromRequest(data) {
        const validation = this.validate(data);

        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
        }

        return new Deck(data.name, data.cards);
    }

    toJSON() {
        return {
            name: this.name,
            cards: this.cards,
            commander: this.commander,
        };
    }
}

module.exports = Deck;