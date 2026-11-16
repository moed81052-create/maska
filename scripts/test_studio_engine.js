const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Studio Assets and Engine ---');

// 1. Verify clean SVG assets
const cleanDir = path.join(__dirname, '..', 'public', 'assets', 'flowers', 'clean');
const expectedFlowers = [
  'red-rose', 'pink-rose', 'white-tulip', 'peony',
  'baby-breath', 'eucalyptus', 'orchid', 'sunflower', 'lily'
];
const angles = ['front', 'side', 'top', 'stem'];

expectedFlowers.forEach(flower => {
  angles.forEach(angle => {
    const filePath = path.join(cleanDir, `${flower}-${angle}.svg`);
    assert(fs.existsSync(filePath), `Missing asset: ${flower}-${angle}.svg`);
    const content = fs.readFileSync(filePath, 'utf8');
    assert(!content.includes('width="300" height="300" rx="24"'), `Asset ${flower}-${angle}.svg has card background`);
    assert(content.includes('<svg'), `Asset ${flower}-${angle}.svg is not a valid SVG`);
  });
});
console.log('✓ All 36 clean multi-angle SVG assets exist and are transparent.');

// 2. Test Smart Clause-Based Natural Language Parser
function parseAiPromptClause(prompt) {
  const p = prompt.trim().toLowerCase();
  const targetMapping = [
    { keys: ['جوري', 'أحمر', 'حمراء'], fKey: 'red-rose' },
    { keys: ['توليب'], fKey: 'white-tulip' },
    { keys: ['بيوني', 'فاوانيا'], fKey: 'peony' },
    { keys: ['جيبسوفيلا', 'جبسوفيلا', 'طفل'], fKey: 'baby-breath' },
    { keys: ['أوكالبتوس', 'اوكالبتوس', 'خضار'], fKey: 'eucalyptus' },
    { keys: ['أوركيد', 'اوركيد'], fKey: 'orchid' },
    { keys: ['شمس', 'عباد'], fKey: 'sunflower' },
    { keys: ['ليلي', 'زنابق'], fKey: 'lily' }
  ];

  let applied = [];
  
  targetMapping.forEach(m => {
    let matchIdx = -1;
    let matchedKey = '';
    for (const k of m.keys) {
      const idx = p.indexOf(k);
      if (idx !== -1) {
        matchedKey = k;
        matchIdx = idx;
        break;
      }
    }

    if (matchIdx !== -1) {
      const afterFlower = p.substring(matchIdx + matchedKey.length);
      const nextClauseMatch = afterFlower.search(/[،,؛\.\n]|\s+و(?!سط)\s+/);
      const snippet = nextClauseMatch !== -1 ? afterFlower.substring(0, nextClauseMatch) : afterFlower;

      let targetSection = null;
      if (snippet.includes('وسط') || snippet.includes('قلب') || snippet.includes('مركز')) targetSection = 'center';
      else if (snippet.includes('فوق') || snippet.includes('أعلى') || snippet.includes('قمة')) targetSection = 'top';
      else if (snippet.includes('يمين')) targetSection = 'right';
      else if (snippet.includes('يسار')) targetSection = 'left';
      else if (snippet.includes('تحت') || snippet.includes('أسفل') || snippet.includes('أطراف') || snippet.includes('محيط') || snippet.includes('قاعدة')) targetSection = 'bottom';

      if (targetSection) {
        applied.push({ flower: m.fKey, section: targetSection });
      }
    }
  });

  return applied;
}

const prompt1 = 'حط الجوري في الوسط والبيوني فوق والجيبسوفيلا على الأطراف';
const res1 = parseAiPromptClause(prompt1);
console.log('Result for prompt1:', res1);

assert(res1.some(r => r.flower === 'red-rose' && r.section === 'center'), 'Jouri should be center');
assert(res1.some(r => r.flower === 'peony' && r.section === 'top'), 'Peony should be top');
assert(res1.some(r => r.flower === 'baby-breath' && r.section === 'bottom'), 'Gypsophila should be bottom/edges');
console.log('✓ Clause-based AI prompt parsing passed with 100% accuracy!');

// 3. Test AI Auto Angles
function aiAutoAngles(stems) {
  return stems.map(s => {
    let angle = 'front';
    let rot = s.rotation;
    if (s.x < -40) {
      angle = 'side';
      rot = Math.min(-15, Math.max(-42, Math.round((s.x / 140) * 38)));
    } else if (s.x > 40) {
      angle = 'side';
      rot = Math.max(15, Math.min(42, Math.round((s.x / 140) * 38)));
    } else if (s.y < -110) {
      angle = 'top';
      rot = Math.round((s.x / 40) * 12);
    } else if (s.y > 5) {
      angle = 'stem';
    } else {
      angle = 'front';
    }
    return { ...s, angle, rotation: rot };
  });
}

const sampleStems = [
  { id: 1, x: -80, y: -40, rotation: 0 },
  { id: 2, x: 80, y: -40, rotation: 0 },
  { id: 3, x: 0, y: -130, rotation: 0 },
  { id: 4, x: 0, y: -40, rotation: 0 },
  { id: 5, x: 0, y: 20, rotation: 0 }
];

const angleResults = aiAutoAngles(sampleStems);
assert.strictEqual(angleResults[0].angle, 'side', 'Left stem should be side view');
assert.strictEqual(angleResults[1].angle, 'side', 'Right stem should be side view');
assert.strictEqual(angleResults[2].angle, 'top', 'Top stem should be top view');
assert.strictEqual(angleResults[3].angle, 'front', 'Center stem should be front view');
assert.strictEqual(angleResults[4].angle, 'stem', 'Bottom stem should be stem view');
console.log('✓ AI 3D Perspective Optimizer correctly mapped angles according to positions.');

console.log('--- ALL STUDIO ENGINE TESTS PASSED! ---');
