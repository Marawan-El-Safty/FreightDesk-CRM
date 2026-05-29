const { query } = require('../config/db');
const { generateQuotationPdf } = require('../services/pdfService');
const { createAndPush } = require('./notificationController');

const generateRef = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SG-${year}${month}-${rand}`;
};

exports.getAll = async (req, res, next) => {
  try {
    const { status, clientId, leadId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = ['q.deleted_at IS NULL'];

    if (req.user.role_name === 'Sales Rep') {
      params.push(req.user.id);
      conditions.push(`q.created_by = $${params.length}`);
    }
    if (status) { params.push(status); conditions.push(`q.status = $${params.length}::quotation_status`); }
    if (clientId) { params.push(clientId); conditions.push(`q.client_id = $${params.length}`); }
    if (leadId) { params.push(leadId); conditions.push(`q.lead_id = $${params.length}`); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const countResult = await query(`SELECT COUNT(*) FROM quotations q ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT q.*, c.company_name AS client_name, u.full_name AS created_by_name
       FROM quotations q
       LEFT JOIN clients c ON q.client_id = c.id
       LEFT JOIN users u ON q.created_by = u.id
       ${whereClause}
       ORDER BY q.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT q.*, c.company_name AS client_name, u.full_name AS created_by_name,
              a.full_name AS approved_by_name
       FROM quotations q
       LEFT JOIN clients c ON q.client_id = c.id
       LEFT JOIN users u ON q.created_by = u.id
       LEFT JOIN users a ON q.approved_by = a.id
       WHERE q.id = $1 AND q.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Quotation not found' });

    const charges = await query(
      'SELECT * FROM quotation_charges WHERE quotation_id = $1 ORDER BY category, description',
      [req.params.id]
    );
    res.json({ data: { ...result.rows[0], charges: charges.rows } });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const {
      clientId, leadId, serviceType, origin, destination, cargoType,
      weight, volume, transitTime, freeDays, currency, validUntil, notes, charges,
      incoterms, incotermOther, pickupLocation, deliveryLocation, carrier, showCarrierInPdf
    } = req.body;

    const refNo = generateRef();
    const toNum = (v) => (v === '' || v === undefined || v === null) ? null : v;
    const total       = (charges || []).reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    const buyingTotal = (charges || []).reduce((sum, c) => {
      const qty  = parseFloat(c.qty) || 1;
      const rate = parseFloat(c.buyingRate) || 0;
      return sum + qty * rate;
    }, 0);

    const result = await query(
      `INSERT INTO quotations (reference_no, client_id, lead_id, service_type, origin, destination,
         cargo_type, weight, volume, transit_time, free_days, currency, total_amount, buying_total,
         valid_until, notes, created_by, incoterms, incoterm_other, pickup_location, delivery_location,
         carrier, show_carrier_in_pdf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [refNo, clientId || null, leadId || null, serviceType, origin, destination,
       cargoType, toNum(weight), toNum(volume), toNum(transitTime), toNum(freeDays),
       currency || 'USD', total, buyingTotal || null, validUntil || null, notes, req.user.id,
       incoterms || null, incotermOther || null, pickupLocation || null, deliveryLocation || null,
       carrier || null, showCarrierInPdf === true]
    );
    const quotation = result.rows[0];

    if (charges && charges.length) {
      for (const charge of charges) {
        await query(
          `INSERT INTO quotation_charges (quotation_id, category, description, amount, currency, qty, unit_rate, buying_rate)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [quotation.id, charge.category || 'Other', charge.description, charge.amount,
           charge.currency || currency || 'USD',
           parseFloat(charge.qty) || 1,
           toNum(charge.unitRate), toNum(charge.buyingRate)]
        );
      }
    }

    res.status(201).json({ data: quotation });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const {
      serviceType, origin, destination, cargoType, weight, volume,
      transitTime, freeDays, currency, validUntil, notes, status, charges,
      incoterms, incotermOther, pickupLocation, deliveryLocation, carrier, showCarrierInPdf
    } = req.body;

    const toNum = (v) => (v === '' || v === undefined || v === null) ? null : v;
    const total       = charges ? charges.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0) : undefined;
    const buyingTotal = charges ? charges.reduce((sum, c) => {
      const qty  = parseFloat(c.qty) || 1;
      const rate = parseFloat(c.buyingRate) || 0;
      return sum + qty * rate;
    }, 0) : undefined;

    const result = await query(
      `UPDATE quotations SET
         service_type = COALESCE($1::service_type, service_type),
         origin = COALESCE($2, origin),
         destination = COALESCE($3, destination),
         cargo_type = COALESCE($4, cargo_type),
         weight = COALESCE($5, weight),
         volume = COALESCE($6, volume),
         transit_time = COALESCE($7, transit_time),
         free_days = COALESCE($8, free_days),
         currency = COALESCE($9::currency_type, currency),
         total_amount = COALESCE($10, total_amount),
         buying_total = COALESCE($11, buying_total),
         valid_until = COALESCE($12, valid_until),
         notes = COALESCE($13, notes),
         status = COALESCE($14::quotation_status, status),
         incoterms = $15,
         incoterm_other = $16,
         pickup_location = $17,
         delivery_location = $18,
         carrier = $19,
         show_carrier_in_pdf = $20,
         updated_at = NOW()
       WHERE id = $21 AND deleted_at IS NULL RETURNING *`,
      [serviceType, origin, destination, cargoType,
       (weight === '' ? null : weight), (volume === '' ? null : volume),
       (transitTime === '' ? null : transitTime), (freeDays === '' ? null : freeDays),
       currency, total, buyingTotal ?? null, validUntil, notes, status,
       incoterms || null, incotermOther || null, pickupLocation || null, deliveryLocation || null,
       carrier || null, showCarrierInPdf === true,
       req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Quotation not found' });

    if (charges) {
      await query('DELETE FROM quotation_charges WHERE quotation_id = $1', [req.params.id]);
      for (const charge of charges) {
        await query(
          `INSERT INTO quotation_charges (quotation_id, category, description, amount, currency, qty, unit_rate, buying_rate)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [req.params.id, charge.category || 'Other', charge.description, charge.amount,
           charge.currency || 'USD',
           parseFloat(charge.qty) || 1,
           toNum(charge.unitRate), toNum(charge.buyingRate)]
        );
      }
    }

    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.approve = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE quotations SET status = 'Approved', approved_by = $1, approved_at = NOW(),
       review_notes = NULL, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Quotation not found' });
    const q = result.rows[0];
    if (q.created_by && q.created_by !== req.user.id) {
      await createAndPush(q.created_by, 'quotation_status', 'Quotation Approved ✅',
        `${q.reference_no} was approved and is ready to send`, '/quotations');
    }
    res.json({ data: q });
  } catch (err) { next(err); }
};

// Sales Rep submits a Draft quotation for manager review
exports.submit = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE quotations SET status = 'Pending Review', updated_at = NOW()
       WHERE id = $1 AND status = 'Draft' AND deleted_at IS NULL RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Quotation not found or not in Draft status' });
    const q = result.rows[0];

    // Notify all managers + admins
    const managers = await query(
      `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
       WHERE r.name IN ('Admin', 'Sales Manager') AND u.is_active = TRUE`
    );
    for (const mgr of managers.rows) {
      await createAndPush(mgr.id, 'quotation_status', 'Quotation Pending Review 🔔',
        `${req.user.full_name} submitted ${q.reference_no} for approval`, '/quotations');
    }
    res.json({ data: q });
  } catch (err) { next(err); }
};

// Manager returns a quotation to the Sales Rep for revision
exports.returnForRevision = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const result = await query(
      `UPDATE quotations SET status = 'Draft', review_notes = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [notes || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Quotation not found' });
    const q = result.rows[0];

    // Notify the creator
    if (q.created_by && q.created_by !== req.user.id) {
      await createAndPush(q.created_by, 'quotation_status', 'Quotation Returned for Revision',
        `${req.user.full_name} returned ${q.reference_no}${notes ? ': ' + notes.slice(0, 80) : ''}`, '/quotations');
    }
    res.json({ data: q });
  } catch (err) { next(err); }
};

exports.generatePdf = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT q.*, c.company_name AS client_name, c.address AS client_address,
              u.full_name AS created_by_name
       FROM quotations q
       LEFT JOIN clients c ON q.client_id = c.id
       LEFT JOIN users u ON q.created_by = u.id
       WHERE q.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Quotation not found' });

    const charges = await query('SELECT * FROM quotation_charges WHERE quotation_id = $1', [req.params.id]);
    const quotation = { ...result.rows[0], charges: charges.rows };

    const pdfBuffer = await generateQuotationPdf(quotation);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quotation-${quotation.reference_no}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await query('UPDATE quotations SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ message: 'Quotation deleted' });
  } catch (err) { next(err); }
};
