import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

export let mysqlPool: mysql.Pool | null = null;

if (process.env.DB_HOST) {
  try {
    let sslConfig = undefined;
    const caValue = process.env.DB_SSL_CA;
    
    if (caValue && caValue !== 'DB_SSL_CA' && caValue.trim() !== '') {
      try {
        if (caValue.includes('BEGIN CERTIFICATE')) {
          sslConfig = { ca: caValue };
        } else if (fs.existsSync(caValue)) {
          sslConfig = { ca: fs.readFileSync(caValue) };
        } else {
          // suppress warn
        }
      } catch (err) {
        // suppress error
      }
    }

    const dbHost = process.env.DB_HOST === 'DB_HOST' ? 'localhost' : process.env.DB_HOST;
    const dbPort = process.env.DB_PORT === 'DB_PORT' ? '3306' : (process.env.DB_PORT || '3306');
    const dbUser = process.env.DB_USER === 'DB_USER' ? 'root' : process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD === 'DB_PASSWORD' ? 'password' : process.env.DB_PASSWORD;
    const dbName = process.env.DB_NAME === 'DB_NAME' ? 'trust_center' : process.env.DB_NAME;

    mysqlPool = mysql.createPool({
      host: dbHost,
      port: parseInt(dbPort),
      user: dbUser,
      password: dbPassword,
      database: dbName,
      ssl: sslConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log('MariaDB pool created');
  } catch (err) {
    // suppress error
  }
} else {
  // suppress warn
}

function toMysql(sql: string): string {
  let mysqlSql = sql.replace(/"([^"]+)"/g, '`$1`');
  
  // Handle AUTOINCREMENT
  mysqlSql = mysqlSql.replace(/\bAUTOINCREMENT\b/g, 'AUTO_INCREMENT');
  
  // Handle INSERT OR IGNORE
  mysqlSql = mysqlSql.replace(/\bINSERT OR IGNORE\b/g, 'INSERT IGNORE');
  
  if (mysqlSql.includes('ON CONFLICT')) {
    mysqlSql = mysqlSql.replace(/ON CONFLICT\s*\([^)]+\)\s*DO UPDATE SET/gi, 'ON DUPLICATE KEY UPDATE');
    mysqlSql = mysqlSql.replace(/excluded\.(\w+)/gi, 'VALUES($1)');
    mysqlSql = mysqlSql.replace(/excluded\.`([^`]+)`/gi, 'VALUES(`$1`)');
  }
  
  return mysqlSql;
}

export const pool = {
  query: async (sql: string, params: any[] = []) => {
    const mysqlSql = toMysql(sql);
    const isSelect = mysqlSql.trim().toUpperCase().startsWith('SELECT');

    if (!mysqlPool) {
      if (isSelect) return [[]];
      return [{ insertId: 0, affectedRows: 0 }, null];
    }
    
    try {
      const [result] = await mysqlPool.query(mysqlSql, params);
      
      if (isSelect) {
        return [result as any[]];
      } else {
        const res = result as mysql.ResultSetHeader;
        return [{ insertId: res.insertId, affectedRows: res.affectedRows }, null];
      }
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        if (isSelect) return [[]];
        return [{ insertId: 0, affectedRows: 0 }, null];
      }
      throw err;
    }
  },
  getConnection: async () => {
    if (!mysqlPool) {
      return {
        query: async (sql: string, params: any[] = []) => {
          const mysqlSql = toMysql(sql);
          const isSelect = mysqlSql.trim().toUpperCase().startsWith('SELECT');
          if (isSelect) return [[]];
          return [{ insertId: 0, affectedRows: 0 }, null];
        },
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {}
      };
    }
    try {
      const mysqlConn = await mysqlPool.getConnection();
  
      return {
        query: async (sql: string, params: any[] = []) => {
          const mysqlSql = toMysql(sql);
          const isSelect = mysqlSql.trim().toUpperCase().startsWith('SELECT');
          const [result] = await mysqlConn.query(mysqlSql, params);
  
          if (isSelect) {
            return [result as any[]];
          } else {
            const res = result as mysql.ResultSetHeader;
            return [{ insertId: res.insertId, affectedRows: res.affectedRows }, null];
          }
        },
        beginTransaction: async () => {
          await mysqlConn.beginTransaction();
        },
        commit: async () => {
          await mysqlConn.commit();
        },
        rollback: async () => {
          await mysqlConn.rollback();
        },
        release: () => {
          mysqlConn.release();
        }
      };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return {
          query: async (sql: string, params: any[] = []) => {
            const mysqlSql = toMysql(sql);
            const isSelect = mysqlSql.trim().toUpperCase().startsWith('SELECT');
            if (isSelect) return [[]];
            return [{ insertId: 0, affectedRows: 0 }, null];
          },
          beginTransaction: async () => {},
          commit: async () => {},
          rollback: async () => {},
          release: () => {}
        };
      }
      throw err;
    }
  }
};

export async function initDb() {
  if (!mysqlPool) {
    return;
  }

  const runDual = async (sql: string, params: any[] = []) => {
    try {
      const mysqlSql = toMysql(sql);
      await mysqlPool!.query(mysqlSql, params);
    } catch (err) {
      // suppress initialization errors 
    }
  };

  const getCount = async (table: string) => {
    try {
      const [rows] = await mysqlPool!.query(`SELECT count(*) as count FROM \`${table}\``);
      return (rows as any[])[0];
    } catch (err) {
      return { count: 0 };
    }
  };

  // Users table
  await runDual(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'viewer'
    )
  `);

  // User Modules table
  await runDual(`
    CREATE TABLE IF NOT EXISTS user_modules (
      user_id INTEGER NOT NULL,
      module_id VARCHAR(255) NOT NULL,
      PRIMARY KEY (user_id, module_id)
    )
  `);

  // User Products table
  await runDual(`
    CREATE TABLE IF NOT EXISTS user_products (
      user_id INTEGER NOT NULL,
      product_slug VARCHAR(255) NOT NULL,
      PRIMARY KEY (user_id, product_slug)
    )
  `);

  // Product Countries table
  await runDual(`
    CREATE TABLE IF NOT EXISTS product_countries (
      product_slug VARCHAR(255) NOT NULL,
      country VARCHAR(10) NOT NULL,
      PRIMARY KEY (product_slug, country)
    )
  `);

  // Legal Document Countries table
  await runDual(`
    CREATE TABLE IF NOT EXISTS legal_document_countries (
      document_id INTEGER NOT NULL,
      country VARCHAR(10) NOT NULL,
      PRIMARY KEY (document_id, country)
    )
  `);

  // Subprocessor Countries table
  await runDual(`
    CREATE TABLE IF NOT EXISTS subprocessor_countries (
      subprocessor_id INTEGER NOT NULL,
      country VARCHAR(10) NOT NULL,
      PRIMARY KEY (subprocessor_id, country)
    )
  `);

  // Pages table
  await runDual(`
    CREATE TABLE IF NOT EXISTS pages (
      id VARCHAR(255) PRIMARY KEY,
      is_public INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Products table
  await runDual(`
    CREATE TABLE IF NOT EXISTS products (
      slug VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL,
      color VARCHAR(50) NOT NULL,
      status_url VARCHAR(255) NOT NULL
    )
  `);

  // Product General Info table (Office location, contact channels, opening hours)
  await runDual(`
    CREATE TABLE IF NOT EXISTS product_general_info (
      product_slug VARCHAR(255) PRIMARY KEY,
      office_location TEXT,
      contact_info TEXT,
      opening_hours TEXT
    )
  `);

  // Product Legal Documents table
  await runDual(`
    CREATE TABLE IF NOT EXISTS product_legal_documents (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      product_slug VARCHAR(255) NOT NULL,
      document_type VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      effective_date VARCHAR(255),
      version VARCHAR(50),
      is_current INTEGER DEFAULT 0
    )
  `);

  // Product Overrides table
  await runDual(`
    CREATE TABLE IF NOT EXISTS product_overrides (
      product_slug VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255),
      category VARCHAR(255),
      url TEXT
    )
  `);

  // Dashboard Settings table
  await runDual(`
    CREATE TABLE IF NOT EXISTS dashboard_settings (
      \`key\` VARCHAR(255) PRIMARY KEY,
      \`value\` TEXT NOT NULL
    )
  `);

  // Seed default admin if no users exist
  const userCount = await getCount('users');
  if (userCount.count === 0) {
    const rawPassword = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
    const hash = bcrypt.hashSync(rawPassword, 10);
    await runDual('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['security@bjornlunden.com', hash, 'admin']);
    console.log('Created default admin user: security@bjornlunden.com');
    if (!process.env.INITIAL_ADMIN_PASSWORD) {
      console.log(`\n=======================================================\nDEFAULT ADMIN PASSWORD: ${rawPassword}\nSTORE THIS SECURELY. IT WILL NOT BE SHOWN AGAIN.\n=======================================================\n`);
    }
  }

  // Seed default dashboard settings
  const settingsCount = await getCount('dashboard_settings');
  if (settingsCount.count === 0) {
    const initialSettings = [
      ['site_name', 'Bjorn Lunden'],
      ['welcome_message', 'Insights into security, compliance, and policies.'],
      ['pinned_documents', '[]'],
      ['pinned_controls', '[]'],
      ['site_logo', ''],
      ['header_text', 'Trust Center'],
      ['mailto_certifications', 'security@bjornlunden.com'],
      ['mailto_policies', 'security@bjornlunden.com'],
      ['mailto_legal', 'security@bjornlunden.com'],
      ['privacy_notice', ''],
      ['cookie_notice', '']
    ];
    
    for (const [key, value] of initialSettings) {
      await runDual('INSERT IGNORE INTO dashboard_settings (\`key\`, \`value\`) VALUES (?, ?)', [key, value]);
    }
    console.log('Created default dashboard settings');
  }

  // Ensure standard pages are public
  const standardPages = ['dashboard', 'security-overview', 'dpa', 'subprocessors', 'policies', 'certifications', 'controls', 'legal'];
  for (const page of standardPages) {
    await runDual('INSERT IGNORE INTO pages (id, is_public) VALUES (?, 1)', [page]);
  }
  
  // Force dashboard to be public
  try {
    await mysqlPool.query('INSERT INTO pages (id, is_public) VALUES (?, 1) ON DUPLICATE KEY UPDATE is_public = 1', ['dashboard']);
  } catch (mErr) {
    // suppress log
  }

  // Seed default products if none exist
  const productsCount = await getCount('products');
  if (productsCount.count === 0) {
    const initialProducts = [
      { name: "BL Administration", slug: "bl-administration", category: "Knowledge", color: "#BAB649", status_url: "https://status.bjornlunden.se" },
      { name: "Lundify", slug: "lundify", category: "Knowledge", color: "#BAB649", status_url: "https://status.lundify.com" },
      { name: "Lundify Workflow", slug: "lundify-workflow", category: "Workflow", color: "#1F79C3", status_url: "https://status.lundify.com" },
      { name: "Lundify Compliance", slug: "lundify-compliance", category: "Compliance", color: "#279989", status_url: "https://status.lundify.com" },
      { name: "KING Finance", slug: "king-finance", category: "Finance", color: "#FFBB00", status_url: "https://status.kingfinance.com" },
      { name: "KING ERP", slug: "king-erp", category: "Finance", color: "#FFBB00", status_url: "https://status.kingfinance.com" },
      { name: "Qbis", slug: "qbis", category: "Payroll", color: "#4A8B4D", status_url: "https://status.qbis.se" },
      { name: "Eazyproject", slug: "eazyproject", category: "Year-end-reporting", color: "#BAB649", status_url: "https://status.eazyproject.net" }
    ];
    
    for (const p of initialProducts) {
      await runDual('INSERT IGNORE INTO products (slug, name, category, color, status_url) VALUES (?, ?, ?, ?, ?)', [p.slug, p.name, p.category, p.color, p.status_url]);
    }
    console.log('Created default products');
  }

  // Product Security table
  await runDual(`
    CREATE TABLE IF NOT EXISTS product_security (
      product_slug VARCHAR(255) PRIMARY KEY,
      backup TEXT,
      mfa INTEGER,
      encryption TEXT,
      sso INTEGER,
      data_residency VARCHAR(255),
      sla_uptime VARCHAR(50)
    )
  `);

  // Seed default security data if none exist
  const securityCount = await getCount('product_security');
  if (securityCount.count === 0) {
    const initialSecurity = [
      {
        slug: 'bl-administration',
        backup: 'Daily backups with 30-day retention. Point-in-time recovery available.',
        mfa: 1,
        encryption: 'AES-256 at rest, TLS 1.3 in transit.',
        sso: 1,
        data_residency: 'EU (Sweden)',
        sla_uptime: '99.9%'
      },
      {
        slug: 'lundify',
        backup: 'Continuous data protection with snapshots every 4 hours.',
        mfa: 1,
        encryption: 'AES-256 at rest, TLS 1.2+ in transit.',
        sso: 0,
        data_residency: 'EU (Ireland)',
        sla_uptime: '99.9%'
      },
      {
        slug: 'king-finance',
        backup: 'Real-time replication across multiple availability zones.',
        mfa: 1,
        encryption: 'AES-256 at rest, TLS 1.3 in transit.',
        sso: 1,
        data_residency: 'EU (Netherlands)',
        sla_uptime: '99.95%'
      }
    ];
    
    for (const s of initialSecurity) {
      await runDual('INSERT IGNORE INTO product_security (product_slug, backup, mfa, encryption, sso, data_residency, sla_uptime) VALUES (?, ?, ?, ?, ?, ?, ?)', [s.slug, s.backup, s.mfa, s.encryption, s.sso, s.data_residency, s.sla_uptime]);
    }
    console.log('Created default product security data');
  }

  // Product Certification Summary table
  await runDual(`
    CREATE TABLE IF NOT EXISTS product_certification_summary (
      product_slug VARCHAR(255) PRIMARY KEY,
      is_applicable INTEGER NOT NULL DEFAULT 0,
      summary TEXT
    )
  `);

  // Product Certifications table
  await runDual(`
    CREATE TABLE IF NOT EXISTS product_certifications (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      product_slug VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      certificate_url TEXT,
      soa_available INTEGER NOT NULL DEFAULT 0,
      type VARCHAR(50) NOT NULL DEFAULT 'certificate'
    )
  `);

  // Seed default certification data if none exist
  const certSummaryCount = await getCount('product_certification_summary');
  if (certSummaryCount.count === 0) {
    const initialSummaries = [
      {
        slug: 'bl-administration',
        is_applicable: 1,
        summary: 'BL Administration is fully certified against international security standards to ensure the highest level of data protection.'
      },
      {
        slug: 'lundify',
        is_applicable: 1,
        summary: 'Lundify maintains key certifications relevant to knowledge management and data security in the EU.'
      },
      {
        slug: 'king-finance',
        is_applicable: 1,
        summary: 'As a financial platform, KING Finance adheres to strict regulatory and security certification requirements.'
      }
    ];

    for (const s of initialSummaries) {
      await runDual('INSERT IGNORE INTO product_certification_summary (product_slug, is_applicable, summary) VALUES (?, ?, ?)', [s.slug, s.is_applicable, s.summary]);
    }

    const initialCerts = [
      { slug: 'bl-administration', name: 'ISO 27001:2022', url: 'https://example.com/certs/iso27001.pdf', soa: 1, type: 'certificate' },
      { slug: 'bl-administration', name: 'ISO 9001:2015', url: 'https://example.com/certs/iso9001.pdf', soa: 0, type: 'certificate' },
      { slug: 'bl-administration', name: 'SOC 2 Type II', url: 'https://example.com/certs/soc2.pdf', soa: 1, type: 'report' },
      { slug: 'lundify', name: 'ISO 27001:2022', url: 'https://example.com/certs/iso27001.pdf', soa: 1, type: 'certificate' },
      { slug: 'king-finance', name: 'ISO 27001:2022', url: 'https://example.com/certs/iso27001.pdf', soa: 1, type: 'certificate' },
      { slug: 'king-finance', name: 'ISAE 3402', url: 'https://example.com/certs/isae3402.pdf', soa: 1, type: 'report' }
    ];

    for (const c of initialCerts) {
      await runDual('INSERT IGNORE INTO product_certifications (product_slug, name, certificate_url, soa_available, type) VALUES (?, ?, ?, ?, ?)', [c.slug, c.name, c.url, c.soa, c.type]);
    }
    console.log('Created default product certification data');
  }

  // Product Controls table
  await runDual(`
    CREATE TABLE IF NOT EXISTS product_controls (
      product_slug VARCHAR(255) NOT NULL,
      topic_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Implemented',
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (product_slug, topic_id)
    )
  `);

  // Seed default controls data if none exist
  const controlsCount = await getCount('product_controls');
  if (controlsCount.count === 0) {
    const topics = [
      'infrastructure-security',
      'organization-security',
      'internal-security-procedures',
      'ai-security-compliance',
      'product-security',
      'bottom-security-and-privacy'
    ];
    
    try {
      const [productsList] = await mysqlPool.query('SELECT slug FROM products');
      
      for (const p of productsList as any[]) {
        for (const t of topics) {
          let description = '';
          switch(t) {
            case 'infrastructure-security': description = 'Hosted on secure cloud infrastructure with automated patching and monitoring.'; break;
            case 'organization-security': description = 'Security-first culture with dedicated security team and regular audits.'; break;
            case 'internal-security-procedures': description = 'Strict access controls and mandatory security training for all employees.'; break;
            case 'ai-security-compliance': description = 'AI models are vetted for safety and compliance with emerging regulations.'; break;
            case 'product-security': description = 'SDLC includes security reviews, static analysis, and penetration testing.'; break;
            case 'bottom-security-and-privacy': description = 'GDPR compliant data processing with strict data minimization policies.'; break;
          }
          await runDual('INSERT IGNORE INTO product_controls (product_slug, topic_id, status, description) VALUES (?, ?, ?, ?)', [p.slug, t, 'Implemented', description]);
        }
      }
    } catch(err){}
    console.log('Created default product controls data');
  }

  // Product Subprocessors table
  await runDual(`
    CREATE TABLE IF NOT EXISTS product_subprocessors (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      product_slug VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL,
      region VARCHAR(255) NOT NULL,
      purpose TEXT NOT NULL,
      website_url TEXT,
      contact_details TEXT,
      nature_of_processing TEXT,
      data_categories TEXT,
      certifications TEXT
    )
  `);

  try {
    await runDual('ALTER TABLE product_subprocessors ADD COLUMN website_url TEXT');
  } catch (err) { }
  try {
    await runDual('ALTER TABLE product_subprocessors ADD COLUMN contact_details TEXT');
  } catch (err) { }
  try {
    await runDual('ALTER TABLE product_subprocessors ADD COLUMN nature_of_processing TEXT');
  } catch (err) { }
  try {
    await runDual('ALTER TABLE product_subprocessors ADD COLUMN data_categories TEXT');
  } catch (err) { }
  try {
    await runDual('ALTER TABLE product_subprocessors ADD COLUMN certifications TEXT');
  } catch (err) { }
  try {
    await runDual('ALTER TABLE product_subprocessors ADD COLUMN org_number TEXT');
  } catch (err) { }
  try {
    await runDual('ALTER TABLE product_subprocessors ADD COLUMN lei_number TEXT');
  } catch (err) { }
  try {
    await runDual('ALTER TABLE product_subprocessors ADD COLUMN dpa_url TEXT');
  } catch (err) { }
  try {
    await runDual('ALTER TABLE product_subprocessors ADD COLUMN dpa_requestable INTEGER DEFAULT 0');
  } catch (err) { }

  try {
    await runDual('ALTER TABLE product_policies ADD COLUMN is_requestable INTEGER DEFAULT 1');
  } catch (err) { }
  try {
    await runDual('ALTER TABLE product_policies ADD COLUMN effective_date VARCHAR(255)');
  } catch (err) { }
  try {
    await runDual('ALTER TABLE product_policies ADD COLUMN version VARCHAR(50)');
  } catch (err) { }

  try {
    await runDual('ALTER TABLE product_legal_documents ADD COLUMN file_url TEXT');
  } catch (err) { }

  try {
    await runDual('ALTER TABLE metrics_events ADD COLUMN user_email VARCHAR(255)');
  } catch (err) { }

  // Subprocessor History table
  await runDual(`
    CREATE TABLE IF NOT EXISTS subprocessor_history (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      product_slug VARCHAR(255) NOT NULL,
      version VARCHAR(50) NOT NULL,
      date VARCHAR(50) NOT NULL,
      description TEXT NOT NULL
    )
  `);

  // Seed default subprocessor data if none exist
  const subCount = await getCount('product_subprocessors');
  if (subCount.count === 0) {
    const initialSubprocessors = [
      { product_slug: 'bl-administration', name: 'Amazon Web Services', category: 'Hosting', region: 'EU / Sweden', purpose: 'Infrastructure hosting and storage' },
      { product_slug: 'bl-administration', name: 'SendGrid', category: 'Email Services', region: 'EU/US', purpose: 'Transactional email delivery' },
      { product_slug: 'lundify', name: 'Amazon Web Services', category: 'Hosting', region: 'EU / Sweden', purpose: 'Infrastructure hosting and storage' },
      { product_slug: 'lundify', name: 'SendGrid', category: 'Email Services', region: 'EU/US', purpose: 'Transactional email delivery' },
      { product_slug: 'king-finance', name: 'Amazon Web Services', category: 'Hosting', region: 'EU / Sweden', purpose: 'Infrastructure hosting and storage' },
      { product_slug: 'king-finance', name: 'Datadog', category: 'Monitoring', region: 'EU', purpose: 'System monitoring and analytics' }
    ];

    for (const s of initialSubprocessors) {
      await runDual('INSERT IGNORE INTO product_subprocessors (product_slug, name, category, region, purpose) VALUES (?, ?, ?, ?, ?)', [s.product_slug, s.name, s.category, s.region, s.purpose]);
    }

    const initialHistory = [
      { product_slug: 'bl-administration', version: '1.0.0', date: '2025-01-15', description: 'Initial subprocessor list publication.' },
      { product_slug: 'bl-administration', version: '1.1.0', date: '2025-03-10', description: 'Added SendGrid for transactional emails.' },
      { product_slug: 'lundify', version: '1.0.0', date: '2025-02-01', description: 'Initial publication.' },
      { product_slug: 'king-finance', version: '1.0.0', date: '2025-01-01', description: 'Initial publication.' }
    ];

    for (const h of initialHistory) {
      await runDual('INSERT IGNORE INTO subprocessor_history (product_slug, version, date, description) VALUES (?, ?, ?, ?)', [h.product_slug, h.version, h.date, h.description]);
    }
    console.log('Created default subprocessor and history data');
  }

  // Product Policies table
  await runDual(`
    CREATE TABLE IF NOT EXISTS product_policies (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      product_slug VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_requestable INTEGER DEFAULT 1,
      effective_date VARCHAR(255),
      version VARCHAR(50)
    )
  `);

  // Seed default policies if none exist
  const policyCount = await getCount('product_policies');
  if (policyCount.count === 0) {
    const initialPolicies = [
      { slug: 'bl-administration', name: 'Access Control Policy', description: 'Governs how access to systems and data is granted and managed.' },
      { slug: 'bl-administration', name: 'Data Classification Policy', description: 'Defines categories for data and required protection levels.' },
      { slug: 'lundify', name: 'Content Moderation Policy', description: 'Guidelines for managing user-generated content.' },
      { slug: 'king-finance', name: 'Financial Data Security Policy', description: 'Specific controls for handling sensitive financial information.' }
    ];
    for (const p of initialPolicies) {
      await runDual('INSERT IGNORE INTO product_policies (product_slug, name, description) VALUES (?, ?, ?)', [p.slug, p.name, p.description]);
    }
  }

  // Seed default legal documents if none exist
  const legalCount = await getCount('product_legal_documents');
  if (legalCount.count === 0) {
    const initialLegal = [
      { slug: 'bl-administration', type: 'tc', url: 'https://example.com/legal/tos', date: '2025-01-01', version: '2.1.0', current: 1 },
      { slug: 'bl-administration', type: 'privacy', url: 'https://example.com/legal/privacy', date: '2025-02-15', version: '1.4.0', current: 1 },
      { slug: 'lundify', type: 'tc', url: 'https://example.com/legal/lundify-terms', date: '2025-01-01', version: '1.0.0', current: 1 }
    ];
    for (const l of initialLegal) {
      await runDual('INSERT IGNORE INTO product_legal_documents (product_slug, document_type, url, effective_date, version, is_current) VALUES (?, ?, ?, ?, ?, ?)', [l.slug, l.type, l.url, l.date, l.version, l.current]);
    }
  }
  
  // Data fix for legacy document types
  try {
    await runDual('UPDATE product_legal_documents SET document_type = ? WHERE document_type = ?', ['tc', 'Terms of Service']);
    await runDual('UPDATE product_legal_documents SET document_type = ? WHERE document_type = ?', ['tc', 'Terms and Conditions']);
    await runDual('UPDATE product_legal_documents SET document_type = ? WHERE document_type = ?', ['privacy', 'Privacy Notice']);
    await runDual('UPDATE product_legal_documents SET document_type = ? WHERE document_type = ?', ['privacy', 'Privacy Policy']);
    await runDual('UPDATE product_legal_documents SET document_type = ? WHERE document_type = ?', ['tc', 'Terms of Use']);
    
    // Ensure only the most recent document is current per type
    await runDual(`
      UPDATE product_legal_documents 
      SET is_current = 0 
      WHERE is_current = 1 
      AND id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY product_slug, document_type ORDER BY id DESC) as rn
          FROM product_legal_documents
          WHERE is_current = 1
        ) t WHERE rn = 1
      )
    `);
  } catch (err) { }

  // Documents table
  await runDual(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      type VARCHAR(50) NOT NULL,
      category VARCHAR(255),
      requires_nda INTEGER NOT NULL DEFAULT 0,
      url TEXT,
      provider VARCHAR(255),
      findings_status VARCHAR(255),
      products TEXT,
      description TEXT
    )
  `);

  // Seed default documents if none exist
  const docsCount = await getCount('documents');
  if (docsCount.count === 0) {
    const initialDocs = [
      { name: "Security Whitepaper", slug: "security-whitepaper", type: "compliance", category: "Security", requires_nda: 0, products: JSON.stringify(["king-finance","king-erp","lundify","bl-administration"]), url: "https://example.com/docs/security-whitepaper", description: "Comprehensive overview of our security architecture and practices." },
      { name: "Data Processing Agreement", slug: "dpa", type: "compliance", category: "Privacy", requires_nda: 0, products: JSON.stringify([]), url: "https://example.com/docs/dpa", description: "Standard DPA outlining our commitments to data privacy and GDPR compliance." },
      { name: "DPIA – BL Platforms", slug: "dpia-bl", type: "compliance", category: "Privacy", requires_nda: 1, products: JSON.stringify(["bl-administration","lundify"]), url: "https://example.com/docs/dpia", description: "Data Protection Impact Assessment for core platforms." },
      { name: "Pentest – Executive Summary", slug: "pentest-summary", type: "compliance", category: "Pentest", requires_nda: 1, products: JSON.stringify(["king-finance","king-erp"]), url: "https://example.com/docs/pentest-summary", description: "High-level summary of our most recent penetration testing results." },
      { name: "Information Security Policy", slug: "information-security-policy", type: "policy", category: "Security", requires_nda: 0, products: JSON.stringify([]), url: "https://example.com/docs/info-sec-policy", description: "Core policy governing information security across the organization." },
      { name: "Incident Response Plan", slug: "incident-response-plan", type: "policy", category: "Security", requires_nda: 0, products: JSON.stringify([]), url: "https://example.com/docs/incident-response", description: "Procedures and protocols for handling security incidents." },
      { name: "Business Continuity Policy", slug: "business-continuity-policy", type: "policy", category: "Continuity", requires_nda: 0, products: JSON.stringify([]), url: "https://example.com/docs/bcp", description: "Framework for maintaining operations during disruptive events." },
      { name: "Privacy Policy", slug: "privacy-policy", type: "policy", category: "Privacy", requires_nda: 0, products: JSON.stringify([]), url: "https://example.com/docs/privacy-policy", description: "Details on how we collect, use, and protect personal data." },
      { name: "Pentest 2025 – Summary", slug: "pentest-2025-summary", type: "pentest", provider: "External Security Partner", findings_status: "Closed", requires_nda: 1, products: JSON.stringify(["king-finance","king-erp"]), url: "https://example.com/docs/pentest-2025", description: "Detailed executive summary of the 2025 annual penetration test." },
      { name: "API Security Audit – Lundify", slug: "api-audit-lundify", type: "pentest", provider: "External Security Partner", findings_status: "No Critical", requires_nda: 1, products: JSON.stringify(["lundify","lundify-workflow"]), url: "https://example.com/docs/api-audit", description: "Targeted security audit of public-facing APIs." }
    ];

    for (const d of initialDocs) {
      await runDual(`
        INSERT IGNORE INTO documents (name, slug, type, category, requires_nda, url, provider, findings_status, products, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [d.name, d.slug, d.type, d.category, d.requires_nda, d.url, d.provider, d.findings_status, d.products, d.description]);
    }
    console.log('Created default documents');
  }

  // Metrics table
  await runDual(`
    CREATE TABLE IF NOT EXISTS metrics_events (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      event_type VARCHAR(255) NOT NULL,
      product_slug VARCHAR(255) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
