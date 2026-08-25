class Card {
    constructor(id, name, description, imageUrl) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.imageUrl = imageUrl;
    }

    static validate(data) {
        const errors = [];

        if (typeof data?.id !== 'string' || data.id.trim() === '') {
            errors.push('Card ID is required.');
        }

        if (typeof data?.name !== 'string' || data.name.trim() === '') {
            errors.push('Card name is required.');
        }

        if (typeof data?.description !== 'string' || data.description.trim() === '') {
            errors.push('Card description is required.');
        }

        if (typeof data?.imageUrl !== 'string' || data.imageUrl.trim() === '') {
            errors.push('Card image URL is required.');
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

        return new Card(data.id, data.name, data.description, data.imageUrl);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            imageUrl: this.imageUrl,
        };
    }
}