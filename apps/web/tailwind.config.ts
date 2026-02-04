import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        arena: {
          bg: '#030308',
          surface: '#0a0a1a',
          border: '#1a1a2e',
        },
        neon: {
          purple: '#a855f7',
          blue: '#3b82f6',
          pink: '#ec4899',
          green: '#22c55e',
          amber: '#f59e0b',
          red: '#ef4444',
          cyan: '#06b6d4',
        },
        primary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'slide-down': 'slide-down 0.5s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(168, 85, 247, 0.8)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'radial-gradient(at 40% 20%, rgba(168, 85, 247, 0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(59, 130, 246, 0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(236, 72, 153, 0.1) 0px, transparent 50%)',
      },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.3), 0 0 60px rgba(168, 85, 247, 0.1)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3), 0 0 60px rgba(59, 130, 246, 0.1)',
        'glow-pink': '0 0 20px rgba(236, 72, 153, 0.3), 0 0 60px rgba(236, 72, 153, 0.1)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.3), 0 0 60px rgba(34, 197, 94, 0.1)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.3), 0 0 60px rgba(245, 158, 11, 0.1)',
        'glow-sm': '0 0 10px rgba(168, 85, 247, 0.2)',
        'glow-lg': '0 0 40px rgba(168, 85, 247, 0.4), 0 0 80px rgba(168, 85, 247, 0.2)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
