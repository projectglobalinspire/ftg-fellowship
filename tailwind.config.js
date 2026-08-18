module.exports = {
  content: [
    './*.html',
    './app.js',
    './donor.js'
  ],
  theme: {
    extend: {
      colors: {
        'ftg-green': '#1a5f4f',
        'ftg-navy': '#2c3e50',
        'ftg-purple': '#8b5cf6',
        'ftg-orange': '#f97316'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
