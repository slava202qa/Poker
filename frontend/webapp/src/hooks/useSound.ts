/**
 * Procedural sound effects using Web Audio API.
 * No external audio files needed — all sounds are synthesized.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

function playNoise(duration: number, volume: number, filterFreq: number) {
  const ctx = getCtx()
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = filterFreq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start()
}

function playTone(freq: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

export function useSound() {
  const cardFlip = () => {
    playNoise(0.08, 0.3, 2000)
  }

  const cardDeal = () => {
    playNoise(0.05, 0.15, 3000)
    setTimeout(() => playNoise(0.04, 0.1, 4000), 30)
  }

  const chipClick = () => {
    playTone(800, 0.06, 0.15, 'square')
    setTimeout(() => playTone(1200, 0.04, 0.1, 'square'), 20)
  }

  const chipStack = () => {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => playTone(600 + i * 150, 0.04, 0.08, 'square'), i * 30)
    }
  }

  const timerTick = () => {
    playTone(440, 0.05, 0.08, 'sine')
  }

  const timerWarning = () => {
    playTone(880, 0.1, 0.2, 'square')
  }

  const fold = () => {
    playNoise(0.12, 0.2, 1500)
    playTone(200, 0.15, 0.08, 'sine')
  }

  const check = () => {
    playTone(600, 0.08, 0.1, 'sine')
    setTimeout(() => playTone(800, 0.06, 0.08, 'sine'), 60)
  }

  const win = () => {
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, 0.15, 'sine'), i * 120)
    })
    setTimeout(() => chipStack(), 500)
  }

  const bigWin = () => {
    const notes = [523, 659, 784, 1047, 1319, 1568]
    notes.forEach((freq, i) => {
      setTimeout(() => {
        playTone(freq, 0.4, 0.2, 'sine')
        playTone(freq * 1.5, 0.3, 0.1, 'triangle')
      }, i * 100)
    })
    setTimeout(() => {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => chipClick(), i * 50)
      }
    }, 700)
  }

  const allIn = () => {
    playTone(220, 0.3, 0.2, 'sawtooth')
    setTimeout(() => playTone(330, 0.3, 0.15, 'sawtooth'), 100)
    setTimeout(() => playTone(440, 0.4, 0.2, 'sawtooth'), 200)
  }

  return {
    cardFlip, cardDeal, chipClick, chipStack,
    timerTick, timerWarning, fold, check,
    win, bigWin, allIn,
  }
}
