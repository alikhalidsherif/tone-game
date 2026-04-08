import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dataDir, 'game.db'), (err) => {
  if (err) console.error('Database opening error: ', err);
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      name TEXT,
      score REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS global_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      score REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// In-memory rooms for multiplayer
const rooms = {};

// Helper to get today's date string
const getTodayString = () => new Date().toISOString().split('T')[0];

app.post('/api/daily', (req, res) => {
  const { name, score } = req.body;
  const today = getTodayString();

  db.run('INSERT INTO daily_scores (date, name, score) VALUES (?, ?, ?)', [today, name, score], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    // Fetch top 10 today
    db.all('SELECT name, score FROM daily_scores WHERE date = ? ORDER BY score DESC LIMIT 10', [today], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ leaderboard: rows });
    });
  });
});

app.get('/api/daily/leaderboard', (req, res) => {
  const today = getTodayString();
  db.all('SELECT name, score FROM daily_scores WHERE date = ? ORDER BY score DESC LIMIT 10', [today], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createRoom', (playerName, callback) => {
    const roomId = uuidv4().slice(0, 8); // Short ID
    rooms[roomId] = {
      players: [],
      creator: playerName,
      createdAt: Date.now()
    };
    callback(roomId);
  });

  socket.on('getRoomInfo', (roomId, callback) => {
    if (rooms[roomId]) {
      callback({
        exists: true,
        creator: rooms[roomId].creator
      });
    } else {
      callback({ exists: false });
    }
  });

  socket.on('joinRoom', (roomId, playerName, callback) => {
    if (rooms[roomId]) {
      socket.join(roomId);
      // Remove any existing player with same ID (reconnect)
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      rooms[roomId].players.push({ id: socket.id, name: playerName, score: null, status: 'lobby' });
      io.to(roomId).emit('roomUpdated', rooms[roomId].players);
      callback({ success: true, creator: rooms[roomId].creator });
    } else {
      callback({ success: false, error: 'Room not found' });
    }
  });

  socket.on('startGame', (roomId) => {
    if (rooms[roomId]) {
      io.to(roomId).emit('gameStarted');
    }
  });

  socket.on('submitScore', (roomId, score) => {
    if (rooms[roomId]) {
      const player = rooms[roomId].players.find(p => p.id === socket.id);
      if (player) {
        player.score = score;
        player.status = 'finished';
        io.to(roomId).emit('roomUpdated', rooms[roomId].players);
      }
    }
  });

  socket.on('disconnect', () => {
    // Optional: remove player from room if disconnected
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      io.to(roomId).emit('roomUpdated', rooms[roomId].players);
      // Clean up empty rooms
      if (rooms[roomId].players.length === 0) {
        delete rooms[roomId];
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Serve static React app in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
