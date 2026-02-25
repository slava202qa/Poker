/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        poker: {
          dark: '#0a0e17',
          darker: '#060a12',
          card: '#141b2d',
          border: '#1e2a3a',
          gold: '#d4a843',
          'gold-light': '#f0d078',
          green: '#1a6b3c',
          'green-felt': '#0d4a2a',
          red: '#c0392b',
          blue: '#2980b9',
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
        'gold': '0 0 20px rgba(212, 168, 67, 0.3)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
