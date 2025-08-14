-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  credits INTEGER DEFAULT 10,
  subscription_tier TEXT DEFAULT 'free',
  subscription_date DATETIME,
  subscription_expiry DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  reset_token TEXT,
  reset_token_expiry DATETIME,
  is_active BOOLEAN DEFAULT 1,
  metadata TEXT -- JSON field for additional data
);

-- OCR Processing History
CREATE TABLE IF NOT EXISTS ocr_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  file_hash TEXT,
  extracted_text TEXT,
  language TEXT,
  confidence REAL,
  processing_time REAL,
  credits_used INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT, -- JSON field
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'SAR',
  tier TEXT,
  status TEXT DEFAULT 'pending',
  gateway TEXT,
  gateway_response TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  payment_id TEXT,
  invoice_number TEXT UNIQUE,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'SAR',
  vat_amount REAL DEFAULT 0,
  total_amount REAL,
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  due_date DATETIME,
  paid_at DATETIME,
  status TEXT DEFAULT 'pending',
  pdf_url TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);

-- RAG Documents table
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_name TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB, -- Store vector embeddings
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- RAG Conversations
CREATE TABLE IF NOT EXISTS rag_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- RAG Messages
CREATE TABLE IF NOT EXISTS rag_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  document_references TEXT, -- JSON array of document IDs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES rag_conversations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  name TEXT,
  last_used DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  is_active BOOLEAN DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_ocr_history_user ON ocr_history(user_id, created_at DESC);
CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX idx_rag_documents_user ON rag_documents(user_id);
CREATE INDEX idx_rag_messages_conversation ON rag_messages(conversation_id, created_at);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);