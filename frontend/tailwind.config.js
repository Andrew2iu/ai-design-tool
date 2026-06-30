/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主背景/板块色
        base: {
          50: '#faf8f5',
          100: '#efebe5',
          200: '#e0d9d0',
          300: '#ccc3b8',
        },
        // 主色：深蓝
        brand: {
          50: '#eef0fc',
          100: '#cdd3f7',
          200: '#a2aef2',
          400: '#5a6ee5',
          600: '#1c30ca',
          700: '#1628ad',
          800: '#0f1d84',
          900: '#0a1360',
        },
        // 强调色：暗红
        accent: {
          50: '#fceaea',
          100: '#f5c0bf',
          200: '#e88887',
          400: '#c84a47',
          600: '#9f3330',
          700: '#852a27',
          800: '#5e1e1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
