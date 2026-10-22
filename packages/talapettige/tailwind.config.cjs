/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@rasika/ui/tailwind-preset')],
  content: ['./app/**/*.{ts,tsx}', '../ui/src/**/*.{ts,tsx}'],
};
