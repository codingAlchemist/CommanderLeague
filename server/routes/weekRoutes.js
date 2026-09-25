const pool = require('../config/db');

const DEFAULT_TOTAL_WEEKS = 8;
const MIN_TOTAL_WEEKS = 1;
const MAX_TOTAL_WEEKS = 10;

async function readWeekState() {
    const result = await pool.query('SELECT * FROM week_state WHERE id = 1');
    if (result.rows.length === 0) {
        return {
            currentWeek: null,
            startedWeeks: [],
            totalWeeks: DEFAULT_TOTAL_WEEKS,
            updatedAt: new Date().toISOString(),
        };
    }

    const row = result.rows[0];
    return {
        currentWeek: row.current_week,
        startedWeeks: row.started_weeks || [],
        totalWeeks: row.total_weeks,
        updatedAt: row.updated_at.toISOString(),
    };
}

async function writeWeekState(weekState) {
    await pool.query(
        `INSERT INTO week_state (id, current_week, started_weeks, total_weeks, updated_at)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       current_week = excluded.current_week,
       started_weeks = excluded.started_weeks,
       total_weeks = excluded.total_weeks,
       updated_at = excluded.updated_at`,
        [weekState.currentWeek, weekState.startedWeeks, weekState.totalWeeks, weekState.updatedAt],
    );
}

module.exports = {
    DEFAULT_TOTAL_WEEKS,
    readWeekState,
    writeWeekState,
    registerWeekRoutes(app, { readWeekState, writeWeekState }) {
        app.get('/api/week-state', async (req, res) => {
            try {
                const state = await readWeekState();
                res.json(state);
            } catch (error) {
                console.error('Error fetching week state:', error);
                res.status(500).json({ error: 'Failed to fetch week state' });
            }
        });

        app.patch('/api/week-state', async (req, res) => {
            try {
                const body = req.body || {};
                const currentState = await readWeekState();
                const totalWeeks = Math.max(MIN_TOTAL_WEEKS, Math.min(MAX_TOTAL_WEEKS, currentState.totalWeeks));

                const nextState = {
                    ...currentState,
                    currentWeek: body.currentWeek === null || body.currentWeek === undefined ? null : Number(body.currentWeek),
                    startedWeeks: Array.isArray(body.startedWeeks)
                        ? [...new Set(body.startedWeeks.map((week) => Number(week)).filter((week) => Number.isInteger(week) && week > 0 && week <= totalWeeks))].sort((a, b) => a - b)
                        : currentState.startedWeeks,
                    totalWeeks,
                    updatedAt: new Date().toISOString(),
                };

                if (nextState.currentWeek !== null && (nextState.currentWeek < 1 || nextState.currentWeek > totalWeeks)) {
                    nextState.currentWeek = null;
                }

                await writeWeekState(nextState);
                res.json(nextState);
            } catch (error) {
                console.error('Error updating week state:', error);
                res.status(500).json({ error: 'Failed to update week state' });
            }
        });

        app.patch('/api/week-state/total-weeks', async (req, res) => {
            try {
                const delta = Number(req.body?.delta ?? 0);
                const currentState = await readWeekState();
                const nextTotalWeeks = Math.max(MIN_TOTAL_WEEKS, Math.min(MAX_TOTAL_WEEKS, currentState.totalWeeks + (Number.isInteger(delta) ? delta : 0)));

                const nextState = {
                    ...currentState,
                    totalWeeks: nextTotalWeeks,
                    currentWeek: currentState.currentWeek !== null && currentState.currentWeek > nextTotalWeeks ? null : currentState.currentWeek,
                    startedWeeks: currentState.startedWeeks.filter((week) => week <= nextTotalWeeks),
                    updatedAt: new Date().toISOString(),
                };

                await writeWeekState(nextState);
                res.json(nextState);
            } catch (error) {
                console.error('Error updating total weeks:', error);
                res.status(500).json({ error: 'Failed to update total weeks' });
            }
        });

        app.post('/api/week-state/reset', async (req, res) => {
            try {
                const resetState = {
                    currentWeek: null,
                    startedWeeks: [],
                    totalWeeks: DEFAULT_TOTAL_WEEKS,
                    updatedAt: new Date().toISOString(),
                };

                await writeWeekState(resetState);
                res.status(201).json(resetState);
            } catch (error) {
                console.error('Error resetting week state:', error);
                res.status(500).json({ error: 'Failed to reset week state' });
            }
        });

        return app;
    },
};
