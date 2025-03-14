
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 8080;
const { Pool } = require('pg');

// Enable JSON body parsing
app.use(express.json());

// Improved logging for debugging
console.log('Starting server...');
console.log(`Node environment: ${process.env.NODE_ENV}`);
console.log(`Current directory: ${__dirname}`);

// Setup PostgreSQL connection pool for Heroku
let pool;
if (process.env.DATABASE_URL) {
  console.log('Connecting to PostgreSQL database');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  // Test database connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection error:', err.message);
    } else {
      console.log('Database connected successfully:', res.rows[0]);
    }
  });
  
  // Initialize database tables if they don't exist
  const initDatabase = async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS employees (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(255),
          address TEXT,
          department VARCHAR(255),
          outlet VARCHAR(255)
        )
      `);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS departments (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          outlet VARCHAR(255)
        )
      `);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS attendance (
          id VARCHAR(255) PRIMARY KEY,
          employee_id VARCHAR(255) REFERENCES employees(id) ON DELETE CASCADE,
          date VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          outlet VARCHAR(255)
        )
      `);
      
      console.log('Database tables initialized');
    } catch (error) {
      console.error('Error initializing database tables:', error.message);
    }
  };
  
  initDatabase();
}

// API endpoints for employees
app.get('/api/employees', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    
    const result = await pool.query('SELECT * FROM employees');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    
    const { name, email, phone, address, department, outlet } = req.body;
    const id = `emp-${Date.now()}`;
    
    const result = await pool.query(
      'INSERT INTO employees (id, name, email, phone, address, department, outlet) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, name, email || '', phone, address || '', department || '', outlet]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating employee:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/employees/:id', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    
    const { id } = req.params;
    const { name, email, phone, address, department, outlet } = req.body;
    
    // Build query dynamically based on provided fields
    let query = 'UPDATE employees SET ';
    const values = [];
    const updateFields = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    
    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    
    if (address !== undefined) {
      updateFields.push(`address = $${paramIndex++}`);
      values.push(address);
    }
    
    if (department !== undefined) {
      updateFields.push(`department = $${paramIndex++}`);
      values.push(department);
    }
    
    if (outlet !== undefined) {
      updateFields.push(`outlet = $${paramIndex++}`);
      values.push(outlet);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    query += updateFields.join(', ');
    query += ` WHERE id = $${paramIndex} RETURNING *`;
    values.push(id);
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    
    const { id } = req.params;
    
    // Delete attendance records for this employee
    await pool.query('DELETE FROM attendance WHERE employee_id = $1', [id]);
    
    // Delete the employee
    const result = await pool.query('DELETE FROM employees WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API endpoints for departments
app.get('/api/departments', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    
    const result = await pool.query('SELECT * FROM departments');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching departments:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    
    const { name, description, outlet } = req.body;
    const id = `dept-${Date.now()}`;
    
    const result = await pool.query(
      'INSERT INTO departments (id, name, description, outlet) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, description || '', outlet]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating department:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM departments WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting department:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API endpoints for attendance
app.get('/api/attendance', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    
    const result = await pool.query('SELECT * FROM attendance');
    res.json(result.rows.map(row => ({
      id: row.id,
      employeeId: row.employee_id,
      date: row.date,
      status: row.status,
      outlet: row.outlet
    })));
  } catch (error) {
    console.error('Error fetching attendance records:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    
    const { employeeId, date, status } = req.body;
    const id = `${employeeId}-${date}`;
    
    // Get employee to get outlet
    const employeeResult = await pool.query('SELECT outlet FROM employees WHERE id = $1', [employeeId]);
    const outlet = employeeResult.rows.length > 0 ? employeeResult.rows[0].outlet : null;
    
    // Check if record exists
    const existingRecord = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, date]
    );
    
    let result;
    if (existingRecord.rows.length > 0) {
      // Update existing record
      result = await pool.query(
        'UPDATE attendance SET status = $1 WHERE employee_id = $2 AND date = $3 RETURNING *',
        [status, employeeId, date]
      );
    } else {
      // Create new record
      result = await pool.query(
        'INSERT INTO attendance (id, employee_id, date, status, outlet) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [id, employeeId, date, status, outlet]
      );
    }
    
    res.status(existingRecord.rows.length > 0 ? 200 : 201).json({
      id: result.rows[0].id,
      employeeId: result.rows[0].employee_id,
      date: result.rows[0].date,
      status: result.rows[0].status,
      outlet: result.rows[0].outlet
    });
  } catch (error) {
    console.error('Error updating attendance:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/attendance/:employeeId/:date', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    
    const { employeeId, date } = req.params;
    
    const result = await pool.query(
      'DELETE FROM attendance WHERE employee_id = $1 AND date = $2 RETURNING *',
      [employeeId, date]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting attendance record:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create a simple API endpoint to check if the server is running
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    timestamp: new Date().toISOString(),
    database: pool ? 'connected' : 'not connected'
  });
});

// Add a basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: pool ? 'connected' : 'not connected'
  });
});

// Check if the dist directory exists and has files
const distPath = path.join(__dirname, 'dist');
try {
  if (fs.existsSync(distPath)) {
    console.log(`Dist directory found at: ${distPath}`);
    const files = fs.readdirSync(distPath);
    console.log(`Files in dist directory: ${files.join(', ')}`);
    
    // Check if index.html exists
    const indexExists = fs.existsSync(path.join(distPath, 'index.html'));
    console.log(`index.html exists: ${indexExists}`);
    
    if (!indexExists) {
      console.error('ERROR: index.html not found in the dist directory');
      if (process.env.NODE_ENV === 'production') {
        console.error('Build may have failed. Check build logs.');
      }
    }
  } else {
    console.log(`WARNING: Dist directory not found at: ${distPath}`);
    // Create the dist directory if it doesn't exist to prevent errors
    fs.mkdirSync(distPath, { recursive: true });
    console.log(`Created dist directory at: ${distPath}`);
    
    // In production, this is likely an error with the build process
    if (process.env.NODE_ENV === 'production') {
      console.error('ERROR: Dist directory not found in production - build may have failed');
      // Create a minimal index.html file to prevent 404 errors
      const tempHtml = `<html><body><h1>Build Error</h1><p>The application build process may have failed. Please check the Heroku logs for more information.</p></body></html>`;
      fs.writeFileSync(path.join(distPath, 'index.html'), tempHtml);
      console.log('Created temporary index.html file');
    }
  }
} catch (error) {
  console.error(`Error checking dist directory: ${error.message}`);
}

// Serve static files from the dist directory
app.use(express.static(distPath));

// For all requests, send the index.html file
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  console.log(`Request path: ${req.path}`);
  console.log(`Attempting to serve index.html from: ${indexPath}`);
  
  try {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error('ERROR: index.html not found in the dist directory');
      res.status(404).send(`
        <html>
          <body>
            <h1>Application Error</h1>
            <p>The build process might not have completed successfully.</p>
            <p>Please check the Heroku logs for more details using: heroku logs --tail --app attendx-rbs-0956e0964ff5</p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error(`Error serving index.html: ${error.message}`);
    res.status(500).send(`
      <html>
        <body>
          <h1>Server Error</h1>
          <p>An unexpected error occurred. Please check the logs for more information.</p>
          <p>Error: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
  console.log('Check /health or /api/test endpoints to verify server is working');
});
