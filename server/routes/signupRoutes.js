const Player = require('../models/Player');

module.exports = {
    registerSignupRoutes(app, {
        readSignups,
        writeSignups,
        saveDeckForPlayer,
        getPlayerDeckList,
        readWeekState,
        readPods,
        writePods,
        createPodsForWeek,
        sendSseEvent,
        shuffleArray
    }) {
        app.get('/api/signups', async (req, res) => {
            try {
                const signups = await readSignups();
                res.json(signups);
            } catch (error) {
                res.status(500).json({ error: 'Failed to retrieve signups' });
            }
        });

        app.get('/api/signups/ranked', async (req, res) => {
            try {
                const signups = await readSignups();
                const ranked = (Array.isArray(signups) ? signups.slice() : []).sort((a, b) => (b.points || 0) - (a.points || 0));
                res.json(ranked);
            } catch (error) {
                console.error('Error retrieving ranked signups:', error);
                res.status(500).json({ error: 'Failed to retrieve ranked signups' });
            }
        });

        app.post('/api/signups', async (req, res) => {
            try {
                const validation = Player.validate(req.body);
                if (!validation.isValid) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: validation.errors
                    });
                }

                const signups = await readSignups();

                if (signups.some(signup => signup.email === req.body.email)) {
                    return res.status(409).json({ error: 'Email already registered' });
                }

                const newPlayer = new Player(req.body);
                newPlayer.deck.cards = getPlayerDeckList(newPlayer);

                await saveDeckForPlayer(
                    newPlayer.playerName,
                    newPlayer.deck.toJSON(),
                );
                signups.push(newPlayer.toJSON());
                await writeSignups(signups);

                try {
                    const weekState = await readWeekState();
                    if (weekState.currentWeek !== null) {
                        const newPod = await createPodsForWeek(weekState.currentWeek);
                        const pods = await readPods();
                        const filtered = pods.filter((p) => p.week !== weekState.currentWeek);
                        filtered.push(newPod);
                        await writePods(filtered);
                        sendSseEvent('pods-reshuffled', { week: weekState.currentWeek, pod: newPod });
                    }
                    sendSseEvent('signups-updated', { action: 'create', player: newPlayer.toJSON() });
                } catch (err) {
                    console.error('Error reshuffling pods after signup create:', err);
                }

                res.status(201).json(newPlayer.toJSON());
            } catch (error) {
                console.error('Error creating signup:', error);
                res.status(500).json({ error: 'Failed to create signup' });
            }
        });

        app.delete('/api/signups/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const signups = await readSignups();

                const filteredSignups = signups.filter(signup => signup.id !== id);

                if (filteredSignups.length === signups.length) {
                    return res.status(404).json({ error: 'Signup not found' });
                }

                await writeSignups(filteredSignups);
                try {
                    const weekState = await readWeekState();
                    if (weekState.currentWeek !== null) {
                        const newPod = await createPodsForWeek(weekState.currentWeek);
                        const pods = await readPods();
                        const filtered = pods.filter((p) => p.week !== weekState.currentWeek);
                        filtered.push(newPod);
                        await writePods(filtered);
                        sendSseEvent('pods-reshuffled', { week: weekState.currentWeek, pod: newPod });
                    }
                    sendSseEvent('signups-updated', { action: 'delete', id });
                } catch (err) {
                    console.error('Error reshuffling pods after signup delete:', err);
                }

                res.json({ message: 'Signup deleted successfully' });
            } catch (error) {
                res.status(500).json({ error: 'Failed to delete signup' });
            }
        });

        app.patch('/api/signups/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { points, absent } = req.body;

                if (points !== undefined && typeof points !== 'number') {
                    return res.status(400).json({ error: 'Points must be a number' });
                }

                if (absent !== undefined && typeof absent !== 'boolean') {
                    return res.status(400).json({ error: 'Absent must be a boolean' });
                }

                if (points === undefined && absent === undefined) {
                    return res.status(400).json({ error: 'Nothing to update' });
                }

                const signups = await readSignups();
                const playerIndex = signups.findIndex(signup => signup.id === id);

                if (playerIndex === -1) {
                    return res.status(404).json({ error: 'Signup not found' });
                }

                if (points !== undefined) {
                    signups[playerIndex].points = points;
                }
                if (absent !== undefined) {
                    signups[playerIndex].absent = absent;
                }

                await writeSignups(signups);
                const updatedPlayer = signups[playerIndex];

                try {
                    if (absent !== undefined) {
                        const weekState = await readWeekState();
                        if (weekState.currentWeek !== null) {
                            const newPod = await createPodsForWeek(weekState.currentWeek);
                            const pods = await readPods();
                            const filtered = pods.filter((p) => p.week !== weekState.currentWeek);
                            filtered.push(newPod);
                            await writePods(filtered);
                            sendSseEvent('pods-reshuffled', { week: weekState.currentWeek, pod: newPod });
                        }
                    }
                    sendSseEvent('signups-updated', { action: 'update', player: updatedPlayer });
                } catch (err) {
                    console.error('Error reshuffling pods after signup update:', err);
                }

                res.json(updatedPlayer);
            } catch (error) {
                console.error('Error updating signup:', error);
                res.status(500).json({ error: 'Failed to update signup' });
            }
        });

        app.delete('/api/signups', async (req, res) => {
            try {
                await writeSignups([]);
                try {
                    const weekState = await readWeekState();
                    if (weekState.currentWeek !== null) {
                        const newPod = await createPodsForWeek(weekState.currentWeek);
                        const pods = await readPods();
                        const filtered = pods.filter((p) => p.week !== weekState.currentWeek);
                        filtered.push(newPod);
                        await writePods(filtered);
                        sendSseEvent('pods-reshuffled', { week: weekState.currentWeek, pod: newPod });
                    }
                    sendSseEvent('signups-updated', { action: 'reset' });
                } catch (err) {
                    console.error('Error reshuffling pods after clearing signups:', err);
                }

                res.json({ message: 'All signups deleted successfully' });
            } catch (error) {
                console.error('Error deleting all signups:', error);
                res.status(500).json({ error: 'Failed to delete all signups' });
            }
        });

        app.patch('/api/signups/:id/points', async (req, res) => {
            try {
                const { id } = req.params;
                const { points } = req.body;

                if (typeof points !== 'number') {
                    return res.status(400).json({ error: 'Points must be a number' });
                }

                const signups = await readSignups();
                const playerIndex = signups.findIndex(signup => signup.id === id);

                if (playerIndex === -1) {
                    return res.status(404).json({ error: 'Player not found' });
                }

                signups[playerIndex].points = points;
                await writeSignups(signups);

                res.json(signups[playerIndex]);
            } catch (error) {
                console.error('Error updating points:', error);
                res.status(500).json({ error: 'Failed to update points' });
            }
        });

        return app;
    }
};
