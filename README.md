# ToneMatch Game

A minimalist sound-frequency matching game.

## Features
* **Gameplay:** A perfect sound-frequency matching game. You listen to 5 tones, then try to recreate them with a slider. Scoring is based on human logarithmic pitch perception.
* **Solo Mode:** Play locally against yourself.
* **Multiplayer Mode:** Generate a shareable link. When friends join, you click "Start Game" and everyone starts simultaneously. Scores update in real-time as friends finish!
* **Daily Challenge:** A globally seeded sequence (changes every 24 hours UTC). Submit your score to a global SQLite leaderboard and see the Top 10 instantly.
* **Aesthetic:** A spotless, high-contrast, black-and-white minimalist UI.
* **Docker & CI/CD:** A multi-stage `Dockerfile` and `docker-compose.yml` for instant deployments, complete with a GitHub Actions workflow `.github/workflows/deploy.yml` configured for your self-hosted runner.

## Quick Start
```bash
npm install
npm run dev
```

## Docker Deployment
```bash
docker-compose up --build -d
```
