/**
 * Audio synthesis utility for MISSION
 * Generates pure in-browser WAV blobs for demo tracks without any external dependencies or network requests.
 */

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Encodes audio samples into a 16-bit stereo WAV Blob
 */
export function createWavBlob(
  leftSamples: Float32Array,
  rightSamples: Float32Array,
  sampleRate: number = 44100
): Blob {
  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const length = leftSamples.length;
  const buffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length minus 8
  view.setUint32(4, 36 + length * blockAlign, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, length * blockAlign, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < length; i++) {
    // Left channel
    const left = Math.max(-1, Math.min(1, leftSamples[i]));
    view.setInt16(offset, left < 0 ? left * 0x8000 : left * 0x7fff, true);
    offset += 2;

    // Right channel
    const right = Math.max(-1, Math.min(1, rightSamples[i]));
    view.setInt16(offset, right < 0 ? right * 0x8000 : right * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Synthesizes a soothing, royal ambient chord progression loop (16 seconds)
 */
export function generateAmbientChronoTrack(): { url: string; duration: number } {
  const sampleRate = 44100;
  const duration = 16; // seconds
  const totalSamples = sampleRate * duration;
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  // Notes: F# minor chord progression (F#2, A2, C#3, E3, G#3)
  const rootFreqs = [92.5, 110.0, 138.59, 164.81, 207.65];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sampleL = 0;
    let sampleR = 0;

    // Soft envelope
    const env = Math.sin((t / duration) * Math.PI);

    // Warm chord voices
    for (let f = 0; f < rootFreqs.length; f++) {
      const freq = rootFreqs[f];
      const detune = 1.002;
      const shimmer = Math.sin(t * 0.5 + f * 0.8) * 0.05;

      const osc1 = Math.sin(2 * Math.PI * freq * t + shimmer);
      const osc2 = Math.sin(2 * Math.PI * (freq * detune) * t);
      const sub = Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.4;

      const voice = (osc1 + osc2 * 0.8 + sub) * (0.16 / rootFreqs.length);

      // Stereo spread
      sampleL += voice * (0.6 + 0.3 * Math.sin(t * 0.2 + f));
      sampleR += voice * (0.6 + 0.3 * Math.cos(t * 0.2 + f));
    }

    // Micro vinyl warm dust texture
    const dust = (Math.random() - 0.5) * 0.008;

    left[i] = (sampleL + dust) * env * 0.85;
    right[i] = (sampleR + dust) * env * 0.85;
  }

  const blob = createWavBlob(left, right, sampleRate);
  return {
    url: URL.createObjectURL(blob),
    duration,
  };
}

/**
 * Synthesizes a dark metallic phonk beat loop (12 seconds)
 */
export function generatePhonkPulseTrack(): { url: string; duration: number } {
  const sampleRate = 44100;
  const duration = 12; // seconds
  const totalSamples = sampleRate * duration;
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const bpm = 140;
  const beatDuration = 60 / bpm; // ~0.428s

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    // 808 Kick on beats
    const beatPhase = (t % beatDuration) / beatDuration;
    const kickPitch = 120 * Math.exp(-beatPhase * 18) + 40;
    const kickEnv = Math.exp(-beatPhase * 9);
    const kick = Math.sin(2 * Math.PI * kickPitch * t) * kickEnv * 0.6;

    // Cowbell synth melody on syncopated 16th notes
    const step16 = (t / (beatDuration / 4)) % 16;
    const isCowbellStep = [0, 3, 6, 9, 12, 14].includes(Math.floor(step16));
    const cowbellPhase = (t % (beatDuration / 4)) / (beatDuration / 4);
    const cowbellEnv = isCowbellStep ? Math.exp(-cowbellPhase * 12) : 0;
    const cowbellFreq = 587.33; // D5
    const cowbell = (Math.sin(2 * Math.PI * cowbellFreq * t) + 0.5 * Math.sin(2 * Math.PI * cowbellFreq * 1.5 * t)) * cowbellEnv * 0.25;

    // Sub rumble
    const sub = Math.sin(2 * Math.PI * 45 * t) * 0.2;

    sample = kick + cowbell + sub;

    left[i] = sample * 0.7;
    right[i] = sample * 0.7;
  }

  const blob = createWavBlob(left, right, sampleRate);
  return {
    url: URL.createObjectURL(blob),
    duration,
  };
}
