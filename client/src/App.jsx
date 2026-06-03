import React, { useState, useEffect } from 'react';

function App() {
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [health, setHealth] = useState({
    status: 'loading',
    services: {
      database: { status: 'loading' },
      s3: { status: 'loading' }
    }
  });

  const [loadingMsg, setLoadingMsg] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchHealth();
    fetchMessages();
    fetchFiles();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setHealth({
        status: 'error',
        services: {
          database: { status: 'error', error: err.message },
          s3: { status: 'error', error: err.message }
        }
      });
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      if (Array.isArray(data)) {
        setFiles(data);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  };

  const handlePostMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoadingMsg(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage })
      });
      if (res.ok) {
        setNewMessage('');
        await fetchMessages();
        await fetchHealth(); // Refresh health status
      }
    } catch (err) {
      console.error('Failed to post message:', err);
    } finally {
      setLoadingMsg(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoadingUpload(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setSelectedFile(null);
        // Clear file input element
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
        
        await fetchFiles();
        await fetchHealth(); // Refresh health status
      }
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setLoadingUpload(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="badge badge-success">
            <span className="pulsing-dot"></span> Active
          </span>
        );
      case 'error':
      case 'disconnected':
        return (
          <span className="badge badge-danger">
            <span className="pulsing-dot"></span> Offline
          </span>
        );
      case 'unconfigured':
        return (
          <span className="badge badge-warning">
            Unconfigured
          </span>
        );
      default:
        return <span className="badge">Loading...</span>;
    }
  };

  return (
    <div className="container">
      {/* Header Panel */}
      <header style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1>Rabbittize PaaS Simulation</h1>
        <p style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          This full-stack application connects directly to your live AWS S3 bucket and RDS PostgreSQL instance deployed via the RabbittWatch Canvas.
        </p>
      </header>

      {/* Connection Health Status Bar */}
      <section className="card" style={{ marginBottom: '2.5rem', padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>System Integration Health</h2>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Updates automatically as actions succeed or fail</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>PostgreSQL (RDS):</span>
              {getStatusBadge(health.services.database.status)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Storage (S3):</span>
              {getStatusBadge(health.services.s3.status)}
            </div>
          </div>
        </div>
        {health.status === 'degraded' && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem', color: '#f87171' }}>
            <strong>System Alerts:</strong>
            {health.services.database.status === 'error' && <div>• RDS Connection Error: {health.services.database.error}</div>}
            {health.services.s3.status === 'error' && <div>• S3 Connection Error: {health.services.s3.error}</div>}
          </div>
        )}
      </section>

      {/* Main Grid: Messages and Files */}
      <div className="grid">
        {/* Left Hand Side: PostgreSQL Database Board */}
        <section className="card">
          <h2>PostgreSQL Message Board (RDS)</h2>
          <p>Messages written below are inserted directly into the simulated PostgreSQL table.</p>

          <form onSubmit={handlePostMessage} style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write a message to save to RDS..."
                disabled={loadingMsg}
              />
              <button type="submit" className="btn btn-primary" disabled={loadingMsg || !newMessage.trim()}>
                {loadingMsg ? 'Saving...' : 'Post Message'}
              </button>
            </div>
          </form>

          <h3>Active Message List</h3>
          <div style={{ marginTop: '1rem' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#4b5563', fontStyle: 'italic' }}>
                No messages posted yet. Be the first!
              </div>
            ) : (
              <div className="list">
                {messages.map((msg) => (
                  <div key={msg.id} className="list-item">
                    <span style={{ fontSize: '1rem', color: '#f1f5f9' }}>{msg.content}</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Hand Side: S3 File Manager */}
        <section className="card">
          <h2>S3 Cloud Storage (S3)</h2>
          <p>Files uploaded here are stored directly on the simulated AWS S3 Bucket.</p>

          <form onSubmit={handleFileUpload} style={{ marginBottom: '2rem' }}>
            <div className="dropzone" onClick={() => document.getElementById('file-input').click()}>
              <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</span>
              <span style={{ fontWeight: '500' }}>
                {selectedFile ? selectedFile.name : 'Select or drag a file to upload'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Supports images, documents, up to 10MB'}
              </span>
              <input
                id="file-input"
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => setSelectedFile(e.target.files[0])}
              />
            </div>

            {selectedFile && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loadingUpload}>
                  {loadingUpload ? 'Uploading...' : 'Upload to S3'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedFile(null)} disabled={loadingUpload}>
                  Cancel
                </button>
              </div>
            )}
          </form>

          <h3>Uploaded Files ({files.length})</h3>
          <div style={{ marginTop: '1rem' }}>
            {files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#4b5563', fontStyle: 'italic' }}>
                No files uploaded to S3 yet.
              </div>
            ) : (
              <div className="list">
                {files.map((file) => (
                  <div key={file.key} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', color: '#f1f5f9', wordBreak: 'break-all', paddingRight: '1rem' }}>
                        {file.key.substring(file.key.indexOf('_') + 1)}
                      </span>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                        Download
                      </a>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Size: {(file.size / 1024).toFixed(1)} KB • Modified: {new Date(file.lastModified).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="footer">
        Powered by Rabbittize PaaS Simulation Suite • Client & Server wired seamlessly via IAM & VPC Security Groups
      </footer>
    </div>
  );
}

export default App;
