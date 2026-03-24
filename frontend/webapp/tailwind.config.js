/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        poker: {
          dark:         '#121212',
          darker:       '#0a0a0a',
          card:         '#1c1c1c',
          border:       '#2a2a2a',
          gold:         '#d4a843',
          'gold-light': '#f0d078',
          'gold-dim':   '#8a6a1a',
          green:        '#1a6b3c',
          'green-felt': '#0d4a2a',
          red:          '#c0392b',
          blue:         '#2980b9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'noise': "url('/noise.png')",
        'felt': 'radial-gradient(ellipse at center, #1a6b3c 0%, #0d4a2a 50%, #082e1a 100%)',
      },
      boxShadow: {
        'gold':       '0 0 20px rgba(212, 168, 67, 0.3)',
        'gold-sm':    '0 0 10px rgba(212, 168, 67, 0.2)',
        'card':       '0 4px 20px rgba(0, 0, 0, 0.6)',
        'inset-gold': 'inset 0 1px 0 rgba(212,168,67,0.15)',
      },
    },
  },
  plugins: [],
}
