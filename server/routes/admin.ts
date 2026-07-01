import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../db.js';
import { getJwtSecret } from '../utils/secret.js';
import { csrfProtection } from '../middleware/csrf.js';

const router = express.Router();
const JWT_SECRET = getJwtSecret();

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed (jpeg, jpg, png, webp)'));
  }
});

const storagePdf = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadPdf = multer({ 
  storage: storagePdf,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype === 'application/pdf';
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only PDF files are allowed'));
  }
});

// Middleware to check if admin or moderator
const requireAdminOrMod = (req: any, res: any, next: any) => {
  let token = req.cookies.token;
  
  // Prefer Authorization header if present, as it's more reliable in iframes
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      const headerToken = authHeader.substring(7);
      if (headerToken && headerToken !== 'undefined' && headerToken !== 'null') {
        token = headerToken;
      }
    }
  }

  // Sanitize token
  if (token === 'undefined' || token === 'null') {
    token = null;
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role !== 'admin' && decoded.role !== 'moderator') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name !== 'TokenExpiredError') {
      console.error('Admin Middleware - JWT Verify Error:', err.message);
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(csrfProtection);
router.use(requireAdminOrMod);

// Get all users
router.get('/users', async (req: any, res) => {
  const [users]: any = await pool.query('SELECT id, username, role FROM users');
  
  const viewerIds = users.filter((u: any) => u.role === 'viewer').map((u: any) => u.id);
  
  if (viewerIds.length > 0) {
    const placeholders = viewerIds.map(() => '?').join(',');
    const [allModules]: any = await pool.query(`SELECT user_id, module_id FROM user_modules WHERE user_id IN (${placeholders})`, viewerIds);
    const [allProducts]: any = await pool.query(`SELECT user_id, product_slug FROM user_products WHERE user_id IN (${placeholders})`, viewerIds);
    
    const modulesByUserId = allModules.reduce((acc: any, row: any) => {
      acc[row.user_id] = acc[row.user_id] || [];
      acc[row.user_id].push(row.module_id);
      return acc;
    }, {});
    
    const productsByUserId = allProducts.reduce((acc: any, row: any) => {
      acc[row.user_id] = acc[row.user_id] || [];
      acc[row.user_id].push(row.product_slug);
      return acc;
    }, {});
    
    for (const user of users) {
      if (user.role === 'viewer') {
        user.allowedModules = modulesByUserId[user.id] || [];
        user.allowedProducts = productsByUserId[user.id] || [];
      }
    }
  }
  
  res.json(users);
});

// Create a user
router.post('/users', async (req: any, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'Missing fields' });

  // Password validation: at least 12 chars, 1 uppercase, 1 number, 1 special character
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ 
      error: 'Password must be at least 12 characters long and contain at least one uppercase letter, one number, and one special character.' 
    });
  }

  // Only admins can create other admins or moderators
  if (req.user.role !== 'admin' && role !== 'viewer') {
    return res.status(403).json({ error: 'Moderators can only create viewers' });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const [info]: any = await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, role]);
    res.json({ id: info.insertId, username, role });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete a user
router.delete('/users/:id', async (req: any, res) => {
  const id = req.params.id;
  if (id == req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

  const [targetUserRows]: any = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
  const targetUser = targetUserRows[0];
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  if (req.user.role !== 'admin' && targetUser.role !== 'viewer') {
    return res.status(403).json({ error: 'Moderators can only delete viewers' });
  }

  await pool.query('DELETE FROM users WHERE id = ?', [id]);
  res.json({ success: true });
});

// Update user permissions (modules and products)
router.put('/users/:id/permissions', async (req: any, res) => {
  const id = req.params.id;
  const { allowedModules, allowedProducts } = req.body;

  const [targetUserRows]: any = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
  const targetUser = targetUserRows[0];
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  if (targetUser.role !== 'viewer') return res.status(400).json({ error: 'Permissions only apply to viewers' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_modules WHERE user_id = ?', [id]);
    await conn.query('DELETE FROM user_products WHERE user_id = ?', [id]);

    if (Array.isArray(allowedModules) && allowedModules.length > 0) {
      const values = allowedModules.flatMap(mod => [id, mod]);
      const placeholders = allowedModules.map(() => '(?, ?)').join(', ');
      await conn.query(`INSERT INTO user_modules (user_id, module_id) VALUES ${placeholders}`, values);
    }

    if (Array.isArray(allowedProducts) && allowedProducts.length > 0) {
      const values = allowedProducts.flatMap(prod => [id, prod]);
      const placeholders = allowedProducts.map(() => '(?, ?)').join(', ');
      await conn.query(`INSERT INTO user_products (user_id, product_slug) VALUES ${placeholders}`, values);
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ error: 'Database error' });
  } finally {
    conn.release();
  }
});

// Get public pages status
router.get('/pages', async (req, res) => {
  const [pages]: any = await pool.query('SELECT id, is_public FROM pages');
  res.json(pages);
});

// Set page public status
router.put('/pages/:id', async (req, res) => {
  const id = req.params.id;
  const { is_public } = req.body;
  
  try {
    await pool.query('INSERT INTO pages (id, is_public) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET is_public = excluded.is_public', [id, is_public ? 1 : 0]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Toggle public page error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update product override
router.put('/product-overrides/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { name, category, url } = req.body;
  
  await pool.query('INSERT INTO product_overrides (product_slug, name, category, url) VALUES (?, ?, ?, ?) ON CONFLICT(product_slug) DO UPDATE SET name = excluded.name, category = excluded.category, url = excluded.url', [slug, name, category, url]);
  res.json({ success: true });
});

// Update product
router.put('/products/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { name, category, url, color, countries } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result]: any = await conn.query('UPDATE products SET name = ?, category = ?, status_url = ?, color = ? WHERE slug = ?', [name, category, url, color, slug]);
    
    await conn.query('DELETE FROM product_countries WHERE product_slug = ?', [slug]);
    if (Array.isArray(countries) && countries.length > 0) {
      const values = countries.flatMap(c => [slug, c]);
      const placeholders = countries.map(() => '(?, ?)').join(', ');
      await conn.query(`INSERT INTO product_countries (product_slug, country) VALUES ${placeholders}`, values);
    }
    
    await conn.commit();
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Update product error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Update product general info (Contact info, office location, opening hours)
router.put('/product-general/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { office_location, contact_info, opening_hours } = req.body;
  
  try {
    await pool.query(
      'INSERT INTO product_general_info (product_slug, office_location, contact_info, opening_hours) VALUES (?, ?, ?, ?) ON CONFLICT(product_slug) DO UPDATE SET office_location = excluded.office_location, contact_info = excluded.contact_info, opening_hours = excluded.opening_hours',
      [slug, office_location || '', contact_info || '', opening_hours || '']
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update product general info error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Create product
router.post('/products', async (req, res) => {
  const { name, slug, category, url, color, countries } = req.body;
  
  if (!slug) return res.status(400).json({ error: 'Slug is required' });
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('INSERT INTO products (slug, name, category, status_url, color) VALUES (?, ?, ?, ?, ?)', [slug, name || '', category || '', url || '', color || '#000000']);
    
    if (Array.isArray(countries) && countries.length > 0) {
      const values = countries.flatMap(c => [slug, c]);
      const placeholders = countries.map(() => '(?, ?)').join(', ');
      await conn.query(`INSERT INTO product_countries (product_slug, country) VALUES ${placeholders}`, values);
    }
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Create product error:', err);
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Product slug already exists' });
    }
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Delete product
router.delete('/products/:slug', async (req, res) => {
  const slug = req.params.slug;
  
  try {
    await pool.query('DELETE FROM products WHERE slug = ?', [slug]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update product security info
router.put('/product-security/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { backup, mfa, encryption, sso, data_residency, sla_uptime } = req.body;
  
  try {
    await pool.query(`
      INSERT INTO product_security (product_slug, backup, mfa, encryption, sso, data_residency, sla_uptime) 
      VALUES (?, ?, ?, ?, ?, ?, ?) 
      ON CONFLICT(product_slug) DO UPDATE SET backup = excluded.backup, mfa = excluded.mfa, encryption = excluded.encryption, sso = excluded.sso, data_residency = excluded.data_residency, sla_uptime = excluded.sla_uptime
    `, [slug, backup, mfa ? 1 : 0, encryption, sso ? 1 : 0, data_residency, sla_uptime || '']);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update product security error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update product certification summary
router.put('/product-certifications/:slug/summary', async (req, res) => {
  const slug = req.params.slug;
  const { is_applicable, summary } = req.body;
  
  try {
    await pool.query('INSERT INTO product_certification_summary (product_slug, is_applicable, summary) VALUES (?, ?, ?) ON CONFLICT(product_slug) DO UPDATE SET is_applicable = excluded.is_applicable, summary = excluded.summary', [slug, is_applicable ? 1 : 0, summary]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update certification summary error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Add a certification
router.post('/product-certifications/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { name, certificate_url, soa_available, type } = req.body;
  
  try {
    await pool.query('INSERT INTO product_certifications (product_slug, name, certificate_url, soa_available, type) VALUES (?, ?, ?, ?, ?)', [slug, name, certificate_url, soa_available ? 1 : 0, type || 'certificate']);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Add certification error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Delete a certification
router.delete('/product-certifications/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM product_certifications WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete certification error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Add a legal document version
router.post('/product-legal/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { document_type, url, file_url, effective_date, version, is_current } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (is_current) {
      await conn.query('UPDATE product_legal_documents SET is_current = 0 WHERE product_slug = ? AND document_type = ?', [slug, document_type]);
    }
    await conn.query(`
      INSERT INTO product_legal_documents (product_slug, document_type, url, file_url, effective_date, version, is_current)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [slug, document_type, url || '', file_url || null, effective_date || null, version || null, is_current ? 1 : 0]);
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Add legal document error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Update a legal document version
router.put('/product-legal/:id', async (req, res) => {
  const id = req.params.id;
  const { url, file_url, effective_date, version, is_current, product_slug, document_type } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (is_current) {
      await conn.query('UPDATE product_legal_documents SET is_current = 0 WHERE product_slug = ? AND document_type = ?', [product_slug, document_type]);
    }
    await conn.query(`
      UPDATE product_legal_documents 
      SET url = ?, file_url = ?, effective_date = ?, version = ?, is_current = ?
      WHERE id = ?
    `, [url || '', file_url || null, effective_date || null, version || null, is_current ? 1 : 0, id]);
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Update legal document error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Delete a legal document version
router.delete('/product-legal/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM product_legal_documents WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete legal document error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Add a policy
router.post('/product-policies/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { name, description, is_requestable, effective_date, version } = req.body;
  
  try {
    await pool.query('INSERT INTO product_policies (product_slug, name, description, is_requestable, effective_date, version) VALUES (?, ?, ?, ?, ?, ?)', [slug, name, description, is_requestable === undefined ? 1 : is_requestable, effective_date || null, version || null]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Add policy error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update a policy
router.put('/product-policies/:id', async (req, res) => {
  const id = req.params.id;
  const { name, description, is_requestable, effective_date, version } = req.body;
  
  try {
    await pool.query(
      'UPDATE product_policies SET name = ?, description = ?, is_requestable = ?, effective_date = ?, version = ? WHERE id = ?',
      [name, description, is_requestable === undefined ? 1 : is_requestable, effective_date || null, version || null, id]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update policy error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Delete a policy
router.delete('/product-policies/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM product_policies WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete policy error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update product controls
router.put('/product-controls/:slug', async (req, res) => {
  const slug = req.params.slug;
  const controls = req.body; // Array of { topic_id, status, description }
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (controls && controls.length > 0) {
      const topicIds = controls.map((c: any) => c.topic_id);
      const placeholdersFormat = topicIds.map(() => '?').join(',');
      // Delete controls that are no longer in the list
      await conn.query(`DELETE FROM product_controls WHERE product_slug = ? AND topic_id NOT IN (${placeholdersFormat})`, [slug, ...topicIds]);

      const values: any[] = [];
      const placeholders: string[] = [];
      for (const ctrl of controls) {
        values.push(slug, ctrl.topic_id, ctrl.status, ctrl.description);
        placeholders.push('(?, ?, ?, ?, CURRENT_TIMESTAMP)');
      }
      await conn.query(`
        INSERT INTO product_controls (product_slug, topic_id, status, description, updated_at)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT(product_slug, topic_id) DO UPDATE SET status = excluded.status, description = excluded.description, updated_at = CURRENT_TIMESTAMP
      `, values);
    } else {
      // If empty array passed, delete all controls for this product
      await conn.query('DELETE FROM product_controls WHERE product_slug = ?', [slug]);
    }
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Update controls error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Add a subprocessor
router.post('/product-subprocessors/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { 
    name, 
    category, 
    region, 
    purpose, 
    website_url, 
    contact_details, 
    org_number,
    lei_number,
    nature_of_processing, 
    data_categories, 
    certifications, 
    dpa_url,
    dpa_requestable,
    countries 
  } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result]: any = await conn.query(
      'INSERT INTO product_subprocessors (product_slug, name, category, region, purpose, website_url, contact_details, org_number, lei_number, nature_of_processing, data_categories, certifications, dpa_url, dpa_requestable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        slug, 
        name, 
        category, 
        region, 
        purpose, 
        website_url || null,
        contact_details || null,
        org_number || null,
        lei_number || null,
        nature_of_processing || null,
        data_categories || null,
        certifications || null,
        dpa_url || null,
        dpa_requestable ? 1 : 0
      ]
    );
    
    const subprocessorId = result.insertId;
    
    if (countries && Array.isArray(countries)) {
      for (const country of countries) {
        await conn.query('INSERT INTO subprocessor_countries (subprocessor_id, country) VALUES (?, ?)', [subprocessorId, country]);
      }
    }
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Add subprocessor error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Delete a subprocessor
router.delete('/product-subprocessors/:id', async (req, res) => {
  const id = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM subprocessor_countries WHERE subprocessor_id = ?', [id]);
    await conn.query('DELETE FROM product_subprocessors WHERE id = ?', [id]);
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Delete subprocessor error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Update a subprocessor
router.put('/product-subprocessors/:id', async (req, res) => {
  const id = req.params.id;
  const { 
    name, 
    category, 
    region, 
    purpose, 
    website_url, 
    contact_details, 
    org_number,
    lei_number,
    nature_of_processing, 
    data_categories, 
    certifications, 
    dpa_url,
    dpa_requestable,
    countries 
  } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE product_subprocessors SET name = ?, category = ?, region = ?, purpose = ?, website_url = ?, contact_details = ?, org_number = ?, lei_number = ?, nature_of_processing = ?, data_categories = ?, certifications = ?, dpa_url = ?, dpa_requestable = ? WHERE id = ?',
      [
        name, 
        category, 
        region, 
        purpose, 
        website_url || null,
        contact_details || null,
        org_number || null,
        lei_number || null,
        nature_of_processing || null,
        data_categories || null,
        certifications || null,
        dpa_url || null,
        dpa_requestable ? 1 : 0,
        id
      ]
    );
    
    await conn.query('DELETE FROM subprocessor_countries WHERE subprocessor_id = ?', [id]);
    if (countries && Array.isArray(countries)) {
      for (const country of countries) {
        await conn.query('INSERT INTO subprocessor_countries (subprocessor_id, country) VALUES (?, ?)', [id, country]);
      }
    }
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Update subprocessor error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Add a subprocessor history entry
router.post('/subprocessor-history/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { version, date, description } = req.body;
  
  try {
    await pool.query('INSERT INTO subprocessor_history (product_slug, version, date, description) VALUES (?, ?, ?, ?)', [slug, version, date, description]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Add history entry error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Delete a subprocessor history entry
router.delete('/subprocessor-history/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM subprocessor_history WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete history entry error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Get all documents (admin view)
router.get('/documents', async (req, res) => {
  const [documents]: any = await pool.query('SELECT * FROM documents');
  res.json(documents);
});

// Create a document
router.post('/documents', async (req, res) => {
  const { name, slug, type, category, requires_nda, url, provider, findings_status, products, description } = req.body;
  
  if (!slug || !name || !type) return res.status(400).json({ error: 'Missing required fields' });
  
  try {
    await pool.query(`
      INSERT INTO documents (name, slug, type, category, requires_nda, url, provider, findings_status, products, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, slug, type, category, requires_nda ? 1 : 0, url, provider, findings_status, JSON.stringify(products || []), description || null]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Create document error:', err);
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Document slug already exists' });
    }
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update a document
router.put('/documents/:id', async (req, res) => {
  const id = req.params.id;
  const { name, slug, type, category, requires_nda, url, provider, findings_status, products, description } = req.body;
  
  try {
    await pool.query(`
      UPDATE documents 
      SET name = ?, slug = ?, type = ?, category = ?, requires_nda = ?, url = ?, provider = ?, findings_status = ?, products = ?, description = ?
      WHERE id = ?
    `, [name, slug, type, category, requires_nda ? 1 : 0, url, provider, findings_status, JSON.stringify(products || []), description || null, id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update document error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Delete a document
router.delete('/documents/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM documents WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update dashboard settings
router.put('/dashboard-settings', async (req, res) => {
  const settings = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const entries = Object.entries(settings);
    if (entries.length > 0) {
      const values: any[] = [];
      const placeholders: string[] = [];
      for (const [key, value] of entries) {
        const valStr = typeof value === 'string' ? value : JSON.stringify(value);
        values.push(key, valStr);
        placeholders.push('(?, ?)');
      }
      await conn.query(`INSERT INTO dashboard_settings ("key", "value") VALUES ${placeholders.join(', ')} ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"`, values);
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Update dashboard settings error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Upload logo
router.post('/upload-logo', upload.single('logo'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const logoUrl = `/uploads/${req.file.filename}`;
  res.json({ url: logoUrl });
});

// Upload pdf
router.post('/upload-pdf', requireAdminOrMod, uploadPdf.single('document'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT id, event_type, product_slug, item_name, user_email, created_at
      FROM metrics_events
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err: any) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
