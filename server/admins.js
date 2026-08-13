const fs = require('fs').promises;
const path = require('path');
const Admin = require('./models/Admin');

const ADMIN_FILE = path.join(__dirname, 'data', 'admin-credentials.json');

async function readAdmins() {
    try {
        const data = await fs.readFile(ADMIN_FILE, 'utf8');
        const parsed = JSON.parse(data);

        if (!parsed || typeof parsed !== 'object') {
            return [];
        }

        if (Array.isArray(parsed)) {
            return parsed;
        }

        return [parsed];
    } catch (error) {
        console.error('Error reading admins:', error);
        return [];
    }
}

async function writeAdmins(admins) {
    try {
        await fs.writeFile(ADMIN_FILE, JSON.stringify(admins, null, 2));
    } catch (error) {
        console.error('Error writing admins:', error);
        throw error;
    }
}

async function getPrimaryAdmin() {
    const admins = await readAdmins();
    const primaryAdmin = admins[0] || { username: 'jason.debottis@gmail.com', password: 'Area51Admin' };

    return Admin.fromRequest(primaryAdmin);
}

module.exports = {
    readAdmins,
    writeAdmins,
    getPrimaryAdmin,
};
