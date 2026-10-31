/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Fine glass-UI steps (bg-white/8, hover:bg-white/14 …). Without these the
      // colour-opacity modifiers are off the default scale and emit no CSS.
      opacity: {
        3: '0.03', 4: '0.04', 6: '0.06', 7: '0.07', 8: '0.08', 12: '0.12', 14: '0.14', 18: '0.18',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
