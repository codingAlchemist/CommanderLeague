const fs = require('fs').promises;
const path = require('path');
const Admin = require('../models/Admin');

const ADMIN_FILE = path.join(__dirname, '..', 'data', 'admin-credentials.json');

async function readAdmins() {
    try {
        const data = await fs.readFile(ADMIN_FILE, 'utf8');
        const parsed = JSON.parse(data);

        if (!parsed || typeof parsed !== 'object') {
            return [];
        }

        return Array.isArray(parsed) ? parsed : [parsed];
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

async function readAdminCredentials() {
    const primaryAdmin = await getPrimaryAdmin();
    return primaryAdmin.toJSON();
}

async function writeAdminCredentials(credentials) {
    const currentAdmin = Admin.fromRequest(credentials);
    await writeAdmins([currentAdmin.toJSON()]);
    return currentAdmin.toJSON();
}

module.exports = {
    readAdmins,
    writeAdmins,
    getPrimaryAdmin,
    readAdminCredentials,
    writeAdminCredentials,
    registerAdminRoutes(app, {
        readAdminCredentials: readAdminCredentialsFromDeps,
        writeAdminCredentials: writeAdminCredentialsFromDeps,
        readAdmins: readAdminsFromDeps,
        writeAdmins: writeAdminsFromDeps,
    } = {}) {
        const resolveReadAdminCredentials = readAdminCredentialsFromDeps || readAdminCredentials;
        const resolveWriteAdminCredentials = writeAdminCredentialsFromDeps || writeAdminCredentials;
        const resolveReadAdmins = readAdminsFromDeps || readAdmins;
        const resolveWriteAdmins = writeAdminsFromDeps || writeAdmins;

        app.get('/api/admins', async (req, res) => {
            try {
                const admins = await resolveReadAdmins();
                return res.json(admins);
            } catch (error) {
                console.error('Error fetching admins:', error);
                return res.status(500).json({ error: 'Failed to fetch admins' });
            }
        });

        app.post('/api/admins', async (req, res) => {
            try {
                const { username, password } = req.body || {};
                const trimmedUsername = typeof username === 'string' ? username.trim() : '';
                const trimmedPassword = typeof password === 'string' ? password.trim() : '';

                if (trimmedUsername === '' || trimmedPassword === '') {
                    return res.status(400).json({ error: 'Username and password are required' });
                }

                if (trimmedPassword.length < 8) {
                    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
                }

                const admins = await resolveReadAdmins();
                const exists = admins.some((admin) => String(admin.username || '').trim().toLowerCase() === trimmedUsername.toLowerCase());

                if (exists) {
                    return res.status(409).json({ error: 'An admin with that username already exists' });
                }

                const createdAdmin = Admin.fromRequest({ username: trimmedUsername, password: trimmedPassword });
                const nextAdmins = [...admins, createdAdmin.toJSON()];
                await resolveWriteAdmins(nextAdmins);

                return res.status(201).json(createdAdmin.toJSON());
            } catch (error) {
                console.error('Error creating admin:', error);
                return res.status(500).json({ error: 'Failed to create admin' });
            }
        });

        app.patch('/api/admins/:username', async (req, res) => {
            try {
                const { username: usernameParam } = req.params;
                const { username, password } = req.body || {};
                const normalizedParam = typeof usernameParam === 'string' ? usernameParam.trim() : '';
                const nextUsername = typeof username === 'string' ? username.trim() : normalizedParam;
                const nextPassword = typeof password === 'string' ? password.trim() : undefined;

                if (nextUsername === '') {
                    return res.status(400).json({ error: 'Username is required' });
                }

                if (nextPassword !== undefined && nextPassword.length < 8) {
                    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
                }

                const admins = await resolveReadAdmins();
                const index = admins.findIndex((admin) => String(admin.username || '').trim().toLowerCase() === normalizedParam.toLowerCase());

                if (index === -1) {
                    return res.status(404).json({ error: 'Admin not found' });
                }

                const existingAdmin = admins[index];
                const updatedAdmin = Admin.fromRequest({
                    ...existingAdmin,
                    username: nextUsername,
                    password: typeof nextPassword === 'string' ? nextPassword : existingAdmin.password,
                    createdAt: existingAdmin.createdAt,
                });

                const nextAdmins = admins.map((admin, adminIndex) => (adminIndex === index ? updatedAdmin.toJSON() : admin));
                await resolveWriteAdmins(nextAdmins);

                return res.json(updatedAdmin.toJSON());
            } catch (error) {
                console.error('Error updating admin:', error);
                return res.status(500).json({ error: 'Failed to update admin' });
            }
        });

        app.delete('/api/admins/:username', async (req, res) => {
            try {
                const { username } = req.params;
                const normalizedUsername = typeof username === 'string' ? username.trim() : '';

                if (normalizedUsername === '') {
                    return res.status(400).json({ error: 'Username is required' });
                }

                const admins = await resolveReadAdmins();
                const index = admins.findIndex((admin) => String(admin.username || '').trim().toLowerCase() === normalizedUsername.toLowerCase());

                if (index === -1) {
                    return res.status(404).json({ error: 'Admin not found' });
                }

                const [deletedAdmin] = admins.splice(index, 1);
                await resolveWriteAdmins(admins);

                return res.json({ deleted: deletedAdmin });
            } catch (error) {
                console.error('Error deleting admin:', error);
                return res.status(500).json({ error: 'Failed to delete admin' });
            }
        });

        app.post('/api/admin/login', async (req, res) => {
            const { username, password } = req.body || {};
            const requestIp = req.ip || req.socket?.remoteAddress || 'unknown';
            const attemptedUsername = typeof username === 'string' ? username.trim().toLowerCase() : 'invalid';

            console.info('Admin login attempt', {
                username: attemptedUsername,
                ip: requestIp,
                timestamp: new Date().toISOString()
            });

            if (typeof username !== 'string' || typeof password !== 'string') {
                console.warn('Admin login rejected: missing credentials', {
                    username: attemptedUsername,
                    ip: requestIp
                });
                return res.status(400).json({ error: 'Username and password are required' });
            }

            let adminCredentials;
            try {
                adminCredentials = await resolveReadAdminCredentials();
            } catch (error) {
                console.error('Error reading admin credentials:', error);
                console.error('Admin login failed: credentials source unavailable', {
                    username: attemptedUsername,
                    ip: requestIp
                });
                return res.status(500).json({ error: 'Failed to validate admin credentials' });
            }

            const normalizedUsername = username.trim().toLowerCase();
            const isValidUsername = normalizedUsername === adminCredentials.username.trim().toLowerCase();
            const isValidPassword = password === adminCredentials.password;

            if (!isValidUsername || !isValidPassword) {
                console.warn('Admin login rejected: invalid credentials', {
                    username: normalizedUsername,
                    ip: requestIp
                });
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            console.info('Admin login successful', {
                username: normalizedUsername,
                ip: requestIp,
                timestamp: new Date().toISOString()
            });

            return res.json({ authenticated: true, isAdmin: true });
        });

        app.patch('/api/admin/password', async (req, res) => {
            const { currentPassword, newPassword } = req.body || {};
            const requestIp = req.ip || req.socket?.remoteAddress || 'unknown';

            if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
                return res.status(400).json({ error: 'Current password and new password are required' });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({ error: 'New password must be at least 8 characters long' });
            }

            let adminCredentials;
            try {
                adminCredentials = await resolveReadAdminCredentials();
            } catch (error) {
                console.error('Error reading admin credentials:', error);
                return res.status(500).json({ error: 'Failed to update admin password' });
            }

            if (currentPassword !== adminCredentials.password) {
                console.warn('Admin password change rejected: incorrect current password', {
                    ip: requestIp
                });
                return res.status(401).json({ error: 'Current password is incorrect' });
            }

            try {
                await resolveWriteAdminCredentials({ username: adminCredentials.username, password: newPassword });
            } catch (error) {
                console.error('Failed to save new admin password:', error);
                return res.status(500).json({ error: 'Failed to update admin password' });
            }

            console.info('Admin password changed successfully', {
                ip: requestIp,
                timestamp: new Date().toISOString()
            });

            return res.json({ success: true });
        });

        return app;
    }
};
