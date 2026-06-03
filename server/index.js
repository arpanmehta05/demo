const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Setup Multer (in-memory storage for file uploading)
const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// --- Database Configuration (PostgreSQL RDS) ---
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'simdb',
  user: process.env.DB_USER || 'dbadmin',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || 'P@ssw0rd1234!',
  // Add a connection timeout
  connectionTimeoutMillis: 5000,
};

console.log("Database configuration host:", dbConfig.host);
const pool = new Pool(dbConfig);

// Retry database connection and schema initialization
async function initDatabase() {
  let retries = 5;
  while (retries > 0) {
    try {
      console.log(`Connecting to database (attempts left: ${retries})...`);
      const client = await pool.connect();
      console.log("Database connected successfully!");
      
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Schema initialized: 'messages' table verified/created.");
      client.release();
      break;
    } catch (err) {
      console.error("Database connection failure:", err.message);
      retries--;
      if (retries === 0) {
        console.error("Could not connect to database after several attempts. Continuing backend startup...");
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

initDatabase();

// --- Storage Configuration (AWS S3) ---
const bucketName = process.env.S3_BUCKET_NAME;
console.log("S3 Bucket Name:", bucketName);

// Initialize S3 Client. 
// Note: When deployed on EC2 with an attached IAM Role (Instance Profile), 
// the SDK automatically resolves credentials using the IMDSv2 metadata service.
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1'
});

// --- API Endpoints ---

// 1. Healthcheck & Service Status Check
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let s3Status = 'disconnected';
  let dbError = null;
  let s3Error = null;

  // Check DB
  try {
    const dbRes = await pool.query('SELECT NOW()');
    if (dbRes.rows.length > 0) {
      dbStatus = 'healthy';
    }
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message;
  }

  // Check S3
  try {
    if (bucketName) {
      await s3.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 }));
      s3Status = 'healthy';
    } else {
      s3Status = 'unconfigured';
      s3Error = 'S3_BUCKET_NAME env variable is missing';
    }
  } catch (err) {
    s3Status = 'error';
    s3Error = err.message;
  }

  res.json({
    status: (dbStatus === 'healthy' && s3Status === 'healthy') ? 'healthy' : 'degraded',
    services: {
      database: { status: dbStatus, error: dbError },
      s3: { status: s3Status, error: s3Error, bucket: bucketName }
    }
  });
});

// 2. Database Endpoint: Post Message
app.post('/api/messages', async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO messages (content) VALUES ($1) RETURNING *',
      [content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to insert message:", err);
    res.status(500).json({ error: 'Failed to insert message', details: err.message });
  }
});

// 3. Database Endpoint: Get Messages
app.get('/api/messages', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM messages ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to retrieve messages:", err);
    res.status(500).json({ error: 'Failed to retrieve messages', details: err.message });
  }
});

// 4. S3 Endpoint: Upload File
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!bucketName) {
    return res.status(500).json({ error: 'S3 bucket is not configured' });
  }

  const key = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  try {
    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));

    res.status(201).json({
      success: true,
      key: key,
      filename: req.file.originalname,
      bucket: bucketName,
      url: `https://${bucketName}.s3.amazonaws.com/${key}`
    });
  } catch (err) {
    console.error("Failed to upload file to S3:", err);
    res.status(500).json({ error: 'S3 upload failed', details: err.message });
  }
});

// 5. S3 Endpoint: List Files
app.get('/api/files', async (req, res) => {
  if (!bucketName) {
    return res.status(500).json({ error: 'S3 bucket is not configured' });
  }

  try {
    const data = await s3.send(new ListObjectsV2Command({ Bucket: bucketName }));
    const files = (data.Contents || []).map(file => ({
      key: file.Key,
      size: file.Size,
      lastModified: file.LastModified,
      url: `https://${bucketName}.s3.amazonaws.com/${file.Key}`
    }));
    res.json(files);
  } catch (err) {
    console.error("Failed to list files from S3:", err);
    res.status(500).json({ error: 'Failed to list files', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Demo backend listening on port ${port}`);
});
