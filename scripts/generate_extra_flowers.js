const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'public', 'assets', 'flowers');
const cleanDir = path.join(srcDir, 'clean');

const extraFlowers = {
  orchid: {
    name: 'أوركيد عاجي ناصع',
    front: `
      <!-- Stem -->
      <path d="M150 170 Q145 230 152 280" stroke="#3a471b" stroke-width="7" stroke-linecap="round" fill="none"/>
      <!-- Leaves -->
      <path d="M148 215 Q105 205 90 225 Q115 235 148 220" fill="#3a471b" opacity="0.9"/>
      <path d="M152 235 Q195 230 210 245 Q180 260 152 240" fill="#3a471b" opacity="0.9"/>
      <!-- Orchid Bloom -->
      <g filter="url(#shadow)" transform="translate(150, 130)">
        <!-- Dorsal sepal -->
        <ellipse cx="0" cy="-45" rx="22" ry="38" fill="#fcfbf7" stroke="#e8e2d5" stroke-width="1"/>
        <!-- Lateral petals -->
        <ellipse cx="-48" cy="-10" rx="36" ry="24" transform="rotate(-15 -48 -10)" fill="#f7f4ed" stroke="#e8e2d5" stroke-width="1"/>
        <ellipse cx="48" cy="-10" rx="36" ry="24" transform="rotate(15 48 -10)" fill="#f7f4ed" stroke="#e8e2d5" stroke-width="1"/>
        <!-- Lateral sepals -->
        <ellipse cx="-30" cy="35" rx="20" ry="34" transform="rotate(35 -30 35)" fill="#fcfbf7" stroke="#e8e2d5" stroke-width="1"/>
        <ellipse cx="30" cy="35" rx="20" ry="34" transform="rotate(-35 30 35)" fill="#fcfbf7" stroke="#e8e2d5" stroke-width="1"/>
        <!-- Lip / Labellum -->
        <path d="M-22 15 C-25 45 0 52 22 15 C15 5 -15 5 -22 15 Z" fill="#fdf0b0"/>
        <circle cx="0" cy="18" r="8" fill="#e67e22"/>
        <circle cx="0" cy="22" r="4" fill="#8e44ad"/>
      </g>
    `,
    side: `
      <!-- Stem curved -->
      <path d="M165 170 Q180 230 160 280" stroke="#3a471b" stroke-width="7" stroke-linecap="round" fill="none"/>
      <!-- Sepals -->
      <path d="M140 160 L150 175 L165 168 L175 175 L180 158 Z" fill="#3a471b"/>
      <!-- Side Profile -->
      <g filter="url(#shadow)" transform="translate(150, 120)">
        <path d="M-40 25 C-45 -15 -15 -40 15 -35 C35 -30 45 10 35 35 C10 45 -20 40 -40 25 Z" fill="#fcfbf7" stroke="#e8e2d5"/>
        <path d="M-20 20 C-25 -5 0 -25 20 -20 C32 -10 30 20 18 30 Z" fill="#f7f4ed"/>
        <path d="M-5 15 C0 5 10 -10 20 -5 C25 5 18 20 5 20 Z" fill="#fdf0b0"/>
      </g>
    `,
    top: `
      <!-- Top View -->
      <g filter="url(#shadow)" transform="translate(150, 150)">
        <ellipse cx="0" cy="-55" rx="24" ry="40" fill="#fcfbf7"/>
        <ellipse cx="50" cy="0" rx="38" ry="25" fill="#f7f4ed"/>
        <ellipse cx="-50" cy="0" rx="38" ry="25" fill="#f7f4ed"/>
        <ellipse cx="35" cy="45" rx="22" ry="35" transform="rotate(-30 35 45)" fill="#fcfbf7"/>
        <ellipse cx="-35" cy="45" rx="22" ry="35" transform="rotate(30 -35 45)" fill="#fcfbf7"/>
        <circle cx="0" cy="15" r="16" fill="#fdf0b0"/>
        <circle cx="0" cy="15" r="8" fill="#e67e22"/>
      </g>
    `,
    stem: `
      <g transform="translate(150, 150)">
        <path d="M0 -110 Q-20 0 0 110" stroke="#3a471b" stroke-width="8" stroke-linecap="round" fill="none"/>
        <circle cx="-12" cy="-90" r="10" fill="#f7f4ed" stroke="#3a471b" stroke-width="2"/>
        <circle cx="10" cy="-60" r="14" fill="#f7f4ed" stroke="#3a471b" stroke-width="2"/>
        <path d="M-5 0 C-40 -20 -80 -10 -75 20 C-50 25 -20 10 0 5" fill="#3a471b"/>
        <path d="M5 40 C40 20 85 30 80 60 C55 65 25 50 0 45" fill="#3a471b"/>
      </g>
    `
  },
  sunflower: {
    name: 'عباد الشمس الذهبي',
    front: `
      <path d="M150 170 Q148 230 152 280" stroke="#2d3812" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M148 215 Q100 200 85 225 Q115 240 148 222" fill="#3a471b"/>
      <path d="M152 235 Q200 220 215 245 Q185 260 152 242" fill="#3a471b"/>
      <g filter="url(#shadow)" transform="translate(150, 130)">
        <!-- Petals ring -->
        ${Array.from({length: 16}).map((_, i) => {
          const angle = (i * 360) / 16;
          return `<ellipse cx="0" cy="-52" rx="14" ry="32" transform="rotate(${angle} 0 0)" fill="#f4b41a" opacity="0.95"/>`;
        }).join('')}
        <!-- Disc -->
        <circle cx="0" cy="0" r="34" fill="#4a2e12"/>
        <circle cx="0" cy="0" r="28" fill="#633e18"/>
        <circle cx="0" cy="0" r="18" fill="#7a4e1f"/>
      </g>
    `,
    side: `
      <path d="M165 170 Q175 230 158 280" stroke="#2d3812" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M140 160 L150 175 L165 168 L175 175 L180 158 Z" fill="#2d3812"/>
      <g filter="url(#shadow)" transform="translate(150, 120)">
        <ellipse cx="10" cy="0" rx="22" ry="48" fill="#f4b41a"/>
        <ellipse cx="-10" cy="0" rx="16" ry="44" fill="#d99914"/>
        <ellipse cx="-20" cy="0" rx="14" ry="38" fill="#4a2e12"/>
      </g>
    `,
    top: `
      <g filter="url(#shadow)" transform="translate(150, 150)">
        ${Array.from({length: 20}).map((_, i) => {
          const angle = (i * 360) / 20;
          return `<ellipse cx="0" cy="-58" rx="14" ry="34" transform="rotate(${angle} 0 0)" fill="#f4b41a"/>`;
        }).join('')}
        <circle cx="0" cy="0" r="38" fill="#4a2e12"/>
        <circle cx="0" cy="0" r="26" fill="#7a4e1f"/>
        <circle cx="0" cy="0" r="14" fill="#9e6628"/>
      </g>
    `,
    stem: `
      <g transform="translate(150, 150)">
        <line x1="0" y1="-100" x2="0" y2="110" stroke="#2d3812" stroke-width="12" stroke-linecap="round"/>
        <circle cx="0" cy="-105" r="20" fill="#f4b41a"/>
        <circle cx="0" cy="-105" r="12" fill="#4a2e12"/>
        <path d="M-5 -50 C-50 -70 -90 -40 -80 -10 C-50 -10 -20 -30 0 -35" fill="#3a471b"/>
        <path d="M5 0 C50 -20 90 10 80 40 C50 40 20 20 0 15" fill="#3a471b"/>
      </g>
    `
  },
  lily: {
    name: 'زنابق الليلي العطرة',
    front: `
      <path d="M150 170 Q145 230 152 280" stroke="#3a471b" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M148 210 Q110 200 100 220 Q120 230 148 215" fill="#3a471b" opacity="0.9"/>
      <path d="M152 230 Q190 225 200 240 Q175 255 152 235" fill="#3a471b" opacity="0.9"/>
      <g filter="url(#shadow)" transform="translate(150, 130)">
        ${Array.from({length: 6}).map((_, i) => {
          const angle = (i * 360) / 6;
          return `<path d="M0 0 Q-18 -55 0 -72 Q18 -55 0 0" transform="rotate(${angle} 0 0)" fill="#fceded" stroke="#f2c0cc" stroke-width="1.5"/>`;
        }).join('')}
        <circle cx="0" cy="0" r="10" fill="#ffd166"/>
        <line x1="0" y1="0" x2="-8" y2="-18" stroke="#a0304a" stroke-width="2"/>
        <line x1="0" y1="0" x2="8" y2="-18" stroke="#a0304a" stroke-width="2"/>
        <line x1="0" y1="0" x2="0" y2="-22" stroke="#a0304a" stroke-width="2"/>
      </g>
    `,
    side: `
      <path d="M165 170 Q180 230 160 280" stroke="#3a471b" stroke-width="8" stroke-linecap="round" fill="none"/>
      <g filter="url(#shadow)" transform="translate(150, 120)">
        <path d="M-40 30 C-45 -10 -20 -40 15 -35 C35 -30 45 10 35 35 C10 45 -20 45 -40 30 Z" fill="#fceded" stroke="#f2c0cc"/>
        <path d="M-15 15 C0 -5 20 -20 35 -15 C45 0 35 25 20 30 Z" fill="#fff" opacity="0.8"/>
      </g>
    `,
    top: `
      <g filter="url(#shadow)" transform="translate(150, 150)">
        ${Array.from({length: 6}).map((_, i) => {
          const angle = (i * 360) / 6;
          return `<path d="M0 0 Q-22 -65 0 -80 Q22 -65 0 0" transform="rotate(${angle} 0 0)" fill="#fceded" stroke="#f2c0cc" stroke-width="1.5"/>`;
        }).join('')}
        <circle cx="0" cy="0" r="12" fill="#ffd166"/>
      </g>
    `,
    stem: `
      <g transform="translate(150, 150)">
        <line x1="0" y1="-100" x2="0" y2="110" stroke="#3a471b" stroke-width="8" stroke-linecap="round"/>
        <path d="M-10 -95 Q0 -115 10 -95 Z" fill="#fceded"/>
        <path d="M-5 -50 C-40 -60 -70 -40 -65 -20 C-45 -20 -20 -35 0 -40" fill="#3a471b"/>
        <path d="M5 -10 C40 -20 70 0 65 20 C45 20 20 5 0 0" fill="#3a471b"/>
      </g>
    `
  }
};

const angles = ['front', 'side', 'top', 'stem'];
const angleLabels = {
  front: 'زاوية أمامية (Front View)',
  side: 'زاوية جانبية (Side View)',
  top: 'زاوية علوية (Top View)',
  stem: 'تفاصيل الساق والورق (Stem & Foliage)'
};

for (const [flowerKey, data] of Object.entries(extraFlowers)) {
  for (const angle of angles) {
    const body = data[angle];
    const fullSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="300" height="300" rx="24" fill="#faf6f0"/>
  <text x="150" y="32" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="#7d786d">${angleLabels[angle]}</text>
  ${body}
  <text x="150" y="285" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#5e6b2c">🌸 مسكة أتيليه | ${data.name}</text>
</svg>
    `.trim();

    const cleanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-opacity="0.12"/>
    </filter>
  </defs>
  ${body}
</svg>
    `.trim();

    const fileName = `${flowerKey}-${angle}.svg`;
    fs.writeFileSync(path.join(srcDir, fileName), fullSvg, 'utf8');
    fs.writeFileSync(path.join(cleanDir, fileName), cleanSvg, 'utf8');
  }
}

console.log('Successfully generated extra flower SVGs for orchid, sunflower, and lily');

