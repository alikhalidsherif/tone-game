import { useState, useEffect, useRef } from 'react';
import { initAudio, playTone, startContinuousTone, updateContinuousTone, stopContinuousTone } from './audio';
import { io } from 'socket.io-client';

const socket = io(); // Connects to the same domain automatically

// Helper function to seed random number generator for daily challenge
function LCG(seed) {
  let state = seed;
  const m = 0x80000000;
  const a = 1103515245;
  const c = 12345;

  return function() {
    state = (a * state + c) % m;
    return state / (m - 1);
  }
}

const MIN_FREQ = 200;
const MAX_FREQ = 1000;
const NUM_TARGETS = 5;

const freqToNote = (f) => Math.log2(f);

function App() {
  const [phase, setPhase] = useState('home'); // home, mode-select, name-entry, lobby, memorize, recall, results
  const [mode, setMode] = useState('solo'); // solo, multiplayer, daily

  const [targets, setTargets] = useState([]);
  const [guesses, setGuesses] = useState([]);

  // Memorize phase state
  const [currentToneIndex, setCurrentToneIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Recall phase state
  const [recallIndex, setRecallIndex] = useState(0);
  const [currentGuess, setCurrentGuess] = useState(440);

  // Multiplayer State
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [dailyLeaderboard, setDailyLeaderboard] = useState([]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setRoomId(roomParam);
      setMode('multiplayer');
      setPhase('name-entry');
      // Clean up URL so user doesn't stay on it forever
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Socket event listeners
    socket.on('roomUpdated', (players) => {
      setRoomPlayers(players);
    });

    const handleGameStarted = () => {
      // Generate targets based on room ID so everyone gets the same targets
      let seed = 0;
      // We need the current roomId from state, but since this is inside useEffect,
      // we use a functional update or rely on the roomId variable in scope.
      // To ensure we get the latest roomId, we should re-attach this listener when roomId changes,
      // or just calculate it directly.
    };

    // We'll attach the listener in a separate effect that depends on roomId
    return () => {
      socket.off('roomUpdated');
    };
  }, []);

  useEffect(() => {
    const handleGameStarted = () => {
      if (!roomId) return;
      let seed = 0;
      for (let i = 0; i < roomId.length; i++) {
          seed += roomId.charCodeAt(i);
      }
      const rand = LCG(seed);
      const multiTargets = Array.from({ length: NUM_TARGETS }, () =>
        Math.floor(rand() * (MAX_FREQ - MIN_FREQ + 1)) + MIN_FREQ
      );

      setTargets(multiTargets);
      setGuesses([]);
      setPhase('memorize');
      initAudio();
    };

    socket.on('gameStarted', handleGameStarted);

    return () => {
      socket.off('gameStarted', handleGameStarted);
    };
  }, [roomId]);

  const generateTargets = (isDaily = false) => {
    let rand = Math.random;
    if (isDaily) {
      // Seed based on current date (UTC)
      const now = new Date();
      const seed = parseInt(`${now.getUTCFullYear()}${now.getUTCMonth()}${now.getUTCDate()}`);
      rand = LCG(seed);
    }

    return Array.from({ length: NUM_TARGETS }, () =>
      Math.floor(rand() * (MAX_FREQ - MIN_FREQ + 1)) + MIN_FREQ
    );
  };

  const handleStartMode = (selectedMode) => {
    setMode(selectedMode);

    if (selectedMode === 'daily') {
      setPhase('name-entry');
    } else if (selectedMode === 'multiplayer') {
      setPhase('name-entry');
    } else {
      // Solo
      const newTargets = generateTargets(false);
      setTargets(newTargets);
      setGuesses([]);
      setPhase('memorize');
      initAudio();
    }
  };

  const startDailyGame = () => {
    if (!playerName.trim()) return;
    const dailyTargets = generateTargets(true);
    setTargets(dailyTargets);
    setGuesses([]);
    setPhase('memorize');
    initAudio();
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) return;
    initAudio(); // Initialize audio context on user gesture
    socket.emit('createRoom', (newRoomId) => {
      setRoomId(newRoomId);
      socket.emit('joinRoom', newRoomId, playerName, (res) => {
        if (res.success) setPhase('lobby');
      });
    });
  };

  const handleJoinRoom = () => {
    if (!playerName.trim() || !roomId.trim()) return;
    initAudio(); // Initialize audio context on user gesture
    socket.emit('joinRoom', roomId, playerName, (res) => {
      if (res.success) setPhase('lobby');
      else alert('Room not found');
    });
  };

  const handleStartMultiplayerGame = () => {
    socket.emit('startGame', roomId);
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      alert("Link copied to clipboard!");
    });
  };

  useEffect(() => {
    if (phase === 'memorize') {
      const playSequence = async () => {
        setIsPlaying(true);
        await new Promise(r => setTimeout(r, 1000));

        for (let i = 0; i < targets.length; i++) {
          setCurrentToneIndex(i);
          await playTone(targets[i], 1);
          setCurrentToneIndex(-1);
          await new Promise(r => setTimeout(r, 500));
        }

        setIsPlaying(false);
        setPhase('recall');
        setRecallIndex(0);
        setCurrentGuess(440);
      };

      playSequence();
    }
  }, [phase, targets]);

  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setCurrentGuess(val);
    updateContinuousTone(val);
  };

  const handleSliderStart = () => {
    startContinuousTone(currentGuess);
  };

  const handleSliderEnd = () => {
    stopContinuousTone();
  };

  const calculateTotalScore = (customGuesses) => {
    const g = customGuesses || guesses;
    let score = 0;
    for (let i = 0; i < targets.length; i++) {
      if (!g[i]) continue;
      const targetNote = freqToNote(targets[i]);
      const guessNote = freqToNote(g[i]);
      const diff = Math.abs(targetNote - guessNote);
      let noteScore = 10 * (1 - Math.min(diff, 1));
      score += Math.max(0, noteScore);
    }
    return score.toFixed(2);
  };

  const submitGuess = async () => {
    stopContinuousTone();
    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);

    if (newGuesses.length === NUM_TARGETS) {
      setPhase('results');
      const finalScore = calculateTotalScore(newGuesses);

      if (mode === 'multiplayer') {
        socket.emit('submitScore', roomId, finalScore);
      } else if (mode === 'daily') {
        // Submit daily score to backend
        let nameToSubmit = playerName.trim() || 'Anonymous';
        try {
          const res = await fetch('/api/daily', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameToSubmit, score: parseFloat(finalScore) })
          });
          const data = await res.json();
          if (data.leaderboard) {
            setDailyLeaderboard(data.leaderboard);
          }
        } catch (err) {
          console.error('Failed to submit daily score', err);
        }
      }
    } else {
      setRecallIndex(recallIndex + 1);
      setCurrentGuess(440);
    }
  };

  useEffect(() => {
    if (mode === 'daily' && phase === 'results' && dailyLeaderboard.length === 0) {
      fetch('/api/daily/leaderboard')
        .then(res => res.json())
        .then(data => setDailyLeaderboard(data))
        .catch(err => console.error(err));
    }
  }, [mode, phase, dailyLeaderboard.length]);

  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased overflow-hidden flex flex-col justify-between selection:bg-gray-200">

      {/* Top Navigation / Brand */}
      <header className="p-6">
        <div className="text-xl font-medium tracking-tight">Dialed.</div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-6">

        {phase === 'home' && (
          <div className="bg-black text-white p-10 md:p-14 rounded-3xl max-w-lg w-full shadow-2xl space-y-8">
            <h1 className="text-6xl md:text-8xl font-medium tracking-tighter mb-4">
              sound
            </h1>
            <p className="text-gray-300 leading-relaxed text-sm md:text-base">
              Humans can’t reliably recall sounds. This is a simple game to see how good (or bad) you are at it.
            </p>
            <p className="text-gray-300 leading-relaxed text-sm md:text-base">
              We’ll play five tones, then you’ll try and recreate them.
            </p>

            <div className="pt-4">
              <div className="font-medium mb-4 text-sm">Solo or multiplayer?</div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleStartMode('solo')}
                  className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors"
                  aria-label="Solo"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </button>
                <button
                  onClick={() => handleStartMode('multiplayer')}
                  className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors"
                  aria-label="Multiplayer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                </button>
                <button
                  onClick={() => handleStartMode('daily')}
                  className="w-16 h-16 rounded-full border border-gray-600 bg-transparent flex items-center justify-center hover:bg-gray-900 transition-colors group relative"
                  aria-label="Daily Challenge"
                >
                  <div className="absolute -right-20 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded whitespace-nowrap">Daily Mode</div>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'name-entry' && (
          <div className="bg-black text-white p-10 md:p-14 rounded-3xl max-w-lg w-full shadow-2xl space-y-8">
            <h2 className="text-3xl font-medium tracking-tight">Enter your name</h2>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-transparent border-b-2 border-gray-600 focus:border-white outline-none py-2 text-2xl font-light placeholder-gray-600 transition-colors"
              placeholder="Your name"
              autoFocus
            />

            <div className="space-y-4 pt-4">
              {mode === 'daily' ? (
                <button
                  onClick={startDailyGame}
                  disabled={!playerName.trim()}
                  className="w-full py-4 bg-white text-black rounded-full font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Start Daily Challenge
                </button>
              ) : (
                <>
                 <button
                  onClick={handleCreateRoom}
                  disabled={!playerName.trim()}
                  className="w-full py-4 bg-white text-black rounded-full font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Create Game
                </button>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="flex-1 bg-transparent border border-gray-600 rounded-full px-4 text-sm focus:border-white outline-none"
                    placeholder="Paste Room ID"
                  />
                  <button
                    onClick={handleJoinRoom}
                    disabled={!playerName.trim() || !roomId.trim()}
                    className="px-6 py-3 border border-gray-600 rounded-full hover:bg-gray-800 disabled:opacity-50 text-sm transition-colors"
                  >
                    Join
                  </button>
                </div>
                </>
              )}
            </div>
            <button onClick={() => setPhase('home')} className="text-sm text-gray-500 hover:text-white underline underline-offset-4">Back</button>
          </div>
        )}

        {phase === 'lobby' && (
          <div className="bg-black text-white p-10 md:p-14 rounded-3xl max-w-lg w-full shadow-2xl space-y-8">
             <div className="flex justify-between items-start">
               <div>
                 <h2 className="text-3xl font-medium tracking-tight mb-2">Lobby</h2>
                 <p className="text-gray-400 text-sm flex items-center gap-2">
                   Room ID: <span className="text-white font-mono bg-gray-800 px-2 py-1 rounded">{roomId}</span>
                   <button onClick={copyInviteLink} className="text-xs border border-gray-600 px-2 py-1 rounded hover:bg-gray-800 transition-colors">Copy Link</button>
                 </p>
               </div>
             </div>

             <div className="bg-gray-900 rounded-2xl p-6 min-h-[150px]">
                <ul className="space-y-3">
                  {roomPlayers.map((player) => (
                    <li key={player.id} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span>{player.name} {player.id === socket.id ? '(You)' : ''}</span>
                    </li>
                  ))}
                </ul>
             </div>

             <button
                onClick={handleStartMultiplayerGame}
                className="w-full py-4 bg-white text-black rounded-full font-medium hover:bg-gray-200 transition-colors"
              >
                Start Game for Everyone
              </button>
          </div>
        )}

        {phase === 'memorize' && (
          <div className="flex flex-col items-center justify-center space-y-16 w-full max-w-2xl">
             <h2 className="text-3xl font-medium tracking-tight">Listen carefully</h2>

             <div className="flex justify-center gap-4 my-16">
               {targets.map((_, i) => (
                 <div
                   key={i}
                   className={`w-12 h-12 rounded-full transition-colors duration-300 ${
                     i === currentToneIndex
                       ? 'bg-black'
                       : i < currentToneIndex
                         ? 'bg-gray-800'
                         : 'bg-[#222934]'
                   }`}
                 />
               ))}
             </div>

             <p className="text-gray-500 text-sm">
               {isPlaying ? "Playing sequence..." : "Get ready..."}
             </p>
          </div>
        )}

        {phase === 'recall' && (
          <div className="flex flex-col items-center w-full max-w-lg space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-medium tracking-tight">Tone {recallIndex + 1} of {NUM_TARGETS}</h2>
              <p className="text-gray-500 mt-2">Drag the slider to match the frequency</p>
            </div>

            <div className="w-full bg-[#111111] border border-gray-800 text-white p-10 rounded-3xl space-y-10 shadow-xl">
              <div className="text-center font-mono text-5xl font-light">
                {currentGuess} <span className="text-3xl text-gray-400">Hz</span>
              </div>

              <div className="relative pt-2">
                <input
                  type="range"
                  min={MIN_FREQ}
                  max={MAX_FREQ}
                  value={currentGuess}
                  onChange={handleSliderChange}
                  onPointerDown={handleSliderStart}
                  onPointerUp={handleSliderEnd}
                  onPointerCancel={handleSliderEnd}
                  className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-white"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-4 font-mono">
                  <span>{MIN_FREQ} Hz</span>
                  <span>{MAX_FREQ} Hz</span>
                </div>
              </div>

              <button
                onClick={submitGuess}
                className="w-full py-4 bg-white text-black rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Submit Guess
              </button>
            </div>
          </div>
        )}

        {phase === 'results' && (
          <div className="w-full max-w-4xl grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              <div className="space-y-2">
                <h2 className="text-sm tracking-widest uppercase text-gray-400">Your Score</h2>
                <div className="text-8xl font-medium tracking-tighter">
                  {calculateTotalScore()}<span className="text-4xl text-gray-300 font-light">/50</span>
                </div>
              </div>

              <div className="space-y-3">
                {targets.map((target, i) => {
                  const guess = guesses[i];
                  return (
                    <div key={i} className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-4">
                        <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">
                          {i + 1}
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Target</div>
                          <div className="font-mono">{target} Hz</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Your Guess</div>
                        <div className="font-mono">{guess} Hz</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => setPhase('home')}
                className="px-8 py-4 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors"
              >
                Play Again
              </button>
            </div>

            {mode === 'multiplayer' && (
              <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
                <h3 className="text-xl font-medium mb-6">Friends' Results</h3>
                <ul className="space-y-4">
                  {roomPlayers.map((player) => (
                    <li key={player.id} className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                      <div className="flex items-center gap-3">
                         <div className={`w-2 h-2 rounded-full ${player.status === 'finished' ? 'bg-green-500' : 'bg-yellow-400 animate-pulse'}`}></div>
                         <span className="font-medium">{player.name}</span>
                      </div>
                      <div className="font-mono font-bold text-lg">
                        {player.score !== null ? player.score : '...'}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mode === 'daily' && (
               <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
                 <h3 className="text-xl font-medium mb-6">Daily Leaderboard</h3>
                 {dailyLeaderboard.length > 0 ? (
                    <ul className="space-y-4">
                      {dailyLeaderboard.map((entry, idx) => (
                        <li key={idx} className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                          <div className="flex items-center gap-4">
                            <span className="text-gray-400 font-mono w-4">{idx + 1}.</span>
                            <span className="font-medium truncate max-w-[120px]">{entry.name}</span>
                          </div>
                          <div className="font-mono font-bold text-lg">
                            {entry.score}
                          </div>
                        </li>
                      ))}
                    </ul>
                 ) : (
                   <p className="text-sm text-gray-500">Loading leaderboard...</p>
                 )}
               </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="p-6 flex justify-between items-center text-xs text-gray-400">
        <div>Made by Jules • Tone Match Game</div>
        <div className="flex items-center gap-4">
          <span>Turn your volume up</span>
        </div>
      </footer>
    </div>
  );
}

export default App;