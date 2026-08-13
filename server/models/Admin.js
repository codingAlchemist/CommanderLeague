class Admin {
    constructor({ username, password, createdAt }) {
        this.username = typeof username === 'string' ? username.trim() : '';
        this.password = typeof password === 'string' ? password : '';
        this.createdAt = createdAt || new Date().toISOString();
    }

    static validate(data) {
        const errors = [];

        if (typeof data?.username !== 'string' || data.username.trim() === '') {
            errors.push('Admin username is required.');
        }

        if (typeof data?.password !== 'string' || data.password.trim() === '') {
            errors.push('Admin password is required.');
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

        return new Admin(data);
    }

    toJSON() {
        return {
            username: this.username,
            password: this.password,
            createdAt: this.createdAt,
        };
    }
}

module.exports = Admin;
