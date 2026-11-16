const assert = require('assert');

// 1. اختبار محرك التصميم المعتمد على المخزون
const availableFlowersMock = [
  { id: 1, name_ar: 'وردة جورية وردية', color: 'وردي', unit_price: '4.00', stock_quantity: 120, is_available: 1 },
  { id: 2, name_ar: 'توليب أبيض نقي', color: 'أبيض', unit_price: '5.00', stock_quantity: 85, is_available: 1 },
  { id: 3, name_ar: 'جبسوفيلا ناعمة', color: 'أبيض', unit_price: '5.00', stock_quantity: 60, is_available: 1 },
  { id: 4, name_ar: 'فاوانيا ملكية فاخرة', color: 'وردي مذهب', unit_price: '9.00', stock_quantity: 25, is_available: 1 },
  { id: 5, name_ar: 'وردة جورية حمراء', color: 'أحمر قرمزي', unit_price: '5.00', stock_quantity: 90, is_available: 1 },
  { id: 6, name_ar: 'أغصان أوكالبتوس مريمية', color: 'أخضر مريمي', unit_price: '3.00', stock_quantity: 75, is_available: 1 },
  { id: 7, name_ar: 'أوركيد ملكي فاخر', color: 'أزرق ثلجي', unit_price: '12.00', stock_quantity: 40, is_available: 1 },
  { id: 8, name_ar: 'عباد الشمس الذهبي', color: 'أصفر ذهبي', unit_price: '7.00', stock_quantity: 55, is_available: 1 },
  { id: 9, name_ar: 'زنابق الليلي العطرة', color: 'وردي عاجي', unit_price: '10.00', stock_quantity: 35, is_available: 1 }
];

function isDesignRequest(query) {
  const t = (query || '').toLowerCase();
  return /صمم|صمملي|تصميم|اخترلي|اختارلي|اقترحلي|توليفة|ركبلي|بوكيه|نسقلي|باقة جديدة|تنسيق باقة|شكل باقة|تشكيل باقة|اعملي باقة|جهزلي باقة|اقترح باقة/i.test(t);
}

function getFlowerKey(name, color = '') {
  const n = (name || '').toLowerCase();
  const c = (color || '').toLowerCase();
  if (n.includes('أحمر') || n.includes('حمراء') || c.includes('أحمر') || c.includes('قرمزي')) return 'red-rose';
  if (n.includes('توليب') || n.includes('tulip')) return 'white-tulip';
  if (n.includes('جيبسوفيلا') || n.includes('جبسوفيلا') || n.includes('طفل')) return 'baby-breath';
  if (n.includes('فاوانيا') || n.includes('بيوني') || n.includes('peony')) return 'peony';
  if (n.includes('أوكالبتوس') || n.includes('اوكالبتوس') || n.includes('مريمي') || n.includes('eucalyptus')) return 'eucalyptus';
  if (n.includes('أوركيد') || n.includes('اوركيد') || n.includes('orchid')) return 'orchid';
  if (n.includes('شمس') || n.includes('sunflower')) return 'sunflower';
  if (n.includes('ليلي') || n.includes('زنابق') || n.includes('lily')) return 'lily';
  if (n.includes('جوري') || n.includes('ورد') || c.includes('وردي')) return 'pink-rose';
  return 'red-rose';
}

function generateSmartFloralDesign(query, availableFlowers) {
  const q = (query || '').toLowerCase();
  
  const findFlower = (terms) => {
    return availableFlowers.find(f => {
      const name = (f.name_ar || '').toLowerCase();
      const color = (f.color || '').toLowerCase();
      return terms.some(term => name.includes(term) || color.includes(term));
    });
  };

  let theme = 'spring';
  if (/حب|رومانس|عاطف|زوج|زوجة|حبيب|أحمر|عشق/i.test(q)) theme = 'romantic';
  else if (/زفاف|عرس|خطوب|ملكة|عاج|عروس/i.test(q)) theme = 'wedding';
  else if (/تخرج|نجاح|تفوق|شهادة/i.test(q)) theme = 'graduation';
  else if (/فخم|ملكي|نادر|أوركيد|فاخر|هيبة/i.test(q)) theme = 'luxury';
  else if (/اعتذار|صلح|أسف/i.test(q)) theme = 'apology';

  let selectedStems = [];
  let bouquetName = 'باقة مسكة المتناسقة';
  let style = 'dome';
  let wrap = 'kraft';
  let wrapName = 'ورق كرافت فاخر';
  let ribbon = 'gold_rose';
  let ribbonName = 'وردي مذهب';
  let story = '';

  const redRose = findFlower(['حمراء', 'أحمر', 'جوري أحمر']);
  const pinkRose = findFlower(['وردية', 'وردي', 'جوري وردي']);
  const whiteTulip = findFlower(['توليب', 'أبيض نقي']);
  const babyBreath = findFlower(['جبسوفيلا', 'جيبسوفيلا', 'نَفَس الطفل']);
  const peony = findFlower(['فاوانيا', 'بيوني']);
  const eucalyptus = findFlower(['أوكالبتوس', 'اوكالبتوس', 'مريمية']);
  const orchid = findFlower(['أوركيد', 'اوركيد']);
  const sunflower = findFlower(['شمس', 'عباد']);
  const lily = findFlower(['ليلي', 'زنابق']);

  if (theme === 'romantic') {
    bouquetName = 'باقة نبض العاطفة الملكية';
    style = 'heart';
    wrap = 'olive';
    wrapName = 'زيتي مسكة ملكي';
    ribbon = 'crimson';
    ribbonName = 'أحمر قرمزي';
    story = 'توليفة مصممة خصيصاً للمشاعر الصادقة والرومانسية...';

    if (redRose && redRose.stock_quantity > 0) {
      selectedStems.push({ flower: redRose, qty: Math.min(7, redRose.stock_quantity), section: 'center' });
    }
    if (babyBreath && babyBreath.stock_quantity > 0) {
      selectedStems.push({ flower: babyBreath, qty: Math.min(4, babyBreath.stock_quantity), section: 'right' });
    }
    if (eucalyptus && eucalyptus.stock_quantity > 0) {
      selectedStems.push({ flower: eucalyptus, qty: Math.min(3, eucalyptus.stock_quantity), section: 'bottom' });
    }
  }

  const wrapPrice = 12.0;
  const flowersPrice = selectedStems.reduce((acc, item) => acc + (item.qty * parseFloat(item.flower.unit_price)), 0);
  const totalPrice = flowersPrice + wrapPrice;

  const designAction = {
    type: 'apply_bouquet_design',
    name: bouquetName,
    style: style,
    wrap: wrap,
    wrapName: wrapName,
    ribbon: ribbon,
    ribbonName: ribbonName,
    totalPrice: Math.round(totalPrice),
    story: story,
    stems: selectedStems.map(s => ({
      flower_id: s.flower.id,
      name: s.flower.name_ar,
      key: s.flower.key || getFlowerKey(s.flower.name_ar, s.flower.color),
      qty: s.qty,
      section: s.section,
      price: parseFloat(s.flower.unit_price),
      color: s.flower.color
    }))
  };

  return { designAction };
}

console.log('--- Testing Bouquet Design Generation ---');
assert.ok(isDesignRequest('صمملي باقة'));
assert.ok(isDesignRequest('صمملي باقة رومانسية فخمة'));
assert.ok(isDesignRequest('اخترلي ورد للباقة'));
assert.ok(!isDesignRequest('كم سعر التوصيل؟'));

const design = generateSmartFloralDesign('صمملي باقة رومانسية فخمة', availableFlowersMock);
console.log('Generated design:', JSON.stringify(design.designAction, null, 2));

assert.strictEqual(design.designAction.name, 'باقة نبض العاطفة الملكية');
assert.strictEqual(design.designAction.style, 'heart');
assert.strictEqual(design.designAction.wrap, 'olive');
assert.strictEqual(design.designAction.ribbon, 'crimson');
assert.ok(design.designAction.stems.length >= 3);
assert.ok(design.designAction.totalPrice > 0);

// التأكد من أن كل زهرة مختارة موجودة في المخزون وبكمية مسموحة
for (const stem of design.designAction.stems) {
  const original = availableFlowersMock.find(f => f.id === stem.flower_id);
  assert.ok(original, `Flower ${stem.name} must exist in inventory`);
  assert.ok(stem.qty <= original.stock_quantity, `Qty ${stem.qty} must be <= stock ${original.stock_quantity}`);
}

console.log('✅ All tests passed successfully!');
