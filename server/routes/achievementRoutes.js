const Achievement = require('../models/Achievement');
const pool = require('../config/db');

function getAchievementPointsByRarity(rarity) {
  switch (typeof rarity === 'string' ? rarity.toLowerCase() : '') {
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

async function readAchievements() {
  const result = await pool.query('SELECT * FROM achievements ORDER BY id');
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    rarity: row.rarity,
    category: row.category,
    points: Number.isInteger(row.points) ? row.points : getAchievementPointsByRarity(row.rarity),
    createdAt: row.created_at.toISOString(),
  }));
}

async function writeAchievements(achievements) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ids = achievements.map((achievement) => achievement.id);
    if (ids.length > 0) {
      await client.query('DELETE FROM achievements WHERE id <> ALL($1::text[])', [ids]);
    } else {
      await client.query('DELETE FROM achievements');
    }

    for (const achievement of achievements) {
      await client.query(
        `INSERT INTO achievements (id, title, description, rarity, category, points, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           rarity = excluded.rarity,
           category = excluded.category,
           points = excluded.points`,
        [
          achievement.id,
          achievement.title,
          achievement.description,
          achievement.rarity,
          achievement.category,
          achievement.points,
          achievement.createdAt || new Date().toISOString(),
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error writing achievements:', error);
    throw error;
  } finally {
    client.release();
  }
}

function buildAchievementId(achievements) {
  const numericIds = achievements
    .map((achievement) => Number(String(achievement?.id || '').match(/(\d+)$/)?.[1]))
    .filter((value) => Number.isInteger(value));

  const nextNumber = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  return `ach-${String(nextNumber).padStart(3, '0')}`;
}

module.exports = {
  readAchievements,
  writeAchievements,
  getAchievementPointsByRarity,
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
