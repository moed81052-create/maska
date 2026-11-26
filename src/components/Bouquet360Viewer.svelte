<script>
  export let stems = [];
  export let viewMode = 'front'; // 'top' | 'front' | 'side' | 'back'
  export let templateId = 'round_dome';
  export let wrapColor = '#3a481c';
  export let wrapDarkColor = '#1c240d';
  export let ribbonColor = '#c59b27';
  export let waxColor = '#880e24';
  export let sealStamp = 'MASKA';
  export let scale = 0.52;
  export let flowerCatalog = [];

  const cleanPngTopKeys = [
    'red-rose', 'pink-rose', 'white-rose',
    'white-tulip', 'pink-tulip', 'baby-breath',
    'peony', 'eucalyptus', 'orchid', 'sunflower', 'lily'
  ];

  function getFlowerKey(name, color = '') {
    const n = (name || '').toLowerCase();
    const c = (color || '').toLowerCase();
    if (n.includes('أحمر') || n.includes('حمراء') || c.includes('أحمر') || c.includes('قرمزي')) return 'red-rose';
    if (n.includes('أبيض') || n.includes('بيضاء') || c.includes('أبيض') || c.includes('عاجي')) {
      if (n.includes('توليب')) return 'white-tulip';
      if (n.includes('جوري') || n.includes('ورد')) return 'white-rose';
      return 'white-rose';
    }
    if (n.includes('وردي') || c.includes('وردي')) {
      if (n.includes('بيوني') || n.includes('فاوانيا')) return 'peony';
      if (n.includes('ليلي') || n.includes('زنابق')) return 'lily';
      if (n.includes('توليب')) return 'pink-tulip';
      return 'pink-rose';
    }
    if (n.includes('توليب') || n.includes('tulip')) return 'white-tulip';
    if (n.includes('جيبسوفيلا') || n.includes('جبسوفيلا') || n.includes('طفل')) return 'baby-breath';
    if (n.includes('فاوانيا') || n.includes('بيوني') || n.includes('peony')) return 'peony';
    if (n.includes('أوكالبتوس') || n.includes('اوكالبتوس') || n.includes('كينا') || n.includes('eucalyptus')) return 'eucalyptus';
    if (n.includes('أوركيد') || n.includes('اوركيد') || n.includes('orchid')) return 'orchid';
    if (n.includes('شمس') || n.includes('sunflower')) return 'sunflower';
    if (n.includes('ليلي') || n.includes('زنابق') || n.includes('زنبق') || n.includes('lily')) return 'lily';
    if (n.includes('جوري') || n.includes('ورد')) return 'pink-rose';
    return 'red-rose';
  }

  function getFlowerAngleImage(stem) {
    const catalogMatch = flowerCatalog.find(f => f.id === stem.flowerId || f.name_ar === stem.flowerName);
    const key = stem.flowerKey || (catalogMatch && catalogMatch.key) || getFlowerKey(stem.flowerName || stem.name, stem.color);

    if (cleanPngTopKeys.includes(key)) {
      return `/assets/flowers/clean/${key}-top.png`;
    }
    if (catalogMatch && catalogMatch.image_top && catalogMatch.image_top.endsWith('.png')) {
      return catalogMatch.image_top;
    }
    if (catalogMatch && catalogMatch.image_front && catalogMatch.image_front.endsWith('.png')) {
      return catalogMatch.image_front;
    }
    return `/assets/flowers/clean/${key}-top.png`;
  }

  const frontTemplateIds = ['korean_fan', 'royal_celebration', 'royal_cascade', 'classic_front'];

  function getStemProjectedProps(stem, idx, total, targetView, tplId) {
    const nativeView = frontTemplateIds.includes(tplId) ? 'front' : 'top';

    let nx = 0;
    let ny = 0;
    if (nativeView === 'top') {
      nx = Math.max(-1, Math.min(1, (stem.x || 0) / 130));
      ny = Math.max(-1, Math.min(1, (stem.y || 0) / 130));
    } else {
      nx = Math.max(-1, Math.min(1, (stem.x || 0) / 105));
      ny = Math.max(-1, Math.min(1, ((stem.y || -70) + 70) / 55));
    }

    const radial = Math.sqrt(Math.min(1, nx * nx + ny * ny));

    if (targetView === 'top') {
      if (nativeView === 'top') {
        return {
          x: stem.x || 0,
          y: stem.y || 0,
          rotation: stem.rotation || 0,
          scale: stem.scale || 1,
          zIndex: stem.zIndex || (10 + idx)
        };
      }
      return {
        x: Math.round(nx * 108),
        y: Math.round(ny * 92),
        rotation: stem.rotation || Math.round(nx * 20),
        scale: (stem.scale || 1) * 0.96,
        zIndex: 20 + Math.round((1 - radial) * 40)
      };
    }

    if (targetView === 'front') {
      if (nativeView === 'front') {
        return {
          x: stem.x || 0,
          y: stem.y || -70,
          rotation: stem.rotation || 0,
          scale: stem.scale || 1,
          zIndex: stem.zIndex || (20 + idx)
        };
      }
      const domeArchLift = (1 - radial) * 18;
      return {
        x: Math.round(nx * 96),
        y: Math.round(-72 + ny * 38 - domeArchLift),
        rotation: Math.round(nx * 18),
        scale: (stem.scale || 1) * (0.94 + ny * 0.08),
        zIndex: Math.round(100 + ny * 50)
      };
    }

    if (targetView === 'side') {
      const domeElevation = (1 - radial) * 16;
      return {
        x: Math.round(18 + ny * 58),
        y: Math.round(-72 + nx * 26 - domeElevation + ny * 14),
        rotation: Math.round(24 + ny * 18),
        scale: (stem.scale || 1) * (0.92 + Math.max(0, nx) * 0.08),
        zIndex: Math.round(100 + nx * 50)
      };
    }

    // back view
    return {
      x: Math.round(-nx * 86),
      y: Math.round(-94 + Math.min(0, ny) * 24 - (1 - Math.abs(nx)) * 12),
      rotation: Math.round(-nx * 16),
      scale: (stem.scale || 1) * 0.90,
      zIndex: Math.round(45 - ny * 15)
    };
  }
</script>

<div class="b360-frame">
  <div class="b360-viewport is-{viewMode}" style="transform: scale({scale});">
    {#if viewMode === 'top'}
      <svg class="b360-wrap-top" viewBox="0 0 460 460">
        <polygon 
          points="230,8 270,38 318,22 340,68 392,70 395,120 440,145 422,195 454,230 422,265 440,315 395,340 392,390 340,392 318,438 270,422 230,452 190,422 142,438 120,392 68,390 65,340 20,315 38,265 6,230 38,195 20,145 65,120 68,70 120,68 142,22 190,38" 
          fill={wrapDarkColor} 
          stroke="rgba(218,165,32,0.85)" 
          stroke-width="2" 
        />
        <circle cx="230" cy="230" r="165" fill={wrapColor} stroke="rgba(218,165,32,0.75)" stroke-width="1.5" />
      </svg>
    {:else if viewMode === 'front'}
      <svg class="b360-wrap-back" viewBox="0 0 420 460">
        <path d="M 210,430 L 150,445 L 55,200 C 45,130 70,60 110,40 L 170,110 L 210,430 Z" fill={wrapColor} stroke="rgba(218,165,32,0.7)" stroke-width="1.8" />
        <path d="M 210,430 L 270,445 L 365,200 C 375,130 350,60 310,40 L 250,110 L 210,430 Z" fill={wrapDarkColor} stroke="rgba(218,165,32,0.7)" stroke-width="1.8" />
        <path d="M 210,20 C 240,25 300,50 330,105 C 340,165 310,265 240,380 L 210,440 L 180,380 C 110,265 80,165 90,105 C 120,50 180,25 210,20 Z" fill={wrapColor} stroke="rgba(218,165,32,0.7)" stroke-width="1.8" />
      </svg>
    {:else if viewMode === 'side'}
      <svg class="b360-wrap-side-back" viewBox="0 0 420 460">
        <path d="M 185,375 L 95,180 C 82,120 105,55 155,38 L 225,130 L 185,375 Z" fill={wrapColor} stroke="rgba(218,165,32,0.75)" stroke-width="1.8" />
        <path d="M 185,375 L 125,140 C 135,75 170,35 215,30 L 255,135 L 185,375 Z" fill={wrapDarkColor} stroke="rgba(218,165,32,0.65)" stroke-width="1.5" />
        <g fill="#4c6429" opacity="0.9">
          <ellipse cx="95" cy="125" rx="18" ry="8" transform="rotate(-35 95 125)" />
          <ellipse cx="78" cy="155" rx="15" ry="7" transform="rotate(-20 78 155)" />
          <ellipse cx="295" cy="195" rx="16" ry="7" transform="rotate(28 295 195)" />
        </g>
      </svg>
    {/if}

    <!-- الزهور الحية المسقطة بدقة لكل زاوية -->
    <div class="b360-stems-layer">
      {#each stems as stem, idx (stem.id || idx)}
        {@const proj = getStemProjectedProps(stem, idx, stems.length, viewMode, templateId)}
        <div 
          class="b360-stem-node"
          style="
            left: calc(50% + {proj.x}px);
            top: calc(50% + {proj.y}px);
            transform: translate(-50%, -50%) rotate({proj.rotation}deg) scale({proj.scale});
            z-index: {proj.zIndex};
          "
        >
          <img 
            src={getFlowerAngleImage(stem)} 
            alt={stem.flowerName || stem.name || 'ورد'}
            class="b360-stem-img"
            draggable="false"
          />
        </div>
      {/each}
    </div>

    {#if viewMode === 'front'}
      <svg class="b360-wrap-front" viewBox="0 0 380 280">
        <path d="M 45,70 C 80,55 140,75 190,65 C 240,75 300,55 335,70 C 320,115 260,138 190,142 C 120,138 60,115 45,70 Z" fill="#ffffff" opacity="0.92" stroke="rgba(218,165,32,0.7)" stroke-width="1.8" />
        <path d="M 55,60 C 95,50 140,85 190,115 L 205,200 L 170,275 L 140,275 L 105,245 C 70,195 48,130 55,60 Z" fill={wrapColor} stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
        <path d="M 325,60 C 285,50 240,85 180,125 L 175,205 L 210,275 L 240,275 L 275,245 C 310,195 332,130 325,60 Z" fill={wrapDarkColor} stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
      </svg>
      <div class="b360-ribbon-wax">
        <div class="b360-ribbon-band" style="background: {ribbonColor};"></div>
        <div class="b360-wax-seal" style="background: radial-gradient(circle at 35% 35%, #fff 0%, {waxColor} 40%, #1a0006 100%);">
          <div class="b360-wax-rim"><span>{sealStamp}</span></div>
        </div>
      </div>
    {:else if viewMode === 'side'}
      <svg class="b360-wrap-side-front" viewBox="0 0 420 460">
        <path d="M 125,215 C 175,245 245,235 305,205 C 295,235 250,255 195,255 C 150,255 128,238 125,215 Z" fill="#ffffff" opacity="0.92" stroke="rgba(218,165,32,0.65)" stroke-width="1.4" />
        <path d="M 125,220 C 175,245 245,235 302,210 L 210,410 L 175,410 L 125,220 Z" fill={wrapColor} stroke="rgba(218,165,32,0.8)" stroke-width="1.8" />
        <path d="M 178,405 L 172,438 L 204,438 L 208,405 Z" fill="#2d521d" />
        <path d="M 160,305 Q 202,312 246,298" stroke={ribbonColor} stroke-width="12" stroke-linecap="round" fill="none" />
        <ellipse cx="222" cy="306" rx="16" ry="22" transform="rotate(28 222 306)" fill={ribbonColor} />
        <circle cx="206" cy="305" r="8" fill="#d4af37" />
        <path d="M 208,312 Q 225,355 218,408" stroke={ribbonColor} stroke-width="5" stroke-linecap="round" fill="none" />
      </svg>
    {:else if viewMode === 'back'}
      <svg class="b360-wrap-back-view" viewBox="0 0 420 460">
        <path d="M 210,330 L 65,160 L 105,88 L 210,145 Z" fill={wrapDarkColor} stroke="rgba(218,165,32,0.75)" stroke-width="1.8" />
        <path d="M 210,330 L 355,160 L 315,88 L 210,145 Z" fill={wrapColor} stroke="rgba(218,165,32,0.75)" stroke-width="1.8" />
        <path d="M 210,335 L 95,125 L 210,95 L 325,125 Z" fill={wrapColor} stroke="rgba(218,165,32,0.85)" stroke-width="1.8" />
        <rect x="188" y="315" width="44" height="105" rx="8" fill="#2d521d" />
        <path d="M 178,318 Q 210,325 242,318" stroke={ribbonColor} stroke-width="12" stroke-linecap="round" fill="none" />
        <circle cx="210" cy="320" r="10" fill={ribbonColor} />
        <g transform="translate(210, 255)">
          <rect x="-46" y="-22" width="92" height="44" rx="8" fill="#ffffff" stroke="#c59b27" stroke-width="1.6" />
          <text x="0" y="-3" fill="#1e1e1e" font-size="11" font-weight="900" text-anchor="middle">{sealStamp || 'MASKA'}</text>
          <text x="0" y="12" fill="#888888" font-size="7" font-weight="700" text-anchor="middle">ATELIER ORIGINAL</text>
        </g>
      </svg>
    {/if}
  </div>
</div>

<style>
  .b360-frame {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .b360-viewport {
    position: relative;
    width: 420px;
    height: 460px;
    min-width: 420px;
    min-height: 460px;
    flex-shrink: 0;
    transform-origin: center center;
    pointer-events: none;
  }
  .b360-wrap-top {
    position: absolute;
    width: 440px;
    height: 440px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
  }
  .b360-wrap-back {
    position: absolute;
    width: 380px;
    height: 450px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 1;
    filter: drop-shadow(0 12px 24px rgba(0,0,0,0.16));
  }
  .b360-wrap-side-back {
    position: absolute;
    width: 400px;
    height: 450px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
  }
  .b360-wrap-side-front {
    position: absolute;
    width: 400px;
    height: 450px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 165;
  }
  .b360-wrap-back-view {
    position: absolute;
    width: 400px;
    height: 450px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 75;
  }
  .b360-stems-layer {
    position: absolute;
    inset: 0;
    z-index: 5;
  }
  .b360-stem-node {
    position: absolute;
    width: 68px;
    height: 68px;
  }
  .b360-stem-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 14px rgba(0,0,0,0.26));
  }
  .b360-wrap-front {
    position: absolute;
    width: 370px;
    height: 270px;
    left: 50%;
    bottom: 6px;
    transform: translateX(-50%);
    z-index: 155;
    filter: drop-shadow(0 10px 20px rgba(0,0,0,0.24));
  }
  .b360-ribbon-wax {
    position: absolute;
    left: 50%;
    bottom: 64px;
    transform: translateX(-50%);
    z-index: 170;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .b360-ribbon-band {
    width: 96px;
    height: 18px;
    border-radius: 6px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
  }
  .b360-wax-seal {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: -10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.35);
    border: 1.5px solid rgba(255,215,0,0.6);
  }
  .b360-wax-rim {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px dashed rgba(255,255,255,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .b360-wax-rim span {
    color: #fff;
    font-size: 6px;
    font-weight: 900;
    letter-spacing: 0.4px;
  }
</style>
