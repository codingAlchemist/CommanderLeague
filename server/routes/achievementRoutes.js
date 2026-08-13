const Achievement = require('../models/Achievement');

function buildAchievementId(achievements) {
  const numericIds = achievements
    .map((achievement) => Number(String(achievement?.id || '').match(/(\d+)$/)?.[1]))
    .filter((value) => Number.isInteger(value));

  const nextNumber = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  return `ach-${String(nextNumber).padStart(3, '0')}`;
}

module.exports = {
  registerAchievementRoutes(app, { readAchievements, writeAchievements, getAchievementPointsByRarity }) {
    app.get('/api/achievements', async (req, res) => {
      try {
        const achievements = await readAchievements();
        res.json(achievements);
      } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ error: 'Failed to fetch achievements' });
      }
    });

    app.post('/api/achievements', async (req, res) => {
      try {
        const body = req.body || {};
        const achievements = await readAchievements();
        const createdAchievement = Achievement.fromRequest({
          ...body,
          id: buildAchievementId(achievements),
          points: Number.isInteger(body.points)
            ? Number(body.points)
            : (typeof getAchievementPointsByRarity === 'function'
              ? getAchievementPointsByRarity(body.rarity)
              : Achievement.getPointsForRarity(body.rarity)),
        });

        const updatedAchievements = [...achievements, createdAchievement.toJSON()];
        await writeAchievements(updatedAchievements);

        return res.status(201).json(createdAchievement.toJSON());
      } catch (error) {
        console.error('Error creating achievement:', error);
        return res.status(500).json({ error: 'Failed to create achievement' });
      }
    });

    app.patch('/api/achievements/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const body = req.body || {};
        const achievements = await readAchievements();
        const index = achievements.findIndex((achievement) => achievement.id === id);

        if (index === -1) {
          return res.status(404).json({ error: 'Achievement not found' });
        }

        const existingAchievement = achievements[index];
        const nextAchievement = Achievement.fromRequest({
          ...existingAchievement,
          ...body,
          id: existingAchievement.id,
          createdAt: existingAchievement.createdAt,
          points: Number.isInteger(body.points)
            ? Number(body.points)
            : (typeof getAchievementPointsByRarity === 'function'
              ? getAchievementPointsByRarity(body.rarity ?? existingAchievement.rarity)
              : Achievement.getPointsForRarity(body.rarity ?? existingAchievement.rarity)),
        });

        const updatedAchievements = achievements.map((achievement) =>
          achievement.id === id ? nextAchievement.toJSON() : achievement
        );

        await writeAchievements(updatedAchievements);

        return res.json(nextAchievement.toJSON());
      } catch (error) {
        console.error('Error updating achievement:', error);
        return res.status(500).json({ error: 'Failed to update achievement' });
      }
    });

    return app;
  }
};
