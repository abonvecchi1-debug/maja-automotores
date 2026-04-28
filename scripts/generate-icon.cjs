'use strict';
const sharp = require('sharp');

sharp('assets/icon.svg')
  .resize(512, 512)
  .png()
  .toFile('assets/icon.png')
  .then(() => console.log('Icon generated: assets/icon.png'))
  .catch(err => { console.error('Error generating icon:', err); process.exit(1); });
