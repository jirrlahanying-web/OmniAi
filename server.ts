import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("omniai.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    prompt TEXT,
    url TEXT,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/conversations", (req, res) => {
    const rows = db.prepare("SELECT * FROM conversations ORDER BY created_at DESC").all();
    res.json(rows);
  });

  app.get("/api/conversations/:id/messages", (req, res) => {
    const rows = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC").all(req.params.id);
    res.json(rows);
  });

  app.post("/api/conversations", (req, res) => {
    const { id, title, model } = req.body;
    db.prepare("INSERT INTO conversations (id, title, model) VALUES (?, ?, ?)").run(id, title, model);
    res.json({ success: true });
  });

  app.post("/api/messages", (req, res) => {
    const { id, conversation_id, role, content } = req.body;
    db.prepare("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)").run(id, conversation_id, role, content);
    res.json({ success: true });
  });

  app.get("/api/images", (req, res) => {
    const rows = db.prepare("SELECT * FROM images ORDER BY created_at DESC").all();
    res.json(rows);
  });

  app.post("/api/images", (req, res) => {
    const { id, prompt, url, model } = req.body;
    db.prepare("INSERT INTO images (id, prompt, url, model) VALUES (?, ?, ?, ?)").run(id, prompt, url, model);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  io.on("connection", (socket) => {
    console.log("Client connected");
    socket.on("disconnect", () => console.log("Client disconnected"));
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
