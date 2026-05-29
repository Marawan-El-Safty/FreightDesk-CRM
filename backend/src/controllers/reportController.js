const https = require('https');
const { query } = require('../config/db');
const { exportToExcel } = require('../services/excelService');

let rateCache = { egp: null, eur: null, fetchedAt: null };

exports.getExchangeRate = async (req, res, next) => {
  try {
    const now = Date.now();
    if (rateCache.egp && rateCache.fetchedAt && (now - rateCache.fetchedAt) < 10 * 60 * 1000) {
      return res.json({ data: { rate: rateCache.egp, eurRate: rateCache.eur, source: 'cache', fetchedAt: rateCache.fetchedAt } });
    }
    const data = await new Promise((resolve, reject) => {
      https.get('https://open.er-api.com/v6/latest/USD', (r) => {
        let body = '';
        r.on('data', d => body += d);
        r.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('parse error')); } });
      }).on('error', reject);
    });
    const egp = data?.rates?.EGP;
    const eur = data?.rates?.EUR;
    if (!egp) return res.status(503).json({ error: 'Exchange rate unavailable' });
    rateCache = { egp, eur, fetchedAt: now };
    res.json({ data: { rate: egp, eurRate: eur, source: 'live', fetchedAt: now } });
  } catch (err) {
    if (rateCache.egp) return res.json({ data: { rate: rateCache.egp, eurRate: rateCache.eur, source: 'stale', fetchedAt: rateCache.fetchedAt } });
    next(err);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const isRep = req.user.role_name === 'Sales Rep';
    const repFilter = isRep ? `AND assigned_to = '${req.user.id}'` : '';
    const repFilterLeads = isRep ? `AND created_by = '${req.user.id}'` : '';

    const [
      leadsByStage,
      wonLostStats,
      activitiesByType,
      openRequestsCount,
      todayFollowUps,
      kpiData,
      recentActivity
    ] = await Promise.all([
      query(`SELECT stage, COUNT(*) AS count FROM leads WHERE deleted_at IS NULL ${repFilter} GROUP BY stage`),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE stage = 'Won') AS won,
          COUNT(*) FILTER (WHERE stage = 'Lost') AS lost,
          COUNT(*) FILTER (WHERE stage NOT IN ('Won','Lost')) AS active,
          COUNT(*) AS total
        FROM leads WHERE deleted_at IS NULL ${repFilter}
      `),
      query(`
        SELECT activity_type, COUNT(*) AS count
        FROM activities
        WHERE activity_date >= NOW() - INTERVAL '30 days'
        ${isRep ? `AND performed_by = '${req.user.id}'` : ''}
        GROUP BY activity_type
      `),
      query(`SELECT COUNT(*) AS count FROM open_requests WHERE deleted_at IS NULL AND status != 'Closed' ${isRep ? `AND submitted_by = '${req.user.id}'` : ''}`),
      query(`
        SELECT COUNT(*) AS count FROM activities
        WHERE next_follow_up >= NOW()::date AND next_follow_up < (NOW()::date + INTERVAL '1 day')
        ${isRep ? `AND performed_by = '${req.user.id}'` : ''}
      `),
      !isRep ? query(`
        SELECT u.id, u.full_name,
          COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won') AS won_deals,
          COUNT(DISTINCT l.id) AS total_leads,
          COUNT(DISTINCT a.id) AS activity_count,
          ROUND(
            COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won')::numeric /
            NULLIF(COUNT(DISTINCT l.id), 0) * 100, 1
          ) AS conversion_rate
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id AND l.deleted_at IS NULL
        LEFT JOIN activities a ON a.performed_by = u.id AND a.activity_date >= NOW() - INTERVAL '30 days'
        WHERE u.deleted_at IS NULL AND u.is_active = TRUE
        GROUP BY u.id, u.full_name
      `) : Promise.resolve({ rows: [] }),
      query(`
        SELECT a.*, u.full_name AS performed_by_name,
               c.company_name AS client_name, l.company_name AS lead_company
        FROM activities a
        LEFT JOIN users u ON a.performed_by = u.id
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN leads l ON a.lead_id = l.id
        ${isRep ? `WHERE a.performed_by = '${req.user.id}'` : ''}
        ORDER BY a.activity_date DESC LIMIT 10
      `)
    ]);

    res.json({
      data: {
        leadsByStage: leadsByStage.rows,
        wonLostStats: wonLostStats.rows[0],
        activitiesByType: activitiesByType.rows,
        openRequestsCount: parseInt(openRequestsCount.rows[0].count),
        todayFollowUpsCount: parseInt(todayFollowUps.rows[0].count),
        repKpis: kpiData.rows,
        recentActivity: recentActivity.rows,
      }
    });
  } catch (err) { next(err); }
};

exports.getPerformance = async (req, res, next) => {
  try {
    const { from, to, repId } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const params = [fromDate, toDate];
    const repCondition = repId ? `AND u.id = $3` : '';
    if (repId) params.push(repId);

    const result = await query(`
      SELECT u.id, u.full_name,
        COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won' AND l.stage_won_at BETWEEN $1 AND $2) AS won_deals,
        COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Lost' AND l.stage_lost_at BETWEEN $1 AND $2) AS lost_deals,
        COUNT(DISTINCT l.id) AS total_leads,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_date BETWEEN $1 AND $2) AS total_activities,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type = 'Call' AND a.activity_date BETWEEN $1 AND $2) AS calls,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type = 'Meeting' AND a.activity_date BETWEEN $1 AND $2) AS meetings,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type = 'Email' AND a.activity_date BETWEEN $1 AND $2) AS emails,
        COUNT(DISTINCT q.id) FILTER (WHERE q.created_at BETWEEN $1 AND $2) AS quotations_sent,
        COALESCE(SUM(q.total_amount) FILTER (WHERE q.status = 'Accepted' AND q.created_at BETWEEN $1 AND $2), 0) AS revenue_usd
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN leads l ON l.assigned_to = u.id AND l.deleted_at IS NULL
      LEFT JOIN activities a ON a.performed_by = u.id
      LEFT JOIN quotations q ON q.created_by = u.id AND q.deleted_at IS NULL
      WHERE r.name = 'Sales Rep' AND u.deleted_at IS NULL ${repCondition}
      GROUP BY u.id, u.full_name
      ORDER BY won_deals DESC
    `, params);

    res.json({ data: result.rows, from: fromDate, to: toDate });
  } catch (err) { next(err); }
};

exports.getPipeline = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT l.stage,
        COUNT(*) AS count,
        STRING_AGG(l.company_name || ' (' || l.contact_name || ')', ', ') AS sample_companies
      FROM leads l
      WHERE l.deleted_at IS NULL AND l.stage NOT IN ('Won','Lost')
      GROUP BY l.stage
      ORDER BY CASE l.stage
        WHEN 'New Lead' THEN 1 WHEN 'Contacted' THEN 2
        WHEN 'Proposal Sent' THEN 3 WHEN 'Negotiating' THEN 4 ELSE 5 END
    `);

    const shipmentTypes = await query(`
      SELECT shipment_type, COUNT(*) AS count
      FROM leads WHERE deleted_at IS NULL
      GROUP BY shipment_type
    `);

    res.json({ data: { stages: result.rows, shipmentTypes: shipmentTypes.rows } });
  } catch (err) { next(err); }
};

exports.exportPerformance = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const result = await query(`
      SELECT u.full_name AS "Sales Rep",
        COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won') AS "Won Deals",
        COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Lost') AS "Lost Deals",
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_date BETWEEN $1 AND $2) AS "Total Activities",
        COUNT(DISTINCT q.id) FILTER (WHERE q.created_at BETWEEN $1 AND $2) AS "Quotations Sent",
        ROUND(COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won')::numeric / NULLIF(COUNT(DISTINCT l.id), 0) * 100, 1) AS "Conversion Rate %"
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN leads l ON l.assigned_to = u.id AND l.deleted_at IS NULL
      LEFT JOIN activities a ON a.performed_by = u.id
      LEFT JOIN quotations q ON q.created_by = u.id AND q.deleted_at IS NULL
      WHERE r.name = 'Sales Rep' AND u.deleted_at IS NULL
      GROUP BY u.full_name ORDER BY "Won Deals" DESC
    `, [fromDate, toDate]);

    const buffer = await exportToExcel('Performance Report', result.rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="performance-${fromDate}-${toDate}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
};
