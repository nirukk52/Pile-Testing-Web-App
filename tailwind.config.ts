import type { Config } from 'tailwindcss';

/**
 * Tailwind configuration for PileTest Pro.
 * Why: Extends default Tailwind with our "Precision Engineering" design system
 * colors and utilities for consistent styling across the application.
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary colors from design system
        'structure-blue': '#2563eb',
        'midnight-slate': '#1e293b',
        // Functional status colors (IS 2911 Checks)
        'safe': '#10b981',
        'warning': '#f59e0b',
        'danger': '#e11d48',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Roboto Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;

