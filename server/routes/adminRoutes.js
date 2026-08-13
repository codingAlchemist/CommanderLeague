module.exports = {
    registerAdminRoutes(app, { readAdminCredentials, writeAdminCredentials }) {
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
                adminCredentials = await readAdminCredentials();
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
                adminCredentials = await readAdminCredentials();
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
                await writeAdminCredentials({ username: adminCredentials.username, password: newPassword });
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
