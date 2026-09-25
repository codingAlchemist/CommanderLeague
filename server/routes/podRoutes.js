const pool = require('../config/db');

async function readPods() {
    const [weeksResult, podsResult] = await Promise.all([
        pool.query('SELECT week_number, created_at FROM weeks ORDER BY week_number'),
        pool.query('SELECT week_number, group_number, winner_id, player_snapshots FROM pods ORDER BY week_number, group_number'),
    ]);

    const groupsByWeek = new Map();
    for (const pod of podsResult.rows) {
        if (!groupsByWeek.has(pod.week_number)) groupsByWeek.set(pod.week_number, []);
        groupsByWeek.get(pod.week_number).push({
            groupNumber: pod.group_number,
            players: pod.player_snapshots || [],
            winnerId: pod.winner_id,
        });
    }

    return weeksResult.rows.map((week) => ({
        week: week.week_number,
        groups: (groupsByWeek.get(week.week_number) || []).sort((a, b) => a.groupNumber - b.groupNumber),
        createdAt: week.created_at.toISOString(),
    }));
}

async function writePods(pods) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Weeks cascade-delete their pods.
        await client.query('DELETE FROM weeks');

        for (const weekEntry of pods) {
            await client.query(
                'INSERT INTO weeks (week_number, created_at) VALUES ($1, $2)',
                [weekEntry.week, weekEntry.createdAt || new Date().toISOString()],
            );

            for (const group of weekEntry.groups || []) {
                await client.query(
                    `INSERT INTO pods (week_number, group_number, winner_id, player_snapshots)
           VALUES ($1, $2, $3, $4)`,
                    [weekEntry.week, group.groupNumber, group.winnerId || null, JSON.stringify(group.players || [])],
                );
            }
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error writing pods:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    readPods,
    writePods,
    registerPodRoutes(app, {
        readSignups,
        readPods,
        writePods,
        createPodsForWeek,
        readWeekState,
        ensurePodsForWeek,
        shuffleArray
    }) {
        app.get('/api/groups', async (req, res) => {
            try {
                const signups = (await readSignups()).filter((signup) => !signup.absent);

                const groups = [];
                for (let i = 0; i < signups.length; i += 4) {
                    groups.push({
                        groupNumber: Math.floor(i / 4) + 1,
                        players: signups.slice(i, i + 4),
                        playerCount: Math.min(4, signups.length - i)
                    });
                }

                res.json({
                    totalPlayers: signups.length,
                    totalGroups: groups.length,
                    groups: groups
                });
            } catch (error) {
                console.error('Error creating groups:', error);
                res.status(500).json({ error: 'Failed to create groups' });
            }
        });

        app.get('/api/groups/random', async (req, res) => {
            try {
                const signups = (await readSignups()).filter((signup) => !signup.absent);
                const shuffledPlayers = shuffleArray([...signups]);
                res.json(shuffledPlayers);
            } catch (error) {
                console.error('Error creating random groups:', error);
                res.status(500).json({ error: 'Failed to create random groups' });
            }
        });

        app.get('/api/pods', async (req, res) => {
            try {
                const weekParam = req.query.week;
                const pods = await readPods();

                if (weekParam !== undefined) {
                    const week = parseInt(String(weekParam), 10);
                    if (!Number.isInteger(week) || week < 1) {
                        return res.status(400).json({ error: 'Invalid week parameter' });
                    }

                    const pod = pods.find((p) => p.week === week);
                    if (!pod) {
                        return res.json({ week, groups: [] });
                    }

                    return res.json(pod);
                }

                res.json(pods);
            } catch (error) {
                console.error('Error retrieving pods:', error);
                res.status(500).json({ error: 'Failed to retrieve pods' });
            }
        });

        app.post('/api/pods', async (req, res) => {
            try {
                const { week } = req.body || {};

                if (!Number.isInteger(week) || week < 1) {
                    return res.status(400).json({ error: 'Week must be a positive integer' });
                }

                const pod = await ensurePodsForWeek(week);
                res.status(201).json(pod);
            } catch (error) {
                console.error('Error creating pods:', error);
                res.status(500).json({ error: 'Failed to create pods' });
            }
        });

        app.post('/api/pods/reshuffle', async (req, res) => {
            try {
                const { week } = req.body || {};

                let targetWeek = week;
                if (targetWeek === undefined || targetWeek === null) {
                    const ws = await readWeekState();
                    targetWeek = ws.currentWeek;
                }

                if (!Number.isInteger(targetWeek) || targetWeek < 1) {
                    return res.status(400).json({ error: 'Week must be a positive integer or there must be a current week' });
                }

                const newPod = await createPodsForWeek(targetWeek);

                const pods = await readPods();
                const filtered = pods.filter((p) => p.week !== targetWeek);
                filtered.push(newPod);
                await writePods(filtered);

                res.status(201).json(newPod);
            } catch (error) {
                console.error('Error reshuffling pods:', error);
                res.status(500).json({ error: 'Failed to reshuffle pods' });
            }
        });

        app.patch('/api/pods/:week/groups/:groupNumber/winner', async (req, res) => {
            try {
                const week = parseInt(req.params.week, 10);
                const groupNumber = parseInt(req.params.groupNumber, 10);
                const { winnerId } = req.body;

                if (!Number.isInteger(week) || week < 1) {
                    return res.status(400).json({ error: 'Week must be a positive integer' });
                }
                if (!Number.isInteger(groupNumber) || groupNumber < 1) {
                    return res.status(400).json({ error: 'Group number must be a positive integer' });
                }
                if (winnerId !== null && winnerId !== undefined && typeof winnerId !== 'string') {
                    return res.status(400).json({ error: 'winnerId must be a string or null' });
                }

                const pods = await readPods();
                const pod = pods.find((p) => p.week === week);
                if (!pod) {
                    return res.status(404).json({ error: 'Pod for week not found' });
                }

                const group = pod.groups.find((g) => g.groupNumber === groupNumber);
                if (!group) {
                    return res.status(404).json({ error: 'Group not found' });
                }

                if (winnerId !== null && winnerId !== undefined) {
                    const playerExists = group.players.some((player) => player.id === winnerId);
                    if (!playerExists) {
                        return res.status(400).json({ error: 'winnerId must belong to a player in the group' });
                    }
                }

                group.winnerId = winnerId;
                await writePods(pods);

                res.json(group);
            } catch (error) {
                console.error('Error updating pod winner:', error);
                res.status(500).json({ error: 'Failed to update pod winner' });
            }
        });

        return app;
    }
};
