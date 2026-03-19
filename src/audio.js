let audioCtx = null;

export const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const playTone = (frequency, duration = 0.5) => {
  if (!audioCtx) initAudio();
  
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

  // Fade in and fade out to avoid clicks
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
  gainNode.gain.setValueAtTime(1, audioCtx.currentTime + duration - 0.05);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
  
  return new Promise(resolve => setTimeout(resolve, duration * 1000));
};

let continuousOscillator = null;
let continuousGainNode = null;

export const startContinuousTone = (frequency) => {
  if (!audioCtx) initAudio();
  if (continuousOscillator) return;

  continuousOscillator = audioCtx.createOscillator();
  continuousGainNode = audioCtx.createGain();

  continuousOscillator.type = 'sine';
  continuousOscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

  continuousGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  continuousGainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);

  continuousOscillator.connect(continuousGainNode);
  continuousGainNode.connect(audioCtx.destination);

  continuousOscillator.start();
};

export const updateContinuousTone = (frequency) => {
  if (continuousOscillator && audioCtx) {
    // Smooth frequency transition
    continuousOscillator.frequency.exponentialRampToValueAtTime(frequency, audioCtx.currentTime + 0.1);
  } else {
    startContinuousTone(frequency);
  }
};

export const stopContinuousTone = () => {
  if (continuousGainNode && audioCtx && continuousOscillator) {
    continuousGainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
    continuousOscillator.stop(audioCtx.currentTime + 0.05);
    
    setTimeout(() => {
      continuousOscillator = null;
      continuousGainNode = null;
    }, 50);
  }
};
