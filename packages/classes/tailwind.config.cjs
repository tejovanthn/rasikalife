/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@rasika/ui/tailwind-preset')],
  content: [
    './app/**/*.{ts,tsx}',
    // Without this, every class used only inside a shared primitive is purged and the buttons
    // render unstyled. It is the one thing about a shared component package that always breaks
    // first and never says why.
    '../ui/src/**/*.{ts,tsx}',
  ],
};
