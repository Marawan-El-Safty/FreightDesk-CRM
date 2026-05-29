-- FreightDesk CRM - Seed Data

-- Roles
INSERT INTO roles (id, name, description, permissions) VALUES
(1, 'Admin', 'Full system access including user management', '{
    "users": ["create","read","update","delete"],
    "clients": ["create","read","update","delete"],
    "leads": ["create","read","update","delete"],
    "quotations": ["create","read","update","delete","approve"],
    "activities": ["create","read","update","delete"],
    "tasks": ["create","read","update","delete"],
    "open_requests": ["create","read","update","delete"],
    "contracts": ["create","read","update","delete"],
    "invoices": ["create","read","update","delete"],
    "reports": ["read","export"],
    "settings": ["read","update"]
}'),
(2, 'Sales Manager', 'Manages all sales reps data, approves quotations, assigns tasks', '{
    "users": ["read"],
    "clients": ["create","read","update","delete"],
    "leads": ["create","read","update","delete"],
    "quotations": ["create","read","update","delete","approve"],
    "activities": ["create","read","update","delete"],
    "tasks": ["create","read","update","delete"],
    "open_requests": ["create","read","update","delete"],
    "contracts": ["create","read","update","delete"],
    "invoices": ["create","read","update","delete"],
    "reports": ["read","export"],
    "settings": ["read"]
}'),
(3, 'Sales Rep', 'Access to own clients, leads, tasks, and performance only', '{
    "clients": ["create","read","update"],
    "leads": ["create","read","update"],
    "quotations": ["create","read","update"],
    "activities": ["create","read","update"],
    "tasks": ["create","read","update"],
    "open_requests": ["create","read"],
    "contracts": ["read"],
    "invoices": ["read"]
}');

-- Default Admin user (password: Demo@1234)
-- bcrypt hash for "Demo@1234"
INSERT INTO users (id, role_id, full_name, email, password_hash, phone, is_active) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    1,
    'System Administrator',
    'admin@freightdesk.demo',
    '$2b$12$V.MPzLIvfx8/wtFtkK6rUOGISDfROdpr2fUuskIbawCOYsPBN1Qz.',
    '+1 (555) 010-2030',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000002',
    2,
    'Sales Manager',
    'manager@freightdesk.demo',
    '$2b$12$V.MPzLIvfx8/wtFtkK6rUOGISDfROdpr2fUuskIbawCOYsPBN1Qz.',
    '+1 (555) 020-3040',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000003',
    3,
    'Jordan Mitchell',
    'ahmed@freightdesk.demo',
    '$2b$12$V.MPzLIvfx8/wtFtkK6rUOGISDfROdpr2fUuskIbawCOYsPBN1Qz.',
    '+1 (555) 030-4050',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000004',
    3,
    'Casey Rivera',
    'sara@freightdesk.demo',
    '$2b$12$V.MPzLIvfx8/wtFtkK6rUOGISDfROdpr2fUuskIbawCOYsPBN1Qz.',
    '+1 (555) 040-5060',
    TRUE
);

-- Sample Clients
INSERT INTO clients (id, company_name, industry, country, address, assigned_to, created_by) VALUES
(
    'c0000000-0000-0000-0000-000000000001',
    'Atlantic Freight Partners',
    'Freight Forwarder',
    'Egypt',
    '12 Harbor Ave, Demo City',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003'
),
(
    'c0000000-0000-0000-0000-000000000002',
    'Pacific Export Corporation',
    'Exporter',
    'Egypt',
    '45 Commercial Zone, Metro City',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000004'
),
(
    'c0000000-0000-0000-0000-000000000003',
    'Global Imports LLC',
    'Importer',
    'UAE',
    'Jebel Ali Free Zone, Dubai',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000002'
);

-- Sample Contacts
INSERT INTO client_contacts (client_id, full_name, title, phone, email, whatsapp, is_primary) VALUES
('c0000000-0000-0000-0000-000000000001', 'Karim Abdalla', 'Operations Director', '+20 100 111 2222', 'karim@medshipping.com', '+20 100 111 2222', TRUE),
('c0000000-0000-0000-0000-000000000002', 'Mona Ibrahim', 'Export Manager', '+20 100 333 4444', 'mona@nileexport.com', '+20 100 333 4444', TRUE),
('c0000000-0000-0000-0000-000000000003', 'James Wilson', 'Logistics Head', '+971 50 123 4567', 'james@globalimports.ae', '+971 50 123 4567', TRUE);

-- Sample Leads
INSERT INTO leads (id, contact_name, company_name, email, phone, shipment_type, origin, destination, stage, source, assigned_to, created_by, stage_new_lead_at) VALUES
(
    'e0000000-0000-0000-0000-000000000001',
    'Omar Farouq',
    'Delta Manufacturers',
    'omar@deltamfg.com',
    '+20 100 555 6666',
    'Sea Freight FCL',
    'Demo City, USA',
    'Rotterdam, Netherlands',
    'New Lead',
    'Manual Entry',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    NOW()
),
(
    'e0000000-0000-0000-0000-000000000002',
    'Layla Hassan',
    'Metro City Trading Co',
    'layla@cairotrading.com',
    '+20 100 777 8888',
    'Air Freight',
    'Metro City, Egypt',
    'Frankfurt, Germany',
    'Contacted',
    'Website Form',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000002',
    NOW() - INTERVAL '5 days'
);

-- Sample Tasks
INSERT INTO tasks (title, description, due_date, priority, status, assigned_to, assigned_by, client_id, created_by) VALUES
(
    'Follow up with Atlantic Freight Partners',
    'Call Karim to discuss Q3 rates',
    NOW() + INTERVAL '2 days',
    'High',
    'To Do',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002'
),
(
    'Prepare quotation for Delta Manufacturers',
    'FCL rates Demo City to Rotterdam',
    NOW() + INTERVAL '1 day',
    'Urgent',
    'In Progress',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    NULL,
    'a0000000-0000-0000-0000-000000000003'
);
