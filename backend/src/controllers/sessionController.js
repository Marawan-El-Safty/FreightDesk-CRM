const { query } = require('../config/db');

exports.ping = async (req, res, next) => {
  try {
    await query(
      `UPDATE user_sessions SET last_activity_at = NOW()
       WHERE id = (
         SELECT id FROM user_sessions
         WHERE user_id = $1 AND logout_at IS NULL
         ORDER BY login_at DESC LIMIT 1
       )`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

exports.getUserTime = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        u.id,
        u.full_name,
        r.name AS role_name,
        ROUND(COALESCE(SUM(
          CASE WHEN s.login_at >= CURRENT_DATE
          THEN EXTRACT(EPOCH FROM (COALESCE(s.logout_at, NOW()) - s.login_at)) / 3600
          END
        ), 0)::numeric, 2) AS today_hours,
        ROUND(COALESCE(SUM(
          CASE WHEN s.login_at >= date_trunc('week', CURRENT_DATE)
          THEN EXTRACT(EPOCH FROM (COALESCE(s.logout_at, NOW()) - s.login_at)) / 3600
          END
        ), 0)::numeric, 2) AS week_hours,
        COUNT(CASE WHEN s.login_at >= CURRENT_DATE THEN 1 END)::int AS today_sessions,
        MAX(s.login_at) AS last_login,
        (EXISTS(
          SELECT 1 FROM user_sessions
          WHERE user_id = u.id AND logout_at IS NULL
        ))::boolean AS is_online
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN user_sessions s ON s.user_id = u.id
      WHERE u.deleted_at IS NULL AND u.is_active = TRUE
      GROUP BY u.id, u.full_name, r.name
      ORDER BY today_hours DESC
    `);
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};
