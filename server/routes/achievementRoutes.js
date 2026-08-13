module.exports = {
    registerAchievementRoutes(app, { readAchievements }) {
        app.get('/api/achievements', async (req, res) => {
            try {
                const achievements = await readAchievements();
                res.json(achievements);
            } catch (error) {
                console.error('Error fetching achievements:', error);
                res.status(500).json({ error: 'Failed to fetch achievements' });
            }
        });

        return app;
    }
};
