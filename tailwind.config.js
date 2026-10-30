/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // رفتار پیش‌فرض Tailwind 4 (که پروژه با آن ساخته شده) حفظ می‌شود
      borderColor: { DEFAULT: 'currentColor' },
      ringWidth: { DEFAULT: '1px' },
    },
  },
  plugins: [],
};
