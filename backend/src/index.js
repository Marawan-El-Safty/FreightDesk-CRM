require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs');

const errorHandler = require('./middleware/errorHandler');
const { checkDueFollowUps, checkOverdueInvoices } = require('./services/notificationService');
const { pool } = require('./config/db');

async function autoMigrate() {
  const { rows } = await pool.query(
    `SELECT to_regclass('public.roles') AS exists`
  );
  if (!rows[0].exists) {
    console.log('Running database migration...');
    const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    const seed = fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8');
    await pool.query(schema);
    await pool.query(seed);
    // Reset sequences so SERIAL columns don't conflict with explicit seed IDs
    await pool.query(`SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles))`);
    console.log('Migration and seed complete.');
  }
  // Incremental migrations
  await pool.query(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS product_type VARCHAR(255)
  `);
  await pool.query(`ALTER TYPE industry_type ADD VALUE IF NOT EXISTS 'Trading'`);
  await pool.query(`ALTER TYPE charge_category ADD VALUE IF NOT EXISTS 'Custom Clearance'`);
  await pool.query(`ALTER TYPE charge_category ADD VALUE IF NOT EXISTS 'Inland Charges'`);
  await pool.query(`ALTER TYPE charge_category ADD VALUE IF NOT EXISTS 'Official Receipts'`);
  await pool.query(`
    ALTER TABLE quotations
      ADD COLUMN IF NOT EXISTS incoterms VARCHAR(50),
      ADD COLUMN IF NOT EXISTS incoterm_other VARCHAR(255),
      ADD COLUMN IF NOT EXISTS pickup_location VARCHAR(255)
  `);
  await pool.query(`ALTER TYPE industry_type ADD VALUE IF NOT EXISTS 'Shipping Lines'`);
  await pool.query(`ALTER TYPE quotation_status ADD VALUE IF NOT EXISTS 'Approved'`);
  await pool.query(`ALTER TYPE quotation_status ADD VALUE IF NOT EXISTS 'Pending Review'`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS review_notes TEXT`);
  await pool.query(`
    ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_contact_type_check;
    ALTER TABLE clients ADD CONSTRAINT clients_contact_type_check
      CHECK (contact_type IN ('Client','Freight Forwarder','Carrier','Supplier','Trader'));
  `);
  await pool.query(`
    ALTER TABLE quotation_charges
      ADD COLUMN IF NOT EXISTS qty        DECIMAL(10,4) DEFAULT 1,
      ADD COLUMN IF NOT EXISTS unit_rate  DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS buying_rate DECIMAL(12,2)
  `);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS buying_total DECIMAL(12,2)`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buying_total DECIMAL(12,2)`);
  await pool.query(`
    ALTER TABLE quotations
      ADD COLUMN IF NOT EXISTS carrier VARCHAR(255),
      ADD COLUMN IF NOT EXISTS show_carrier_in_pdf BOOLEAN DEFAULT FALSE
  `);
  // Invoice extra fields for PDF generation
  await pool.query(`
    ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS bl_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS vessel VARCHAR(255),
      ADD COLUMN IF NOT EXISTS shipping_line VARCHAR(255),
      ADD COLUMN IF NOT EXISTS client_vat VARCHAR(100)
  `);
  // Delivery location for incoterms (Door to Door, DAP, DDP, etc.)
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_location VARCHAR(255)`);
  // Bank accounts table + link invoices to a bank account
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_name   VARCHAR(255) NOT NULL,
      account_number VARCHAR(100),
      currency       VARCHAR(10)  NOT NULL DEFAULT 'USD',
      iban           VARCHAR(100),
      bank_name      VARCHAR(255),
      bank_address   VARCHAR(500),
      swift_code     VARCHAR(50),
      is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
      notes          VARCHAR(500),
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id)`);
  // Shipping line rates table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_rates (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipping_line VARCHAR(255) NOT NULL,
      pol           VARCHAR(255) NOT NULL,
      pod           VARCHAR(255) NOT NULL,
      service_type  VARCHAR(10)  NOT NULL DEFAULT 'FCL',
      rate_20dc     DECIMAL(12,2),
      rate_40dc     DECIMAL(12,2),
      rate_40hc     DECIMAL(12,2),
      rate_lcl      DECIMAL(12,2),
      currency      VARCHAR(10)  NOT NULL DEFAULT 'USD',
      transit_time  VARCHAR(100),
      free_days     INTEGER,
      valid_from    DATE NOT NULL DEFAULT CURRENT_DATE,
      valid_to      DATE NOT NULL,
      notes         TEXT,
      created_by    UUID REFERENCES users(id),
      deleted_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Invoice line-item charges for standalone invoices (not linked to a quotation)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_charges (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description VARCHAR(500) NOT NULL,
      category    VARCHAR(100),
      qty         DECIMAL(10,4) DEFAULT 1,
      unit_rate   DECIMAL(12,2),
      amount      DECIMAL(12,2) NOT NULL,
      currency    VARCHAR(10) NOT NULL DEFAULT 'USD',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Request replies (threaded comments on open requests)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS request_replies (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES open_requests(id) ON DELETE CASCADE,
      author_id  UUID NOT NULL REFERENCES users(id),
      message    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Finance role
  await pool.query(`
    INSERT INTO roles (name, description, permissions)
    SELECT 'Finance', 'Access to invoices and financial data', '{
      "invoices": ["create","read","update","delete"],
      "clients": ["read"],
      "quotations": ["read"],
      "reports": ["read"]
    }'
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Finance')
  `);
}

const app = express();

app.set('trust proxy', 1);

// Ensure upload dir exists
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Security & parsing
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Rate limiter
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts' }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300 }));

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), uploadDir)));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/bank-accounts', require('./routes/bankAccounts'));
app.use('/api/shipping-rates', require('./routes/shippingRates'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search', require('./routes/search'));
app.use('/api/sessions', require('./routes/sessions'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use(errorHandler);

// Scheduled jobs
cron.schedule('0 8 * * *', () => {
  checkDueFollowUps();
  checkOverdueInvoices();
});

const PORT = process.env.PORT || 5000;
autoMigrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FreightDesk CRM Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed, aborting startup:', err.message);
    process.exit(1);
  });

module.exports = app;
