import express from 'express';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import { pool, initDb, mysqlPool } from './server/db.js';
import authRoutes from './server/routes/auth.js';
import adminRoutes from './server/routes/admin.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database
  try {
    console.log('Starting database initialization...');
    await initDb();
    console.log('Database initialization completed successfully.');
  } catch (error) {
    console.error('Database initialization failed:', error);
    // Continue starting the server even if DB init fails, 
    // but routes might fail later.
  }

  app.use(express.json());
  app.use(cookieParser());

  // Serve static files from public directory
  app.use('/uploads', express.static('public/uploads'));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);

  app.get('/api/public/pages', async (req, res) => {
    try {
      const [pages]: any = await pool.query('SELECT id, is_public FROM pages WHERE is_public = 1');
      res.json(pages.map((p: any) => p.id));
    } catch (err) {
      console.error('Error fetching public pages:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/products', async (req, res) => {
    try {
      const country = req.query.country;
      let query = `
        SELECT p.slug, p.name, p.category, p.color, p.status_url, pcs.is_applicable
        FROM products p
        LEFT JOIN product_certification_summary pcs ON p.slug = pcs.product_slug
      `;
      const params: any[] = [];
      if (country) {
        query += ` JOIN product_countries pc ON p.slug = pc.product_slug WHERE pc.country = ?`;
        params.push(country);
      }
      const [products]: any = await pool.query(query, params);
      
      // Fetch countries for all products
      const [countries]: any = await pool.query('SELECT product_slug, country FROM product_countries');
      
      const productsWithCountries = products.map((p: any) => ({
        ...p,
        countries: countries.filter((c: any) => c.product_slug === p.slug).map((c: any) => c.country)
      }));
      
      res.json(productsWithCountries);
    } catch (err) {
      console.error('Error fetching public products:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-overrides', async (req, res) => {
    try {
      const [overrides]: any = await pool.query('SELECT product_slug, name, category, url FROM product_overrides');
      res.json(overrides);
    } catch (err) {
      console.error('Error fetching product overrides:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-security/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [security]: any = await pool.query('SELECT * FROM product_security WHERE product_slug = ?', [slug]);
      res.json(security[0] || null);
    } catch (err) {
      console.error('Error fetching product security:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-general/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [generalRows]: any = await pool.query('SELECT * FROM product_general_info WHERE product_slug = ?', [slug]);
      res.json(generalRows[0] || null);
    } catch (err) {
      console.error('Error fetching product general info:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-whitepaper/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const country = req.query.country as string;
      
      const [productRows]: any = await pool.query('SELECT * FROM products WHERE slug = ?', [slug]);
      if (!productRows || productRows.length === 0) {
        return res.status(404).send('<h1>Product Not Found</h1>');
      }
      const product = productRows[0];

      const [generalRows]: any = await pool.query('SELECT * FROM product_general_info WHERE product_slug = ?', [slug]);
      const general = generalRows[0] || {};

      const [securityRows]: any = await pool.query('SELECT * FROM product_security WHERE product_slug = ?', [slug]);
      const security = securityRows[0] || {};

      const [certSummaryRows]: any = await pool.query('SELECT * FROM product_certification_summary WHERE product_slug = ?', [slug]);
      const certSummary = certSummaryRows[0] || {};

      const [certs]: any = await pool.query('SELECT * FROM product_certifications WHERE product_slug = ?', [slug]);
      const [controls]: any = await pool.query('SELECT * FROM product_controls WHERE product_slug = ?', [slug]);
      const [policies]: any = await pool.query('SELECT * FROM product_policies WHERE product_slug = ?', [slug]);

      // Filter legal documents by selected country if query parameter is provided
      let legalDocsQuery = 'SELECT * FROM product_legal_documents WHERE product_slug = ? ORDER BY effective_date DESC';
      const [legalDocs]: any = await pool.query(legalDocsQuery, [slug]);

      // Fetch subprocessors with country filtering if query parameter is provided
      let querySub = 'SELECT * FROM product_subprocessors WHERE product_slug = ?';
      const paramsSub: any[] = [slug];
      if (country && country !== 'all') {
        querySub = `
          SELECT s.*
          FROM product_subprocessors s
          JOIN subprocessor_countries sc ON s.id = sc.subprocessor_id
          WHERE s.product_slug = ? AND sc.country = ?
        `;
        paramsSub.push(country);
      }
      const [subprocessors]: any = await pool.query(querySub, paramsSub);

      // Fetch countries for all subprocessors
      const [subCountries]: any = await pool.query('SELECT subprocessor_id, country FROM subprocessor_countries');
      const subprocessorsWithCountries = subprocessors.map((s: any) => ({
        ...s,
        countries: subCountries.filter((c: any) => c.subprocessor_id === s.id).map((c: any) => c.country)
      }));

      // fetch custom dashboard/site branding settings
      const [settingsRows]: any = await pool.query('SELECT "key", "value" FROM dashboard_settings');
      const settings: any = {};
      for (const s of settingsRows as any[]) {
        try {
          settings[s.key] = JSON.parse(s.value);
        } catch (e) {
          settings[s.key] = s.value;
        }
      }

      const siteName = settings.site_name || 'Bjorn Lunden';
      const siteLogo = settings.site_logo || '';

      // helpers
      const formatTopicName = (id: string) => {
        return id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      };

      const getLegalDocName = (type: string) => {
        const mapping: Record<string, string> = {
          'tc': 'Terms and Conditions',
          'privacy': 'Privacy Notice',
          'dpa': 'Data Protection Agreement (DPA)',
          'exit': 'Data Exit Strategy Addendum',
          'sla': 'Service Level Agreement (SLA)'
        };
        return mapping[type] || type;
      };

      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="paper-size" content="A4">
  <title>${product.name} - Compliance &amp; Security Whitepaper</title>
  
  <!-- Typography CDN -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">

  <style>
    /* Absolute Base Styling for screen & print */
    :root {
      --primary: #1B3A6B;
      --primary-light: #2c5282;
      --accent-blue: #D0D8E4;
      --text-dark: #0f172a;
      --text-muted: #475569;
      --border-color: #D0D8E4;
      --bg-light: #F4F7FB;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #f1f5f9;
      color: var(--text-dark);
      font-family: 'Inter', sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Screen view wrapping */
    .screen-wrapper {
      max-width: 900px;
      margin: 40px auto;
      background: transparent;
      padding: 0;
    }

    /* Print Controls */
    .screen-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background-color: var(--primary);
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background-color 0.15s ease;
    }

    .btn-print:hover {
      background-color: var(--primary-light);
    }

    .btn-back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }

    .btn-back:hover {
      color: var(--primary);
    }

    /* Standard A4 Flowing Page Container */
    .paper-page {
      background: #ffffff;
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      margin: 30px auto;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
      border-radius: 4px;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    /* Typographic definitions */
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 26pt;
      font-weight: 700;
      color: var(--primary);
      line-height: 1.2;
      margin-bottom: 8px;
    }

    h2 {
      font-family: 'Playfair Display', serif;
      font-size: 16pt;
      font-weight: 700;
      color: var(--primary);
      border-b: 1px solid var(--border-color);
      padding-bottom: 4px;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }

    h3 {
      font-family: 'Inter', sans-serif;
      font-size: 11pt;
      font-weight: 600;
      color: var(--primary);
      margin-top: 12px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    p {
      margin-bottom: 10px;
    }

    /* Logo block */
    .cover-band {
      background-color: var(--bg-light);
      border-left: 6px solid var(--primary);
      padding: 24px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .two-column-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 15px 0;
    }

    .control-card {
      border: 1px solid var(--border-color);
      padding: 12px;
      border-radius: 6px;
      background-color: #fafbfc;
    }

    .control-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }

    .control-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: var(--primary);
    }

    .control-badge {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 3px;
      white-space: nowrap;
    }

    .badge-implemented {
      background-color: #e6fffa;
      color: #234e52;
    }

    .badge-partial {
      background-color: #feebc8;
      color: #744210;
    }

    .badge-not-implemented {
      background-color: #fed7d7;
      color: #742a2a;
    }

    .control-desc {
      font-size: 8.5pt;
      color: var(--text-dark);
      line-height: 1.4;
    }

    /* Table Styling */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 9pt;
    }

    th {
      background-color: var(--primary);
      color: #ffffff;
      font-weight: 600;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid var(--primary);
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.05em;
    }

    td {
      padding: 8px 10px;
      border: 1px solid var(--border-color);
      color: var(--text-dark);
      background-color: #ffffff;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Footer structure */
    .page-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      border-top: 1px solid var(--border-color);
      padding-top: 12px;
      font-size: 8.5pt;
      color: var(--text-muted);
    }

    /* CSS Print Block running header */
    .print-official-header {
      display: none;
    }

    @media print {
      .print-official-header {
        display: block !important;
        width: 100%;
        border-bottom: 2px solid var(--primary);
        padding-bottom: 8px;
        margin-bottom: 20px;
        font-family: 'Inter', sans-serif;
      }
      .print-official-header .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .print-official-header .company-name {
        font-size: 14pt !important;
        font-weight: 700 !important;
        text-transform: uppercase;
        color: var(--primary);
        letter-spacing: 0.1em;
      }
      .print-official-header .doc-reference {
        font-size: 8.5pt !important;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 600;
      }
    }

    /* PRINT ONLY MEDIA BLOCK */
    @media print {
      body {
        background-color: #ffffff !important;
        color: #000000 !important;
        width: auto;
        height: auto;
      }

      .screen-controls {
        display: none !important;
      }

      .screen-wrapper {
        max-width: 100% !important;
        margin: 0 !important;
      }

      /* Native margin allocation */
      @page {
        size: A4 portrait;
        margin: 20mm;
      }

      .paper-page {
        width: 100% !important;
        min-height: 0 !important;
        height: auto !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        background: transparent !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
      }

      /* Orphan heading protections */
      h1, h2, h3, h4 {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      tr, .two-column-block, table, .control-card {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .cover-band {
        background-color: var(--bg-light) !important;
        border-left: 6px solid var(--primary) !important;
      }
    }
  </style>
</head>
<body>

  <div class="screen-wrapper">
    <!-- Browser-Only Top Controls -->
    <div class="screen-controls">
      <a href="/product/${slug}" class="btn-back">
        ← Back to ${product.name} Registry
      </a>
      <button onclick="window.print()" class="btn-print">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / Save as PDF
      </button>
    </div>

    <div class="paper-page">
      <!-- Official PDF Document Running Header (visible during print) -->
      <div class="print-official-header">
        <div class="header-content">
          <span class="company-name">${siteName}</span>
          <span class="doc-reference">Official Security &amp; Compliance Whitepaper</span>
        </div>
      </div>

      <!-- Subtle Background Block / Corporate Header -->
      <div class="cover-band" style="position: relative;">
        ${siteLogo ? `
        <div style="position: absolute; top: 18px; right: 24px; display: flex; align-items: center; justify-content: flex-end;">
          <img src="${siteLogo}" alt="${siteName} Logo" style="max-height: 48px; max-width: 140px; object-fit: contain;" referrerPolicy="no-referrer" />
        </div>
        ` : ''}
        <div style="font-size: 8.5pt; font-weight: 700; letter-spacing: 0.15em; color: var(--primary); margin-bottom: 8px; max-width: 75%;">${siteName.toUpperCase()}</div>
        <h1 style="max-width: 75%;">${product.name}</h1>
        <div style="font-size: 12pt; font-weight: 500; color: var(--text-muted); margin-top: 4px; max-width: 75%;">${product.category || 'Compliance &amp; Security Registry'}</div>
      </div>

      <!-- General & Office Overview -->
      <section style="margin-top: 10px;">
        <h2>General &amp; Office Overview</h2>
        <div class="two-column-block" style="grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin: 4px 0 16px 0;">
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 4px;">Office Location</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.4; text-align: left; whitespace: pre-wrap;">
              ${general.office_location || '<span style="color: #94a3b8; font-style: italic;">No office location listed.</span>'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 4px;">Contact Channels</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.4; text-align: left; whitespace: pre-wrap;">
              ${general.contact_info || '<span style="color: #94a3b8; font-style: italic;">No contact information listed.</span>'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 4px;">Opening Hours</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.4; text-align: left; whitespace: pre-wrap;">
              ${general.opening_hours || '<span style="color: #94a3b8; font-style: italic;">No opening hours listed.</span>'}
            </p>
          </div>
        </div>
      </section>

      <!-- Security Overview Section -->
      <section style="margin-top: 10px;">
        <h2>Security Overview</h2>
        <div class="two-column-block" style="margin-top: 10px; gap: 12px;">
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">Backup &amp; Recovery</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.backup || 'No information provided.'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">Multi-Factor Authentication (MFA)</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.mfa === 1 || security.mfa === true || security.mfa === '1' ? 'Supported' : 'Not Supported'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">Encryption</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.encryption || 'No information provided.'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">Single Sign-On (SSO)</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.sso === 1 || security.sso === true || security.sso === '1' ? 'Supported' : 'Not Supported'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">Data Residency</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.data_residency || 'No information provided.'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">SLA Uptime</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.sla_uptime || 'No information provided.'}
            </p>
          </div>
        </div>
      </section>

      <!-- Controls Section -->
      <section style="margin-top: 15px;">
        <h2>Controls</h2>
        ${controls && controls.length > 0 ? `
          <div class="two-column-block" style="gap: 12px;">
            ${controls.map((ctrl: any) => `
              <div class="control-card">
                <div class="control-header">
                  <span class="control-title">${formatTopicName(ctrl.topic_id)}</span>
                  <span class="control-badge ${
                    ctrl.status === 'Implemented' ? 'badge-implemented' : 
                    ctrl.status === 'Partial' ? 'badge-partial' : 
                    'badge-not-implemented'
                  }">
                    ${ctrl.status}
                  </span>
                </div>
                <p class="control-desc" style="margin-bottom: 0;">
                  ${ctrl.description || 'No description provided.'}
                </p>
              </div>
            `).join('')}
          </div>
        ` : `
          <p style="font-size: 9pt; color: var(--text-muted); font-style: italic;">No controls listed.</p>
        `}
      </section>

      <!-- Certifications & Reports Section -->
      <section style="margin-top: 15px;">
        <h2>Certifications &amp; Reports</h2>
        ${certs && certs.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Certification / Report</th>
                <th style="width: 50%;">Issuer</th>
              </tr>
            </thead>
            <tbody>
              ${certs.map((cert: any) => `
                <tr>
                  <td><strong>${cert.name}</strong></td>
                  <td>${cert.issuer || '<span style="color: #94a3b8; font-style: italic;">Not specified</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <p style="font-size: 9pt; color: var(--text-muted); font-style: italic;">No certifications or reports listed.</p>
        `}
      </section>

      <!-- Policies Section -->
      <section style="margin-top: 15px;">
        <h2>Policies</h2>
        ${policies && policies.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 70%;">Policy Name</th>
                <th style="width: 30%;">Version</th>
              </tr>
            </thead>
            <tbody>
              ${policies.map((pol: any) => `
                <tr>
                  <td><strong>${pol.name}</strong></td>
                  <td>${pol.version || '<span style="color: #94a3b8; font-style: italic;">Not specified</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <p style="font-size: 9pt; color: var(--text-muted); font-style: italic;">No policies listed.</p>
        `}
      </section>

      <!-- Legal Documents Section -->
      <section style="margin-top: 15px;">
        <h2>Legal Documents</h2>
        ${legalDocs && legalDocs.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 70%;">Document</th>
                <th style="width: 30%;">Version</th>
              </tr>
            </thead>
            <tbody>
              ${legalDocs.map((doc: any) => `
                <tr>
                  <td><strong>${getLegalDocName(doc.document_type)}</strong></td>
                  <td>${doc.version || '<span style="color: #94a3b8; font-style: italic;">Not specified</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <p style="font-size: 9pt; color: var(--text-muted); font-style: italic;">No legal documents listed.</p>
        `}
      </section>

      <!-- Subprocessors Section -->
      <section style="margin-top: 15px;">
        <h2>Subprocessors &amp; Data Processors</h2>
        ${subprocessorsWithCountries && subprocessorsWithCountries.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Identity</th>
                <th style="width: 15%;">Location</th>
                <th style="width: 20%;">Nature of Processing</th>
                <th style="width: 20%;">Purpose</th>
                <th style="width: 20%;">Certifications</th>
              </tr>
            </thead>
            <tbody>
              ${subprocessorsWithCountries.map((sub: any) => `
                <tr>
                  <td>
                    <strong>${sub.name}</strong>
                    ${sub.contact_details ? `<div style="font-size: 8pt; color: var(--text-muted); margin-top: 4px;">${sub.contact_details}</div>` : ''}
                  </td>
                  <td>
                    ${sub.region}
                    ${sub.countries && sub.countries.length > 0 ? `<div style="font-size: 8pt; color: var(--text-muted); margin-top: 2px;">${sub.countries.join(', ').toUpperCase()}</div>` : ''}
                  </td>
                  <td>${sub.nature_of_processing || sub.category || 'Not specified'}</td>
                  <td>${sub.purpose || 'Not specified'}</td>
                  <td>${sub.certifications || '<span style="color: #94a3b8; font-style: italic;">None</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <p style="font-size: 9pt; color: var(--text-muted); font-style: italic;">No subprocessors or data processors listed.</p>
        `}
      </section>

      <!-- Page Footer -->
      <footer class="page-footer" style="margin-top: auto;">
        <span>${product.name} Compliance &amp; Security | ${siteName}</span>
        <span>Generated: ${dateStr}</span>
      </footer>
    </div>
  </div>

</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      console.error('Error generating product whitepaper:', err);
      res.status(500).send('<h1>Internal Server Error</h1><p>Failed to generate white paper.</p>');
    }
  });

  app.get('/api/public/product-certifications/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [summaryRows]: any = await pool.query('SELECT * FROM product_certification_summary WHERE product_slug = ?', [slug]);
      const [certifications]: any = await pool.query('SELECT * FROM product_certifications WHERE product_slug = ?', [slug]);
      res.json({ summary: summaryRows[0] || null, certifications });
    } catch (err) {
      console.error('Error fetching product certifications:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-controls/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [controls]: any = await pool.query('SELECT * FROM product_controls WHERE product_slug = ?', [slug]);
      res.json(controls);
    } catch (err) {
      console.error('Error fetching product controls:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-subprocessors/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const country = req.query.country;
      let querySub = 'SELECT * FROM product_subprocessors WHERE product_slug = ?';
      let queryHist = 'SELECT * FROM subprocessor_history WHERE product_slug = ? ORDER BY date DESC';
      const paramsSub: any[] = [slug];
      const paramsHist: any[] = [slug];
      
      if (country) {
        querySub = `
          SELECT s.*
          FROM product_subprocessors s
          JOIN subprocessor_countries sc ON s.id = sc.subprocessor_id
          WHERE s.product_slug = ? AND sc.country = ?
        `;
        paramsSub.push(country);
      }
      
      const [subprocessors]: any = await pool.query(querySub, paramsSub);
      const [history]: any = await pool.query(queryHist, paramsHist);
      
      // Fetch countries for subprocessors
      const [countries]: any = await pool.query('SELECT subprocessor_id, country FROM subprocessor_countries');
      
      const subprocessorsWithCountries = subprocessors.map((s: any) => ({
        ...s,
        countries: countries.filter((c: any) => c.subprocessor_id === s.id).map((c: any) => c.country)
      }));

      res.json({ subprocessors: subprocessorsWithCountries, history });
    } catch (err) {
      console.error('Error fetching product subprocessors:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-legal/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const country = req.query.country;
      const query = 'SELECT * FROM product_legal_documents WHERE product_slug = ? ORDER BY effective_date DESC';
      const [documents]: any = await pool.query(query, [slug]);
      
      res.json(documents);
    } catch (err) {
      console.error('Error fetching product legal documents:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-policies/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [policies]: any = await pool.query('SELECT * FROM product_policies WHERE product_slug = ?', [slug]);
      res.json(policies);
    } catch (err) {
      console.error('Error fetching product policies:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/public/metrics/track', async (req, res) => {
    try {
      const { event_type, product_slug, item_name, user_email } = req.body;
      if (!event_type || !product_slug) {
        return res.status(400).json({ error: 'event_type and product_slug are required' });
      }
      
      await pool.query(
        'INSERT INTO metrics_events (event_type, product_slug, item_name, user_email) VALUES (?, ?, ?, ?)',
        [event_type, product_slug, item_name || '', user_email || null]
      );
      
      res.json({ success: true });
    } catch (err) {
      console.error('Error tracking metric:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/dashboard-documents', async (req, res) => {
    try {
      const unifiedDocs: any[] = [];
      
      const [docs]: any = await pool.query('SELECT * FROM documents');
      for (const d of docs) {
        if (!d.url && (d.requires_nda === 0 || d.requires_nda === false || d.requires_nda === '0')) continue;
        unifiedDocs.push({
          id: `doc-${d.id}`,
          slug: d.slug,
          name: d.name,
          type: d.type || 'Document',
          category: d.category || 'General',
          requires_nda: d.requires_nda,
          products: JSON.parse(d.products || '[]'),
          url: d.url,
          description: d.description,
          source: 'document'
        });
      }

      const [policies]: any = await pool.query('SELECT * FROM product_policies');
      for (const p of policies) {
        if (p.is_requestable !== 1 && p.is_requestable !== true && p.is_requestable !== '1') continue;
        unifiedDocs.push({
          id: `pol-${p.id}`,
          slug: `policy-${p.id}`,
          name: p.name,
          type: 'Policy',
          category: 'Policy',
          requires_nda: p.is_requestable === 1 ? 1 : 0,
          products: [p.product_slug],
          url: null,
          description: p.description,
          source: 'policy'
        });
      }

      const [legal]: any = await pool.query('SELECT * FROM product_legal_documents');
      for (const l of legal) {
        if (!l.url && !l.file_url) continue;
        unifiedDocs.push({
          id: `leg-${l.id}`,
          slug: `legal-${l.id}`,
          name: l.name || (l.document_type === 'tc' ? 'Terms & Conditions' : l.document_type === 'privacy' ? 'Privacy Policy' : 'Legal Document'),
          type: l.document_type === 'tc' ? 'Terms & Conditions' : l.document_type === 'privacy' ? 'Privacy Policy' : l.document_type,
          category: 'Legal',
          requires_nda: 0,
          products: [l.product_slug],
          url: l.file_url || l.url,
          description: `Version ${l.version || '1.0'}`,
          source: 'legal'
        });
      }

      const [dpa]: any = await pool.query('SELECT * FROM product_subprocessors WHERE dpa_url IS NOT NULL OR dpa_requestable = 1');
      for (const a of dpa) {
        unifiedDocs.push({
          id: `dpa-${a.id}`,
          slug: `dpa-${a.id}`,
          name: `DPA - ${a.name}`,
          type: 'DPA Addendum',
          category: 'Legal',
          requires_nda: a.dpa_requestable === 1 ? 1 : 0,
          products: [a.product_slug],
          url: a.dpa_url,
          description: `Data Processing Agreement for ${a.name}`,
          source: 'dpa'
        });
      }

      res.json(unifiedDocs);
    } catch (err) {
      console.error('Error fetching dashboard documents:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/documents', async (req, res) => {
    try {
      const [documents]: any = await pool.query('SELECT * FROM documents');
      res.json(documents.map((d: any) => ({
        ...d,
        products: JSON.parse(d.products || '[]')
      })));
    } catch (err) {
      console.error('Error fetching public documents:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/latest-controls', async (req, res) => {
    try {
      const [controls]: any = await pool.query(`
        SELECT pc.*, p.name as product_name 
        FROM product_controls pc
        JOIN products p ON pc.product_slug = p.slug
        ORDER BY pc.updated_at DESC
        LIMIT 3
      `);
      res.json(controls);
    } catch (err) {
      console.error('Error fetching latest controls:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/all-controls', async (req, res) => {
    try {
      const [controls]: any = await pool.query(`
        SELECT pc.*, p.name as product_name 
        FROM product_controls pc
        JOIN products p ON pc.product_slug = p.slug
        ORDER BY pc.updated_at DESC
      `);
      res.json(controls);
    } catch (err) {
      console.error('Error fetching all controls:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/dashboard-settings', async (req, res) => {
    try {
      const [settings]: any = await pool.query('SELECT "key", "value" FROM dashboard_settings');
      const result: any = {};
      for (const s of settings as any[]) {
        try {
          result[s.key] = JSON.parse(s.value);
        } catch (e) {
          result[s.key] = s.value;
        }
      }
      res.json(result);
    } catch (err) {
      console.error('Error fetching dashboard settings:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/health', async (req, res) => {
    const status: any = { status: 'ok', databases: { mariadb: 'unknown' } };
    
    if (mysqlPool) {
      try {
        await mysqlPool.query('SELECT 1');
        status.databases.mariadb = 'connected';
      } catch (err) {
        status.databases.mariadb = 'error';
      }
    } else if (process.env.DB_HOST) {
      status.databases.mariadb = 'failed_to_initialize';
    } else {
      status.databases.mariadb = 'not_configured';
    }

    res.json(status);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
