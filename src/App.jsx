import { useState, useEffect, useRef } from 'react';
import { initAudio, playTone, startContinuousTone, updateContinuousTone, stopContinuousTone } from './audio';

const MIN_FREQ = 200;
const MAX_FREQ = 1000;
const NUM_TARGETS = 5;

// Helper to calculate score difference based on frequency
// We use a logarithmic scale for frequencies as humans hear pitch logarithmically
const freqToNote = (f) => Math.log2(f);

function App() {
  const [phase, setPhase] = useState('intro'); // intro, memorize, recall, results
  const [targets, setTargets] = useState([]);
  const [guesses, setGuesses] = useState([]);

  // Memorize phase state
  const [currentToneIndex, setCurrentToneIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Recall phase state
  const [recallIndex, setRecallIndex] = useState(0);
  const [currentGuess, setCurrentGuess] = useState(440); // Default to A4

  const handleStart = () => {
    initAudio();
    // Generate random frequencies
    const newTargets = Array.from({ length: NUM_TARGETS }, () =>
      Math.floor(Math.random() * (MAX_FREQ - MIN_FREQ + 1)) + MIN_FREQ
    );
    setTargets(newTargets);
    setGuesses([]);
    setPhase('memorize');
  };

  useEffect(() => {
    if (phase === 'memorize') {
      const playSequence = async () => {
        setIsPlaying(true);
        // Initial delay
        await new Promise(r => setTimeout(r, 1000));

        for (let i = 0; i < targets.length; i++) {
          setCurrentToneIndex(i);
          await playTone(targets[i], 1); // 1 second per tone
          setCurrentToneIndex(-1);
          await new Promise(r => setTimeout(r, 500)); // 0.5s pause between tones
        }

        setIsPlaying(false);
        setPhase('recall');
        setRecallIndex(0);
        setCurrentGuess(440);
      };

      playSequence();
    }
  }, [phase, targets]);

  // Handle slider interaction
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

  const submitGuess = () => {
    stopContinuousTone(); // Ensure it stops when submitted
    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);

    if (newGuesses.length === NUM_TARGETS) {
      setPhase('results');
    } else {
      setRecallIndex(recallIndex + 1);
      setCurrentGuess(440);
    }
  };

  // Score calculation
  const calculateTotalScore = () => {
    let score = 0;
    for (let i = 0; i < targets.length; i++) {
      const targetNote = freqToNote(targets[i]);
      const guessNote = freqToNote(guesses[i]);
      const diff = Math.abs(targetNote - guessNote);

      // Calculate a score out of 10 for each note based on how close it is
      // An octave is a difference of 1 in our log scale
      // Let's say if you are an octave away or more, your score is 0
      // So max allowable diff is 1
      let noteScore = 10 * (1 - Math.min(diff, 1));
      score += Math.max(0, noteScore);
    }
    return score.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col items-center justify-center font-sans antialiased overflow-hidden selection:bg-purple-500/30">

      <div className="w-full max-w-2xl px-6">
        {/* Header - shown across all except maybe pure intro */}
        <header className="mb-12 flex justify-between items-center opacity-50 text-sm tracking-widest uppercase">
          <div>Tone Match</div>
          <div>{phase !== 'intro' && phase !== 'results' ? `${phase} phase` : ''}</div>
        </header>

        {phase === 'intro' && (
          <div className="space-y-12 animate-fade-in flex flex-col items-center text-center">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-light tracking-tighter">
                sound
              </h1>
              <p className="text-gray-400 max-w-md mx-auto leading-relaxed text-lg">
                Humans can’t reliably recall sounds. This is a simple game to see how good (or bad) you are at it.
              </p>
              <p className="text-gray-400 max-w-md mx-auto leading-relaxed text-lg">
                We’ll play five tones, then you’ll try and recreate them.
              </p>
            </div>

            <button
              onClick={handleStart}
              className="px-8 py-4 bg-white text-black rounded-full font-medium hover:scale-105 transition-transform duration-200"
            >
              Start Game
            </button>
            <div className="mt-12 text-xs text-gray-600">Turn your volume up.</div>
          </div>
        )}

        {phase === 'memorize' && (
          <div className="space-y-12 text-center animate-fade-in">
             <h2 className="text-3xl font-light text-gray-300">Listen carefully</h2>

             <div className="flex justify-center gap-4 my-16">
               {targets.map((_, i) => (
                 <div
                   key={i}
                   className={`w-12 h-12 rounded-full transition-all duration-300 ${
                     i === currentToneIndex
                       ? 'bg-purple-500 scale-125 shadow-[0_0_30px_rgba(168,85,247,0.5)]'
                       : i < currentToneIndex
                         ? 'bg-gray-700'
                         : 'bg-gray-800'
                   }`}
                 />
               ))}
             </div>

             <p className="text-gray-500">
               {isPlaying ? "Playing sequence..." : "Get ready..."}
             </p>
          </div>
        )}

        {phase === 'recall' && (
          <div className="space-y-12 animate-fade-in flex flex-col">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-light">Tone {recallIndex + 1} of {NUM_TARGETS}</h2>
              <p className="text-gray-400">Drag the slider to match the frequency</p>
            </div>

            <div className="bg-[#1a1a1a] p-8 rounded-3xl space-y-8 border border-gray-800">
              <div className="text-center font-mono text-4xl text-purple-400">
                {currentGuess} Hz
              </div>

              <div className="relative pt-6 pb-2">
                <input
                  type="range"
                  min={MIN_FREQ}
                  max={MAX_FREQ}
                  value={currentGuess}
                  onChange={handleSliderChange}
                  onPointerDown={handleSliderStart}
                  onPointerUp={handleSliderEnd}
                  onPointerCancel={handleSliderEnd}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
                  <span>{MIN_FREQ} Hz</span>
                  <span>{MAX_FREQ} Hz</span>
                </div>
              </div>

              <button
                onClick={submitGuess}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
              >
                Submit Guess
              </button>
            </div>
          </div>
        )}

        {phase === 'results' && (
          <div className="space-y-12 animate-fade-in">
            <div className="text-center space-y-4">
              <h2 className="text-xl text-gray-400 tracking-widest uppercase">Your Score</h2>
              <div className="text-7xl font-light text-white">
                {calculateTotalScore()}<span className="text-3xl text-gray-500">/50</span>
              </div>
            </div>

            <div className="space-y-4 mt-8">
              {targets.map((target, i) => {
                const guess = guesses[i];
                const diff = Math.abs(target - guess);
                const isPerfect = diff === 0;
                const isClose = diff <= 50;

                return (
                  <div key={i} className="flex items-center justify-between bg-[#1a1a1a] p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                        ${isPerfect ? 'bg-green-500/20 text-green-400' :
                          isClose ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'}`}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Target</div>
                        <div className="font-mono">{target} Hz</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-gray-400">Your Guess</div>
                      <div className="font-mono">{guess} Hz</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-center pt-8">
              <button
                onClick={handleStart}
                className="px-8 py-4 bg-white text-black rounded-full font-medium hover:scale-105 transition-transform duration-200"
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-20 text-center opacity-30 text-xs">
          Inspired by dialed.gg • A test of auditory memory
        </footer>
      </div>
    </div>
  );
}

export default App;