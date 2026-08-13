class Achievement {
    static getPointsForRarity(rarity) {
        switch (typeof rarity === 'string' ? rarity.trim().toLowerCase() : '') {
            case 'common':
                return 5;
            case 'uncommon':
                return 8;
            case 'rare':
                return 12;
            case 'epic':
                return 20;
            default:
                return 5;
        }
    }

    constructor({ id, title, description, rarity, category, points, createdAt }) {
        this.id = id || `ach-${Date.now().toString()}`;
        this.title = typeof title === 'string' ? title.trim() : '';
        this.description = typeof description === 'string' ? description.trim() : '';
        this.rarity = typeof rarity === 'string' ? rarity.trim().toLowerCase() : 'common';
        this.category = typeof category === 'string' ? category.trim() : '';
        this.points = Number.isInteger(points) ? points : Achievement.getPointsForRarity(this.rarity);
    }

    static validate(data = {}) {
        const errors = [];

        if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
            errors.push('Title is required and must be a non-empty string');
        }

        if (!data.description || typeof data.description !== 'string' || data.description.trim() === '') {
            errors.push('Description is required and must be a non-empty string');
        }

        const validRarities = ['common', 'uncommon', 'rare', 'epic'];
        if (!data.rarity || typeof data.rarity !== 'string' || !validRarities.includes(data.rarity.trim().toLowerCase())) {
            errors.push('Rarity must be one of: common, uncommon, rare, epic');
        }

        if (!data.category || typeof data.category !== 'string' || data.category.trim() === '') {
            errors.push('Category is required and must be a non-empty string');
        }

        if (data.points !== undefined && (!Number.isInteger(data.points) || data.points < 0)) {
            errors.push('Points must be a non-negative integer');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    static fromRequest(data) {
        const validation = this.validate(data);
        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
        }

        return new Achievement(data);
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            rarity: this.rarity,
            category: this.category,
            points: this.points,
            createdAt: this.createdAt
        };
    }
}

module.exports = Achievement;
