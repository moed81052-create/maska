<script>
  import { onMount, tick } from 'svelte';
  import { router } from '../stores/router.js';
  import { cart } from '../stores/cart.js';
  import { api } from '../lib/api.js';

  // 1. خيارات الزهور الافتراضية مع دعم زوايا الرؤية المتعددة
  let flowers = [
    {
      id: 1,
      name: 'جوري أحمر مخملي',
      color: '#c02741',
      key: 'red-rose',
      unit_price: 6.0,
      qty: 4,
      stock_quantity: 150,
      section: 'center'
    },
    {
      id: 2,
      name: 'أوركيد عاجي ناصع',
      color: '#f7f4ed',
      key: 'orchid',
      unit_price: 12.0,
      qty: 2,
      stock_quantity: 45,
      section: 'top'
    },
    {
      id: 3,
      name: 'عباد الشمس الذهبي',
      color: '#f4b41a',
      key: 'sunflower',
      unit_price: 7.0,
      qty: 0,
      stock_quantity: 60,
      section: 'center'
    },
    {
      id: 4,
      name: 'زنابق الليلي العطرة',
      color: '#fceded',
      key: 'lily',
      unit_price: 10.0,
      qty: 2,
      stock_quantity: 35,
      section: 'top'
    },
    {
      id: 5,
      name: 'توليب هولندي أبيض',
      color: '#f7f4ed',
      key: 'white-tulip',
      unit_price: 8.5,
      qty: 2,
      stock_quantity: 70,
      section: 'left'
    },
    {
      id: 6,
      name: 'جيبسوفيلا (نَفَس الطفل)',
      color: '#e8f0fe',
      key: 'baby-breath',
      unit_price: 4.5,
      qty: 3,
      stock_quantity: 110,
      section: 'right'
    },
    {
      id: 7,
      name: 'وردة جورية وردية',
      color: '#f28da5',
      key: 'pink-rose',
      unit_price: 5.5,
      qty: 0,
      stock_quantity: 80,
      section: 'center'
    },
    {
      id: 8,
      name: 'فاوانيا ملكية فاخرة',
      color: '#d4889c',
      key: 'peony',
      unit_price: 9.0,
      qty: 0,
      stock_quantity: 40,
      section: 'center'
    },
    {
      id: 9,
      name: 'أغصان أوكالبتوس مريمية',
      color: '#5e6b2c',
      key: 'eucalyptus',
      unit_price: 4.0,
      qty: 2,
      stock_quantity: 75,
      section: 'bottom'
    }
  ];

  // 2. خيارات التغليف الملكي
  const wrapOptions = [
    { id: 'kraft', name: 'ورق كرافت فاخر', price: 10, color: '#c8a882', darkColor: '#8a6e4d' },
    { id: 'olive', name: 'زيتي مسكة ملكي', price: 12, color: '#5e6b2c', darkColor: '#3a441b' },
    { id: 'blush', name: 'وردي مخملي ناعم', price: 12, color: '#f2c0cc', darkColor: '#b87586' },
    { id: 'black', name: 'أسود سهرة فاحم', price: 15, color: '#2b2b28', darkColor: '#151514' },
    { id: 'white', name: 'أبيض عاجي نقي', price: 10, color: '#f4ede4', darkColor: '#b5a999' },
    { id: 'gold', name: 'ذهبي شامبين عتيق', price: 16, color: '#d4af37', darkColor: '#8c7322' }
  ];
  let selectedWrap = wrapOptions[0];

  // 3. خيارات شريط الساتان
  const ribbonOptions = [
    { id: 'gold_rose', name: 'وردي مذهب', color: '#d4889c' },
    { id: 'sage', name: 'زيتي مسكة', color: '#5e6b2c' },
    { id: 'crimson', name: 'أحمر قرمزي', color: '#963547' },
    { id: 'silk_white', name: 'حرير عاجي', color: '#fcf8f6' },
    { id: 'royal_gold', name: 'ذهب ملكي', color: '#c59b27' }
  ];
  let selectedRibbon = ribbonOptions[0];

  // 4. خيارات الختم الشمعي
  const waxSealColors = [
    { id: 'red', name: 'أحمر قرمزي ملكي', hex: '#851b2f' },
    { id: 'gold', name: 'ذهبي عتيق', hex: '#c59b27' },
    { id: 'olive', name: 'أخضر زيتي مسكة', hex: '#48551f' },
    { id: 'plum', name: 'برغندي مخملي', hex: '#4a1525' }
  ];
  let selectedWaxColor = waxSealColors[0];

  let cardMessage = 'أجمل اللحظات هي التي تبدأ بوردة صادقة…';
  let sealStamp = 'MASKA 🌸';
  let is3DRotating = false;
  let showGrid = false;
  let activeTab = 'flowers'; // 'flowers' | 'ai' | 'stems' | 'packaging'
  let addedToast = false;

  // 5. سيقان الزهور الحية على اللوحة (Live Stems Canvas State)
  let stems = [];
  let selectedStemId = null;
  let canvasContainer = null;

  // حالات السحب والإفلات اليدوي الحر
  let isDragging = false;
  let dragStemId = null;
  let dragOffset = { x: 0, y: 0 };

  // الذكاء الاصطناعي (AI Florist Assistant)
  let aiPromptText = '';
  let aiStatusMessage = '✨ الذكاء الاصطناعي جاهز لمساعدتك في تنسيق وتحريك الباقة!';
  let aiIsThinking = false;
  let aiStylePreset = 'royal'; // 'royal' | 'dome' | 'boho' | 'heart'

  // خريطة مفاتيح الزهور لتحميل الصور الشفافة النظيفة
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

  // الحصول على رابط صورة الزاوية النظيفة للوردة
  function getFlowerAngleImage(flower, angle = 'front') {
    if (angle === 'front' && flower.image_front) return flower.image_front;
    if (angle === 'side' && flower.image_side) return flower.image_side;
    if (angle === 'top' && flower.image_top) return flower.image_top;
    if (angle === 'stem' && flower.image_stem) return flower.image_stem;
    
    if (flower.images_angles_json) {
      try {
        const parsed = typeof flower.images_angles_json === 'string' ? JSON.parse(flower.images_angles_json) : flower.images_angles_json;
        if (parsed && parsed[angle]) return parsed[angle];
      } catch (e) {}
    }

    const key = flower.key || getFlowerKey(flower.name, flower.color);
    return `/assets/flowers/clean/${key}-${angle}.svg`;
  }

  // توليد إحداثيات مبدئية طبيعية لكل قسم (Section Placement Coordinates)
  function getSectionCoordinates(section) {
    const jitterX = (Math.random() - 0.5) * 40;
    const jitterY = (Math.random() - 0.5) * 30;
    const jitterRot = (Math.random() - 0.5) * 16;

    switch (section) {
      case 'top':
        return {
          x: Math.round(jitterX),
          y: Math.round(-140 + jitterY),
          rotation: Math.round(jitterRot),
          angle: 'front',
          scale: 0.95
        };
      case 'center':
        return {
          x: Math.round(jitterX * 1.2),
          y: Math.round(-55 + jitterY),
          rotation: Math.round(jitterRot * 1.5),
          angle: 'front',
          scale: 1.15
        };
      case 'left':
        return {
          x: Math.round(-85 + jitterX * 0.8),
          y: Math.round(-65 + jitterY),
          rotation: Math.round(-24 + jitterRot),
          angle: 'side',
          scale: 0.98
        };
      case 'right':
        return {
          x: Math.round(85 + jitterX * 0.8),
          y: Math.round(-65 + jitterY),
          rotation: Math.round(24 + jitterRot),
          angle: 'side',
          scale: 0.98
        };
      case 'bottom':
      default:
        return {
          x: Math.round(jitterX * 1.3),
          y: Math.round(15 + jitterY),
          rotation: Math.round(jitterRot * 2),
          angle: 'stem',
          scale: 0.92
        };
    }
  }

  // توليد ساق جديدة
  function createStemInstance(flower, section = flower.section || 'center', indexInGroup = 0) {
    const coords = getSectionCoordinates(section);
    return {
      id: 'stem_' + flower.id + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      flowerId: flower.id,
      flowerName: flower.name,
      flowerKey: flower.key || getFlowerKey(flower.name, flower.color),
      color: flower.color,
      price: flower.unit_price,
      section: section,
      x: coords.x + (indexInGroup * 10 - 15),
      y: coords.y + (indexInGroup * 8 - 10),
      rotation: coords.rotation,
      scale: coords.scale,
      angle: coords.angle,
      zIndex: stems.length + 10
    };
  }

  // إعادة بناء السيقان الحية عند تحميل الصفحة
  function initializeStemsFromQuantities() {
    const newStems = [];
    flowers.forEach(f => {
      for (let i = 0; i < f.qty; i++) {
        newStems.push(createStemInstance(f, f.section, i));
      }
    });
    stems = newStems;
    aiAutoAngles();
  }

  onMount(async () => {
    try {
      const res = await api.getInventory();
      if (res && res.data && res.data.length > 0) {
        flowers = flowers.map(f => {
          const matched = res.data.find(inv => inv.id === f.id || inv.name_ar.includes(f.name.split(' ')[0]));
          if (matched) {
            return {
              ...f,
              name: matched.name_ar,
              unit_price: matched.unit_price,
              stock_quantity: matched.stock_quantity,
              image_front: matched.image_front,
              image_side: matched.image_side,
              image_top: matched.image_top,
              image_stem: matched.image_stem,
              images_angles_json: matched.images_angles_json
            };
          }
          return f;
        });
      }
    } catch (e) {
      console.log('Using default flower inventory in Studio');
    }

    initializeStemsFromQuantities();
  });

  // تعديل كمية الزهرة (+ أو -)
  function adjustQty(flowerId, delta) {
    const flower = flowers.find(f => f.id === flowerId);
    if (!flower) return;

    const nextQty = Math.max(0, Math.min(flower.stock_quantity, flower.qty + delta));
    if (nextQty === flower.qty) return;

    flower.qty = nextQty;
    flowers = [...flowers];

    if (delta > 0) {
      // إضافة ساق حية على اللوحة
      const newStem = createStemInstance(flower, flower.section);
      stems = [...stems, newStem];
      selectedStemId = newStem.id;
      aiStatusMessage = `🌸 أضيفت ساق جديدة من "${flower.name}" إلى ${getSectionNameAr(flower.section)}`;
    } else {
      // إزالة آخر ساق من هذا النوع
      let removeIdx = -1;
      for (let i = stems.length - 1; i >= 0; i--) {
        if (stems[i].flowerId === flowerId) {
          removeIdx = i;
          break;
        }
      }
      if (removeIdx !== -1) {
        const removed = stems[removeIdx];
        stems = stems.filter((_, idx) => idx !== removeIdx);
        if (selectedStemId === removed.id) {
          selectedStemId = stems.length > 0 ? stems[stems.length - 1].id : null;
        }
      }
    }
  }

  // تغيير قسم نوع الزهرة كاملاً (🔝 فوق، 🎯 وسط، 👉 يمين، 👈 يسار، 🔽 أسفل)
  function handleSectionChange(flowerId, newSection) {
    flowers = flowers.map(f => f.id === flowerId ? { ...f, section: newSection } : f);
    
    // تحريك جميع سيقان هذا النوع بشكل تفاعلي سلس إلى القسم المختار
    stems = stems.map(s => {
      if (s.flowerId === flowerId) {
        const coords = getSectionCoordinates(newSection);
        return {
          ...s,
          section: newSection,
          x: coords.x + Math.round((Math.random() - 0.5) * 30),
          y: coords.y + Math.round((Math.random() - 0.5) * 20),
          rotation: coords.rotation,
          angle: coords.angle
        };
      }
      return s;
    });

    const flower = flowers.find(f => f.id === flowerId);
    aiStatusMessage = `✨ تم نقل زهور "${flower ? flower.name : ''}" إلى قسم (${getSectionNameAr(newSection)})`;
  }

  function getSectionNameAr(sec) {
    switch (sec) {
      case 'top': return 'القمة والأعلى 🔝';
      case 'center': return 'القلب والوسط 🎯';
      case 'left': return 'الجهة اليسرى 👈';
      case 'right': return 'الجهة اليمنى 👉';
      case 'bottom': return 'القاعدة والمحيط 🔽';
      default: return sec;
    }
  }

  // --- محرر الوردة الفردية (Stem-by-Stem Inspector) ---
  $: selectedStem = stems.find(s => s.id === selectedStemId) || null;

  function setStemAngle(angle) {
    if (!selectedStem) return;
    selectedStem.angle = angle;
    stems = [...stems];
    aiStatusMessage = `📸 تم ضبط زاوية الرؤية إلى (${getAngleLabelAr(angle)})`;
  }

  function getAngleLabelAr(angle) {
    switch (angle) {
      case 'front': return 'أمامي 🌸';
      case 'side': return 'جانبي 🌿';
      case 'top': return 'علوي 🪷';
      case 'stem': return 'ساق وأوراق 🌾';
      default: return angle;
    }
  }

  function updateStemProp(prop, value) {
    if (!selectedStem) return;
    selectedStem[prop] = value;
    stems = [...stems];
  }

  function bringStemForward() {
    if (!selectedStem) return;
    const maxZ = Math.max(...stems.map(s => s.zIndex || 0), 10);
    selectedStem.zIndex = maxZ + 1;
    stems = [...stems];
  }

  function sendStemBackward() {
    if (!selectedStem) return;
    const minZ = Math.min(...stems.map(s => s.zIndex || 10), 10);
    selectedStem.zIndex = Math.max(1, minZ - 1);
    stems = [...stems];
  }

  function deleteSelectedStem() {
    if (!selectedStem) return;
    const fid = selectedStem.flowerId;
    stems = stems.filter(s => s.id !== selectedStem.id);
    const flower = flowers.find(f => f.id === fid);
    if (flower && flower.qty > 0) {
      flower.qty -= 1;
      flowers = [...flowers];
    }
    selectedStemId = stems.length > 0 ? stems[stems.length - 1].id : null;
    aiStatusMessage = `🗑️ تم حذف الساق المحددة`;
  }

  // --- السحب والإفلات اليدوي الحر (Freeform Drag & Drop) ---
  function startStemDrag(e, stemId) {
    e.stopPropagation();
    selectedStemId = stemId;
    isDragging = true;
    dragStemId = stemId;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (canvasContainer) {
      const rect = canvasContainer.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const stem = stems.find(s => s.id === stemId);
      if (stem) {
        dragOffset = {
          x: (clientX - centerX) - stem.x,
          y: (clientY - centerY) - stem.y
        };
      }
    }

    window.addEventListener('mousemove', onStemDragMove);
    window.addEventListener('mouseup', endStemDrag);
    window.addEventListener('touchmove', onStemDragMove, { passive: false });
    window.addEventListener('touchend', endStemDrag);
  }

  function onStemDragMove(e) {
    if (!isDragging || !dragStemId || !canvasContainer) return;
    if (e.preventDefault && e.touches) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const newX = Math.round(clientX - centerX - dragOffset.x);
    const newY = Math.round(clientY - centerY - dragOffset.y);

    // قيود الحركة داخل حدود المسرح
    const clampedX = Math.max(-145, Math.min(145, newX));
    const clampedY = Math.max(-185, Math.min(75, newY));

    stems = stems.map(s => {
      if (s.id === dragStemId) {
        return { ...s, x: clampedX, y: clampedY };
      }
      return s;
    });
  }

  function endStemDrag() {
    isDragging = false;
    dragStemId = null;
    window.removeEventListener('mousemove', onStemDragMove);
    window.removeEventListener('mouseup', endStemDrag);
    window.removeEventListener('touchmove', onStemDragMove);
    window.removeEventListener('touchend', endStemDrag);
  }

  // --- الذكاء الاصطناعي لتنسيق وتحريك وتشكيل الزهور (AI Florist Assistant) ---

  // 1. التنسيق الذكي بأنماط متعددة (AI Arranging Presets)
  function aiArrangeBouquet(preset = 'royal') {
    if (stems.length === 0) {
      alert('الرجاء اختيار بعض الزهور أولاً ليقوم الذكاء الاصطناعي بتنسيقها 🌸');
      return;
    }

    aiIsThinking = true;
    aiStylePreset = preset;

    setTimeout(() => {
      if (preset === 'royal') {
        // نمط هرمي ملكي: سيقان طويلة في القمة، زهور بارزة بالوسط، وفروع على الجوانب
        const sorted = [...stems].sort((a, b) => b.price - a.price);
        const total = sorted.length;

        stems = sorted.map((s, idx) => {
          let x, y, rot, angle;
          if (idx < Math.ceil(total * 0.25)) {
            // القمة الهرمية
            x = (idx - (total * 0.25) / 2) * 26;
            y = -150 + idx * 12;
            rot = (x / 140) * 20;
            angle = 'front';
          } else if (idx < Math.ceil(total * 0.7)) {
            // قلب الباقة المتوهج
            const localIdx = idx - Math.ceil(total * 0.25);
            x = ((localIdx % 3) - 1) * 45 + (Math.random() - 0.5) * 15;
            y = -85 + Math.floor(localIdx / 3) * 32;
            rot = (x / 140) * 25;
            angle = 'front';
          } else {
            // الأطراف والشلال السفلي
            const side = idx % 2 === 0 ? -1 : 1;
            x = side * (75 + Math.random() * 40);
            y = -35 + (idx % 3) * 25;
            rot = side * (26 + Math.random() * 15);
            angle = 'side';
          }
          return { ...s, x: Math.round(x), y: Math.round(y), rotation: Math.round(rot), angle };
        });
        aiStatusMessage = '👑 تم تطبيق "التنسيق الهرمي الملكي المتدرج" بالذكاء الاصطناعي!';

      } else if (preset === 'dome') {
        // باقة دائرية متناسقة كلاسيكية على مدار النسبة الذهبية
        const total = stems.length;
        stems = stems.map((s, idx) => {
          if (idx === 0) {
            return { ...s, x: 0, y: -65, rotation: 0, angle: 'front', scale: 1.2 };
          }
          const phi = (idx * 137.5 * Math.PI) / 180; // النسبة الذهبية
          const r = Math.sqrt(idx / total) * 115;
          const x = Math.round(Math.cos(phi) * r);
          const y = Math.round(Math.sin(phi) * (r * 0.85) - 65);
          const rot = Math.round((x / 120) * 30);
          const angle = Math.abs(x) > 60 ? 'side' : (y < -110 ? 'top' : 'front');
          return { ...s, x, y, rotation: rot, angle };
        });
        aiStatusMessage = '🎯 تم تشكيل "الباقة الدائرية المتناسقة" وفق النسبة الذهبية!';

      } else if (preset === 'boho') {
        // نمط بوهيمي عصري غير متناظر
        stems = stems.map((s, idx) => {
          const sideFactor = idx % 2 === 0 ? -1 : 1.2;
          const x = Math.round(sideFactor * (30 + Math.random() * 85));
          const y = Math.round(-145 + Math.random() * 140);
          const rot = Math.round((Math.random() - 0.45) * 65);
          const angles = ['front', 'side', 'top', 'stem'];
          const angle = angles[Math.floor(Math.random() * angles.length)];
          return { ...s, x, y, rotation: rot, angle };
        });
        aiStatusMessage = '🌿 تم تشكيل "التنسيق البوهيمي العصري غير المتناظر" بحرية فنية!';

      } else if (preset === 'heart') {
        // نمط القلب الرومانسي
        const total = stems.length;
        stems = stems.map((s, idx) => {
          const t = (idx / total) * Math.PI * 2;
          // معادلة القلب الرياضية
          const hx = 16 * Math.pow(Math.sin(t), 3);
          const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          const x = Math.round(hx * 5.8);
          const y = Math.round(hy * 5.5 - 55);
          const rot = Math.round((x / 110) * 25);
          return { ...s, x, y, rotation: rot, angle: 'front' };
        });
        aiStatusMessage = '💖 تم تشكيل "القلب الرومانسي المدمج" بالذكاء الاصطناعي!';
      }

      aiIsThinking = false;
    }, 450);
  }

  // 2. المحاكي الذكي لزوايا الرؤية ثلاثية الأبعاد (AI 3D Perspective Optimizer)
  function aiAutoAngles() {
    if (stems.length === 0) return;
    stems = stems.map(s => {
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
    aiStatusMessage = '🪄 تم ضبط زوايا الورود ثلاثية الأبعاد تلقائياً حسب موقع كل وردة!';
  }

  // 3. محرك الأوامر بالذكاء الاصطناعي (AI Natural Language Prompt Parser)
  function executeAiPrompt() {
    const p = aiPromptText.trim().toLowerCase();
    if (!p) {
      alert('الرجاء كتابة طلبك للمنسق الذكي أولاً 🌸');
      return;
    }

    aiIsThinking = true;

    setTimeout(() => {
      // 1. الكشف عن الأنماط العامة
      if (p.includes('هرمي') || p.includes('ملكي') || p.includes('متدرج')) {
        aiArrangeBouquet('royal');
        return;
      }
      if (p.includes('دائري') || p.includes('متناسق') || p.includes('متناغم') || p.includes('كروي')) {
        aiArrangeBouquet('dome');
        return;
      }
      if (p.includes('بوهيمي') || p.includes('عصري') || p.includes('عشوائي') || p.includes('طبيعي')) {
        aiArrangeBouquet('boho');
        return;
      }
      if (p.includes('قلب') || p.includes('رومانسي')) {
        aiArrangeBouquet('heart');
        return;
      }

      // 2. الكشف عن توزيع أنواع الورد المحددة
      let appliedDetails = [];

      const targetMapping = [
        { keys: ['جوري', 'أحمر', 'حمراء'], fKey: 'red-rose' },
        { keys: ['توليب'], fKey: 'white-tulip' },
        { keys: ['بيوني', 'فاوانيا'], fKey: 'peony' },
        { keys: ['جيبسوفيلا', 'جبسوفيلا', 'طفل'], fKey: 'baby-breath' },
        { keys: ['أوكالبتوس', 'اوكالبتوس', 'خضار', 'أغصان'], fKey: 'eucalyptus' },
        { keys: ['أوركيد', 'اوركيد'], fKey: 'orchid' },
        { keys: ['شمس', 'عباد'], fKey: 'sunflower' },
        { keys: ['ليلي', 'زنابق'], fKey: 'lily' }
      ];

      targetMapping.forEach(mapping => {
        let matchIdx = -1;
        let matchedKey = '';
        for (const k of mapping.keys) {
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
          else if (snippet.includes('يمين') || snippet.includes('اليمين')) targetSection = 'right';
          else if (snippet.includes('يسار') || snippet.includes('اليسار')) targetSection = 'left';
          else if (snippet.includes('تحت') || snippet.includes('أسفل') || snippet.includes('أطراف') || snippet.includes('محيط') || snippet.includes('قاعدة')) targetSection = 'bottom';

          if (targetSection) {
            const flower = flowers.find(f => f.key === mapping.fKey);
            if (flower) {
              handleSectionChange(flower.id, targetSection);
              appliedDetails.push(`${flower.name} في ${getSectionNameAr(targetSection)}`);
            }
          }
        }
      });

      // ضبط زوايا ذكية عامة إذا طلب زوايا
      if (p.includes('زوايا') || p.includes('جانبي') || p.includes('3d') || p.includes('ثلاثي')) {
        aiAutoAngles();
        appliedDetails.push('وضبط الزوايا ثلاثية الأبعاد');
      }

      aiIsThinking = false;

      if (appliedDetails.length > 0) {
        aiStatusMessage = `✨ نفّذ الذكاء الاصطناعي أمرك: وضع ${appliedDetails.join('، ')} بنجاح!`;
      } else {
        // توزيع ذكي متوازن افتراضي
        aiArrangeBouquet('royal');
        aiStatusMessage = `✨ تم تحليل نصك وتوزيع الباقة بنمط ذكي مخصص متناغم!`;
      }
    }, 400);
  }

  // حسابات إحصائيات الذكاء الاصطناعي (Harmony & Balance Scores)
  $: colorHarmonyScore = Math.min(98, Math.max(70, Math.round(75 + stems.length * 2.2)));
  $: visualBalanceScore = calculateVisualBalance(stems);
  function calculateVisualBalance(stemsList) {
    if (stemsList.length === 0) return 100;
    const avgX = stemsList.reduce((sum, s) => sum + s.x, 0) / stemsList.length;
    const score = Math.max(60, 100 - Math.round(Math.abs(avgX) * 0.8));
    return score;
  }

  // نصيحة الذكاء الاصطناعي اللحظية
  $: aiSuggestion = getAiSuggestion(stems, selectedWrap, colorHarmonyScore);
  function getAiSuggestion(stemsList, wrap, harmony) {
    if (stemsList.length === 0) return 'ابدأ بإضافة ورود الجوري أو التوليب لبناء قاعدة الباقة.';
    if (stemsList.length < 5) return '💡 نصيحة المنسق الذكي: إضافة 2-3 سيقان جيبسوفيلا أو أوكالبتوس سيعطي حجماً إضافياً وامتلاءً ملكياً.';
    if (wrap.id === 'black') return '✨ اختيار ورق السهرة الأسود يُبرز تباين الورود الزاهية بأسلوب فاخر وعصري.';
    if (wrap.id === 'kraft') return '🌿 التغليف الكرافت الكلاسيكي يمنح إحساساً بالأصالة والحدائق الإيطالية النضرة.';
    return '🌸 تناسق الألوان رائع ومتوازن، جاهز للاعتماد والتقديم بالختم الشمعي.';
  }

  // الحسابات المالية
  $: totalStems = flowers.reduce((sum, f) => sum + f.qty, 0);
  $: flowersCost = flowers.reduce((sum, f) => sum + (f.qty * f.unit_price), 0);
  $: grandTotal = Math.round(flowersCost + (selectedWrap.price || 0));

  // إضافة الباقة المصممة للسلة
  function handleAddCustomToCart() {
    if (totalStems < 3) {
      alert('الرجاء اختيار 3 سيقان زهور على الأقل لتنسيق باقة متناسقة 🌸');
      return;
    }

    const selectedFlowersList = flowers
      .filter(f => f.qty > 0)
      .map(f => ({ name: f.name, quantity: f.qty, price: f.unit_price, section: f.section }));

    cart.addItem({
      title: `باقة مخصصة (${totalStems} سيقان)`,
      price: grandTotal,
      quantity: 1,
      image: '/assets/flowers/clean/red-rose-front.svg',
      isCustom: true,
      wrapType: selectedWrap.name,
      ribbonColor: selectedRibbon.name,
      waxSealText: cardMessage,
      flowers: selectedFlowersList,
      stemsDetails: stems.map(s => ({ name: s.flowerName, angle: s.angle, x: s.x, y: s.y, rot: s.rotation }))
    });

    addedToast = true;
    setTimeout(() => {
      addedToast = false;
      router.navigate('/cart');
    }, 1200);
  }

  // 6. محادثة خبير مسكة للذكاء الاصطناعي في الأسفل (AI Florist Live Chat Stream)
  let chatInput = '';
  let chatIsLoading = false;
  let chatMessagesContainer = null;
  let chatMessages = [
    {
      id: 1,
      sender: 'ai',
      text: 'مرحباً بك في مسكة أتيليه! 🌸 أنا منسقك ومستشارك الذكي المتخصص في عالم الزهور الطبيعية. اسألني عن معاني الورود، دلالات الألوان، نصائح العناية وإطالة النضارة، أو اقترح لي تنسيقاً لباقة أحلامك!',
      isOffTopic: false,
      timestamp: 'الآن'
    }
  ];

  async function sendChatMessage(customText = null) {
    const textToSend = (customText || chatInput).trim();
    if (!textToSend || chatIsLoading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: textToSend,
      isOffTopic: false,
      timestamp: new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })
    };

    chatMessages = [...chatMessages, userMsg];
    chatInput = '';
    chatIsLoading = true;

    await tick();
    scrollChatToBottom();

    // فحص ما إذا كانت الرسالة تتضمن أمر تنسيق للباقة الحية
    const lower = textToSend.toLowerCase();
    if (lower.includes('حط') || lower.includes('وسط') || lower.includes('فوق') || lower.includes('هرمي') || lower.includes('دائري') || lower.includes('بوهيمي') || lower.includes('قلب')) {
      aiPromptText = textToSend;
      executeAiPrompt();
    }

    try {
      const res = await api.aiChat(textToSend, chatMessages.slice(-6), {
        currentFlowers: flowers.filter(f => f.qty > 0).map(f => ({ name: f.name, qty: f.qty, section: f.section })),
        wrap: selectedWrap.name,
        ribbon: selectedRibbon.name
      });

      if (res && res.reply) {
        chatMessages = [
          ...chatMessages,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: res.reply,
            isOffTopic: res.isOffTopic || false,
            timestamp: new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })
          }
        ];
      } else {
        throw new Error('No reply');
      }
    } catch (e) {
      chatMessages = [
        ...chatMessages,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: 'عذراً، حدث خطأ مؤقت في الاتصال بمساعد الذكاء الاصطناعي. يمكنك المحاولة مجدداً أو كتابة سؤالك في الزهور 🌸',
          isOffTopic: false,
          timestamp: new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })
        }
      ];
    } finally {
      chatIsLoading = false;
      await tick();
      scrollChatToBottom();
    }
  }

  function scrollChatToBottom() {
    if (chatMessagesContainer) {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  }
</script>

<div class="studio-page fade-in">
  <div class="container">
    <!-- رأس الصفحة -->
    <div class="studio-header">
      <div class="badge-cluster">
        <span class="badge badge-lime">استوديو التصميم الحي 💐</span>
        <span class="badge badge-gold">مدعوم بالذكاء الاصطناعي ✨</span>
      </div>
      <h1 class="page-title">صمّم باقتك وردة بوردة وتغليفاً</h1>
      <p class="page-subtitle">
        شاهد كل وردة تضاف وتتحرك حياً على اللوحة، وزّع الزهور في القمة أو الوسط أو الأطراف، حرّكها يدوياً أو دع الذكاء الاصطناعي يشكّلها ببراعة من جميع زوايا التصوير.
      </p>
    </div>

    {#if addedToast}
      <div class="studio-toast fade-in">
        🌸 تمت إضافة باقتك الملكية المنسقة إلى السلة! جاري الانتقال لصفحة إتمام الطلب...
      </div>
    {/if}

    <!-- تخطيط الاستوديو الرئيسي: شاشة التحكم يميناً والمعاينة الحية يساراً -->
    <div class="studio-layout">
      
      <!-- العمود الأول: أدوات وتفاصيل التصميم التفاعلي -->
      <div class="studio-controls">
        
        <!-- أشرطة التبويب الأربعة -->
        <div class="studio-tabs">
          <button 
            type="button" 
            class="tab-btn" 
            class:active={activeTab === 'flowers'}
            on:click={() => activeTab = 'flowers'}
          >
            🌸 زهور الباقة ({totalStems})
          </button>
          
          <button 
            type="button" 
            class="tab-btn" 
            class:active={activeTab === 'ai'}
            on:click={() => activeTab = 'ai'}
          >
            ✨ منسق الذكاء الاصطناعي
          </button>

          <button 
            type="button" 
            class="tab-btn" 
            class:active={activeTab === 'stems'}
            on:click={() => activeTab = 'stems'}
          >
            🔍 تعديل وردة بوردة
          </button>

          <button 
            type="button" 
            class="tab-btn" 
            class:active={activeTab === 'packaging'}
            on:click={() => activeTab = 'packaging'}
          >
            🎀 التغليف والشريط والكرت
          </button>
        </div>

        <!-- 1. تبويب اختيار الزهور وتوزيع الأقسام (فوق، وسط، يمين، يسار، قاعدة) -->
        {#if activeTab === 'flowers'}
          <div class="card control-box fade-in">
            <div class="box-head">
              <div>
                <h3>1. اختيار زهور الباقة وتحديد موقع كل نوع</h3>
                <p class="box-subdesc">اختر عدد السيقان وحدد موقعها المفضل في التنسيق:</p>
              </div>
              <span class="count-badge">{totalStems} ساق مختارة</span>
            </div>

            <div class="flowers-list">
              {#each flowers as f (f.id)}
                <div class="flower-row" class:has-qty={f.qty > 0}>
                  <div class="flower-meta">
                    <span class="color-dot" style="background-color: {f.color};"></span>
                    <div>
                      <h4 class="flower-name">{f.name}</h4>
                      <span class="flower-stock">المخزون المتوفر: {f.stock_quantity} ساق</span>
                    </div>
                  </div>

                  <div class="flower-price">
                    {f.unit_price} د.ل
                    <small>/ساق</small>
                  </div>

                  <!-- اختيار قسم التنسيق لنوع الوردة (Section Selector) -->
                  <div class="section-select-box">
                    <label for="sec-{f.id}" class="sr-only">موقع النوع:</label>
                    <select 
                      id="sec-{f.id}" 
                      class="section-dropdown"
                      value={f.section}
                      on:change={(e) => handleSectionChange(f.id, e.target.value)}
                    >
                      <option value="top">🔝 في القمة (أعلى)</option>
                      <option value="center">🎯 في الوسط (القلب)</option>
                      <option value="left">👈 على اليسار</option>
                      <option value="right">👉 على اليمين</option>
                      <option value="bottom">🔽 في الأسفل (القاعدة)</option>
                    </select>
                  </div>

                  <!-- عداد الزهور -->
                  <div class="qty-counter">
                    <button 
                      type="button" 
                      class="counter-btn" 
                      disabled={f.qty <= 0} 
                      on:click={() => adjustQty(f.id, -1)}
                      title="إنقاص ساق"
                    >
                      -
                    </button>
                    <span class="qty-val">{f.qty}</span>
                    <button 
                      type="button" 
                      class="counter-btn" 
                      disabled={f.qty >= f.stock_quantity} 
                      on:click={() => adjustQty(f.id, 1)}
                      title="إضافة ساق"
                    >
                      +
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- 2. تبويب منسق الذكاء الاصطناعي (AI Florist Assistant & Prompts) -->
        {#if activeTab === 'ai'}
          <div class="card control-box fade-in">
            <div class="ai-banner">
              <div class="ai-icon-ring">✨</div>
              <div>
                <h3>مساعد مسكة للذكاء الاصطناعي لتنسيق الورد</h3>
                <p>اكتب باللغة الطبيعية كيف تحب تشكيل باقتك، أو اختر نمطاً ذكياً لتوزيع وتدوير الزوايا تلقائياً.</p>
              </div>
            </div>

            <!-- شريط أوامر الذكاء الاصطناعي النصية (Prompt Bar) -->
            <div class="ai-prompt-container">
              <label class="prompt-label" for="ai-prompt-input">أوامر التنسيق النصية بالذكاء الاصطناعي:</label>
              <div class="ai-input-group">
                <input 
                  id="ai-prompt-input"
                  type="text" 
                  class="input-field ai-text-input" 
                  placeholder="مثال: حط الجوري في الوسط والبيوني فوق والجيبسوفيلا على الأطراف…"
                  bind:value={aiPromptText}
                  on:keydown={(e) => e.key === 'Enter' && executeAiPrompt()}
                />
                <button 
                  type="button" 
                  class="btn btn-primary ai-run-btn"
                  disabled={aiIsThinking}
                  on:click={executeAiPrompt}
                >
                  {#if aiIsThinking}
                    جاري التنسيق… ⏳
                  {:else}
                    نفّذ بالذكاء الاصطناعي ✨
                  {/if}
                </button>
              </div>

              <!-- أزرار أوامر جاهزة وسريعة -->
              <div class="quick-prompt-chips">
                <span class="quick-label">أوامر شائعة سريعة:</span>
                <button type="button" class="chip" on:click={() => { aiPromptText = 'حط الجوري في الوسط والبيوني فوق والجيبسوفيلا على الأطراف'; executeAiPrompt(); }}>
                  🌸 جوري وسط، بيوني فوق، جيبسوفيلا أطراف
                </button>
                <button type="button" class="chip" on:click={() => { aiPromptText = 'تنسيق هرمي ملكي متدرج'; executeAiPrompt(); }}>
                  👑 هرمي ملكي متدرج
                </button>
                <button type="button" class="chip" on:click={() => { aiPromptText = 'باقة دائرية متناسقة كلاسيكية'; executeAiPrompt(); }}>
                  🎯 باقة دائرية متناسقة
                </button>
                <button type="button" class="chip" on:click={() => { aiPromptText = 'تنسيق بوهيمي عصري غير متناظر'; executeAiPrompt(); }}>
                  🌿 بوهيمي عصري حر
                </button>
              </div>
            </div>

            <!-- أنماط التشكيل الجاهزة بالذكاء الاصطناعي -->
            <div class="ai-presets-section">
              <h4 class="section-title">أنماط التشكيل الجاهزة بالذكاء الاصطناعي:</h4>
              <div class="ai-presets-grid">
                <div 
                  class="preset-card" 
                  class:active={aiStylePreset === 'royal'}
                  on:click={() => aiArrangeBouquet('royal')}
                >
                  <span class="preset-icon">👑</span>
                  <div class="preset-title">هرمي ملكي متدرج</div>
                  <p class="preset-desc">سيقان طويلة بالقمة، ورود بارزة بالوسط، وفروع على الجوانب.</p>
                </div>

                <div 
                  class="preset-card" 
                  class:active={aiStylePreset === 'dome'}
                  on:click={() => aiArrangeBouquet('dome')}
                >
                  <span class="preset-icon">🎯</span>
                  <div class="preset-title">دائري متناسق متناغم</div>
                  <p class="preset-desc">توزيع متوازن حلزوني على أساس النسبة الذهبية والتناغم الدائري.</p>
                </div>

                <div 
                  class="preset-card" 
                  class:active={aiStylePreset === 'boho'}
                  on:click={() => aiArrangeBouquet('boho')}
                >
                  <span class="preset-icon">🌿</span>
                  <div class="preset-title">بوهيمي عصري حر</div>
                  <p class="preset-desc">ارتفاعات غير متناظرة مع زوايا متنوعة تمنح إحساس الطبيعة البرية.</p>
                </div>

                <div 
                  class="preset-card" 
                  class:active={aiStylePreset === 'heart'}
                  on:click={() => aiArrangeBouquet('heart')}
                >
                  <span class="preset-icon">💖</span>
                  <div class="preset-title">قلب رومانسي مدمج</div>
                  <p class="preset-desc">توزيع السيقان على شكل قلب أنيق يعبر عن أصدق مشاعر الود.</p>
                </div>
              </div>
            </div>

            <!-- زر ضبط الزوايا ثلاثية الأبعاد تلقائياً -->
            <div class="ai-angles-optimizer-box">
              <div>
                <h4 class="opt-title">🪄 اختيار الزوايا والتدوير ثلاثي الأبعاد بالذكاء الاصطناعي</h4>
                <p class="opt-desc">يحلل النظام موقع كل وردة بالنسبة للمركز ويختار الزاوية المناسبة (أمامي، جانبي، علوي) ويديرها بشكل واقعي 3D.</p>
              </div>
              <button 
                type="button" 
                class="btn btn-outline"
                on:click={aiAutoAngles}
              >
                تحسين الزوايا 3D الآن 🔄
              </button>
            </div>

            <!-- لوحة مقاييس التناغم الفني الذكي -->
            <div class="ai-analytics-panel">
              <h4 class="section-title">تحليل الذكاء الاصطناعي للباقة الحالية:</h4>
              <div class="analytics-bars">
                <div class="metric-row">
                  <div class="metric-head">
                    <span>تناغم الألوان وتكاملها 🎨</span>
                    <b>{colorHarmonyScore}%</b>
                  </div>
                  <div class="metric-track">
                    <div class="metric-fill" style="width: {colorHarmonyScore}%;"></div>
                  </div>
                </div>

                <div class="metric-row">
                  <div class="metric-head">
                    <span>التوازن البصري وتوزيع الكتل ⚖️</span>
                    <b>{visualBalanceScore}%</b>
                  </div>
                  <div class="metric-track">
                    <div class="metric-fill balance-fill" style="width: {visualBalanceScore}%;"></div>
                  </div>
                </div>
              </div>

              <div class="ai-suggestion-box">
                <span class="sug-icon">💡</span>
                <p>{aiSuggestion}</p>
              </div>
            </div>

          </div>
        {/if}

        <!-- 3. تبويب التعديل الدقيق وردة بوردة (Stem-by-Stem Inspector) -->
        {#if activeTab === 'stems'}
          <div class="card control-box fade-in">
            <div class="box-head">
              <div>
                <h3>محرر الوردة الفردية (وردة بوردة) 🔍</h3>
                <p class="box-subdesc">انقر على أي وردة في اللوحة أو اخترها أدناه لتعديل زاوية تصويرها ودورانها:</p>
              </div>
              <span class="count-badge">{stems.length} سيقان</span>
            </div>

            {#if stems.length === 0}
              <div class="empty-stems-state">
                <p>لا توجد زهور في اللوحة حالياً. انتقل إلى تبويب "زهور الباقة" وأضف بعض السيقان 🌸</p>
                <button type="button" class="btn btn-outline" on:click={() => activeTab = 'flowers'}>
                  الذهاب لاختيار الزهور
                </button>
              </div>
            {:else}
              <!-- قائمة اختيار الساق السريع -->
              <div class="stems-pill-carousel">
                {#each stems as stem, idx (stem.id)}
                  <button 
                    type="button" 
                    class="stem-select-chip" 
                    class:active={selectedStemId === stem.id}
                    on:click={() => selectedStemId = stem.id}
                  >
                    <span class="chip-color" style="background: {stem.color};"></span>
                    <span>ساق #{idx + 1} ({stem.flowerName.split(' ')[0]})</span>
                  </button>
                {/each}
              </div>

              {#if selectedStem}
                <div class="stem-inspector-card fade-in">
                  <div class="inspector-header">
                    <div class="insp-title">
                      <span class="color-dot" style="background: {selectedStem.color};"></span>
                      <h4>{selectedStem.flowerName}</h4>
                      <span class="badge badge-lime">الموقع: {getSectionNameAr(selectedStem.section)}</span>
                    </div>

                    <button 
                      type="button" 
                      class="btn-delete-stem" 
                      title="حذف هذه الساق"
                      on:click={deleteSelectedStem}
                    >
                      حذف الساق 🗑️
                    </button>
                  </div>

                  <!-- 1. تبديل زوايا التصوير (أمامي، جانبي، علوي، ساق) -->
                  <div class="inspector-group">
                    <label class="insp-label">زاوية الرؤية والتصوير الفوتوغرافي:</label>
                    <div class="angle-buttons-grid">
                      <button 
                        type="button" 
                        class="angle-btn" 
                        class:active={selectedStem.angle === 'front'}
                        on:click={() => setStemAngle('front')}
                      >
                        <span class="ang-icon">🌸</span>
                        <span>أمامي</span>
                        <small>Front</small>
                      </button>

                      <button 
                        type="button" 
                        class="angle-btn" 
                        class:active={selectedStem.angle === 'side'}
                        on:click={() => setStemAngle('side')}
                      >
                        <span class="ang-icon">🌿</span>
                        <span>جانبي</span>
                        <small>Side</small>
                      </button>

                      <button 
                        type="button" 
                        class="angle-btn" 
                        class:active={selectedStem.angle === 'top'}
                        on:click={() => setStemAngle('top')}
                      >
                        <span class="ang-icon">🪷</span>
                        <span>علوي</span>
                        <small>Top View</small>
                      </button>

                      <button 
                        type="button" 
                        class="angle-btn" 
                        class:active={selectedStem.angle === 'stem'}
                        on:click={() => setStemAngle('stem')}
                      >
                        <span class="ang-icon">🌾</span>
                        <span>ساق وأوراق</span>
                        <small>Stem & Foliage</small>
                      </button>
                    </div>
                  </div>

                  <!-- 2. زاوية الدوران والحجم والطبقات -->
                  <div class="inspector-sliders-grid">
                    <div class="slider-box">
                      <div class="slider-label-row">
                        <span>زاوية الدوران والالتواء:</span>
                        <b>{selectedStem.rotation}°</b>
                      </div>
                      <input 
                        type="range" 
                        min="-60" 
                        max="60" 
                        step="2" 
                        class="slider-field"
                        value={selectedStem.rotation}
                        on:input={(e) => updateStemProp('rotation', parseInt(e.target.value, 10))}
                      />
                    </div>

                    <div class="slider-box">
                      <div class="slider-label-row">
                        <span>حجم رأس الوردة:</span>
                        <b>{Math.round(selectedStem.scale * 100)}%</b>
                      </div>
                      <input 
                        type="range" 
                        min="0.7" 
                        max="1.35" 
                        step="0.05" 
                        class="slider-field"
                        value={selectedStem.scale}
                        on:input={(e) => updateStemProp('scale', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>

                  <!-- 3. ترتيب الطبقات (تقديم أو تأخير) -->
                  <div class="layer-controls-row">
                    <span class="layer-label">ترتيب الطبقة (Stacking):</span>
                    <div class="layer-btns">
                      <button type="button" class="btn btn-sm btn-outline" on:click={bringStemForward}>
                        تقديم للأمام ⬆️
                      </button>
                      <button type="button" class="btn btn-sm btn-outline" on:click={sendStemBackward}>
                        تأخير للخلف ⬇️
                      </button>
                    </div>
                  </div>

                  <div class="drag-tip-box">
                    💡 تلميح: يمكنك أيضاً سحب وتحريك هذه الوردة يدوياً بالماوس أو اللمس مباشرة على لوحة المعاينة!
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        {/if}

        <!-- 4. تبويب التغليف الملكي وشريط الساتان والختم الشمعي -->
        {#if activeTab === 'packaging'}
          <div class="card control-box fade-in">
            <div class="box-head">
              <div>
                <h3>أغلفة الباقة، شريط الساتان، والختم الشمعي 🎀</h3>
                <p class="box-subdesc">تدخل الأغلفة مباشرة في تشكيل وتغليف الباقة في اللوحة الحية:</p>
              </div>
            </div>

            <!-- أ. ورق التغليف الملكي -->
            <div class="pkg-section">
              <label class="pkg-label">1. نوع ورق التغليف الفاخر:</label>
              <div class="options-grid">
                {#each wrapOptions as wrap (wrap.id)}
                  <div 
                    class="option-pill" 
                    class:selected={selectedWrap.id === wrap.id}
                    on:click={() => { selectedWrap = wrap; aiStatusMessage = `🎁 تم تغيير ورق التغليف إلى (${wrap.name})`; }}
                  >
                    <span class="option-color" style="background: {wrap.color};"></span>
                    <div class="opt-info">
                      <span class="opt-name">{wrap.name}</span>
                      <small class="opt-price">+{wrap.price} د.ل</small>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- ب. لون شريط الساتان -->
            <div class="pkg-section">
              <label class="pkg-label">2. لون شريط الساتان المربوط:</label>
              <div class="options-grid">
                {#each ribbonOptions as ribbon (ribbon.id)}
                  <div 
                    class="option-pill" 
                    class:selected={selectedRibbon.id === ribbon.id}
                    on:click={() => { selectedRibbon = ribbon; aiStatusMessage = `🎀 تم تغيير شريط الساتان إلى (${ribbon.name})`; }}
                  >
                    <span class="option-color" style="background: {ribbon.color};"></span>
                    <span class="opt-name">{ribbon.name}</span>
                  </div>
                {/each}
              </div>
            </div>

            <!-- ج. كرت الإهداء والختم الشمعي -->
            <div class="pkg-section">
              <label class="pkg-label">3. كرت الإهداء والختم الشمعي (مجاناً):</label>
              <textarea 
                rows="3" 
                class="textarea-field card-msg-input" 
                bind:value={cardMessage} 
                placeholder="اكتب رسالتك الدافئة لمن تحب…"
              ></textarea>

              <div class="seal-config-grid">
                <div>
                  <label class="sub-label">لون الشمع الملكي:</label>
                  <div class="wax-colors-list">
                    {#each waxSealColors as wax (wax.id)}
                      <button 
                        type="button" 
                        class="wax-dot" 
                        class:active={selectedWaxColor.id === wax.id}
                        style="background: {wax.hex};" 
                        title={wax.name}
                        on:click={() => selectedWaxColor = wax}
                      ></button>
                    {/each}
                    <span class="wax-name-display">{selectedWaxColor.name}</span>
                  </div>
                </div>

                <div>
                  <label class="sub-label" for="seal-stamp-select">نقشة الختم الشمعي:</label>
                  <select id="seal-stamp-select" class="input-field" bind:value={sealStamp}>
                    <option value="MASKA 🌸">MASKA 🌸 (شعار مسكة الرسمي)</option>
                    <option value="زهرة اللوتس 🪷">زهرة اللوتس الملكية</option>
                    <option value="غصن الزيتون 🌿">غصن الزيتون والأصالة</option>
                    <option value="تاج المحبة 👑">تاج المحبة والتقدير</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        {/if}

      </div>

      <!-- العمود الثاني: مسرح المعاينة الحية والتغليف والطلب (Sticky Preview Stage) -->
      <aside class="studio-preview-col">
        <div class="card preview-card">
          
          <div class="preview-header">
            <div>
              <h3 class="preview-title">معاينة الباقة الحية</h3>
              <span class="preview-subtitle">{stems.length} وردة منسقة | {selectedWrap.name}</span>
            </div>

            <!-- أزرار التحكم بالمسرح -->
            <div class="stage-actions">
              <button 
                type="button" 
                class="stage-tool-btn" 
                class:active={showGrid}
                title="إظهار/إخفاء شبكة التوجيه"
                on:click={() => showGrid = !showGrid}
              >
                📐
              </button>

              <button 
                type="button" 
                class="stage-tool-btn" 
                class:active={is3DRotating}
                title={is3DRotating ? 'إيقاف الدوران' : 'دوران 360°'}
                on:click={() => is3DRotating = !is3DRotating}
              >
                {is3DRotating ? '⏸' : '🔄'}
              </button>
            </div>
          </div>

          <!-- شريط حالة وتنبيه الذكاء الاصطناعي اللحظي -->
          <div class="ai-status-strip">
            <span class="ai-spark">✨</span>
            <span class="ai-strip-text">{aiStatusMessage}</span>
          </div>

          <!-- لوحة المسرح المرئي (Interactive Canvas Viewport) -->
          <div 
            class="stage-viewport" 
            class:rotating={is3DRotating}
            class:with-grid={showGrid}
            bind:this={canvasContainer}
          >
            <!-- 1. خلفية ورق التغليف الملكي (Back Wrap Folds) -->
            <svg class="wrap-back-svg" viewBox="0 0 340 400" preserveAspectRatio="none">
              <defs>
                <linearGradient id="wrapBackGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="{selectedWrap.color}" stop-opacity="0.9" />
                  <stop offset="60%" stop-color="{selectedWrap.color}" />
                  <stop offset="100%" stop-color="{selectedWrap.darkColor}" stop-opacity="0.95" />
                </linearGradient>
                <filter id="wrapShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="8" stdDeviation="10" flood-opacity="0.25"/>
                </filter>
              </defs>
              
              <!-- الجناح الأيسر لورق التغليف -->
              <path d="M 30,70 L 135,270 L 170,350 L 90,230 Z" fill="url(#wrapBackGrad)" opacity="0.9" />
              <!-- الجناح الأيمن لورق التغليف -->
              <path d="M 310,70 L 205,270 L 170,350 L 250,230 Z" fill="url(#wrapBackGrad)" opacity="0.9" />
              <!-- مخروط الحزام الخلفي -->
              <path d="M 60,110 Q 170,30 280,110 L 225,320 Q 170,360 115,320 Z" fill="url(#wrapBackGrad)" filter="url(#wrapShadow)" />
            </svg>

            <!-- 2. طبقة سيقان الزهور الحية التفاعلية (Draggable Stems Layer) -->
            <div class="stems-layer">
              {#if stems.length === 0}
                <div class="canvas-empty-hint">
                  <span>🌸 الباقة فارغة حالياً</span>
                  <small>أضف سيقان الورد من القائمة لتظهر هنا فوراً!</small>
                </div>
              {/if}

              {#each stems as stem (stem.id)}
                <div 
                  class="stem-canvas-node"
                  class:selected={selectedStemId === stem.id}
                  style="
                    left: calc(50% + {stem.x}px);
                    top: calc(50% + {stem.y}px);
                    transform: translate(-50%, -50%) rotate({stem.rotation}deg) scale({stem.scale});
                    z-index: {stem.zIndex || 10};
                  "
                  on:mousedown={(e) => startStemDrag(e, stem.id)}
                  on:touchstart={(e) => startStemDrag(e, stem.id)}
                  on:click={() => { selectedStemId = stem.id; activeTab = 'stems'; }}
                  role="button"
                  tabindex="0"
                  title="{stem.flowerName} ({getAngleLabelAr(stem.angle)}) - اسحب للتحريك اليدوي"
                >
                  <img 
                    src={getFlowerAngleImage(flowers.find(f => f.id === stem.flowerId) || { key: stem.flowerKey }, stem.angle)} 
                    alt={stem.flowerName}
                    class="stem-img"
                    draggable="false"
                  />
                  
                  {#if selectedStemId === stem.id}
                    <div class="stem-active-ring"></div>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- 3. مقدمة ورق التغليف الملكي (Front Wrap Cone Folds) -->
            <svg class="wrap-front-svg" viewBox="0 0 340 240">
              <defs>
                <linearGradient id="wrapFrontGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="{selectedWrap.color}" />
                  <stop offset="100%" stop-color="{selectedWrap.darkColor}" />
                </linearGradient>
                <filter id="frontFoldShadow">
                  <feDropShadow dx="0" dy="5" stdDeviation="6" flood-opacity="0.28"/>
                </filter>
              </defs>
              <!-- الثنية اليسرى فوق السيقان -->
              <path d="M 50,20 L 170,180 L 145,235 L 100,210 L 65,115 Z" fill="url(#wrapFrontGrad)" filter="url(#frontFoldShadow)" />
              <!-- الثنية اليمنى متداخلة بنعومة -->
              <path d="M 290,20 L 125,185 L 150,235 L 210,210 L 275,115 Z" fill="{selectedWrap.color}" opacity="0.95" filter="url(#frontFoldShadow)" />
              <!-- خط لمعان وطيات أنيقة -->
              <line x1="290" y1="20" x2="140" y2="195" stroke="#ffffff" stroke-width="1.8" opacity="0.35" />
            </svg>

            <!-- 4. شريط الساتان والختم الشمعي الملكي المدمج -->
            <div class="ribbon-wax-wrap">
              <!-- شريط الساتان الملفوف -->
              <div class="satin-ribbon-band" style="background: {selectedRibbon.color};"></div>
              
              <!-- ذيول الشريط المتدلية -->
              <div class="ribbon-tails-container">
                <span class="ribbon-tail tail-left" style="background: {selectedRibbon.color};"></span>
                <span class="ribbon-tail tail-right" style="background: {selectedRibbon.color};"></span>
              </div>

              <!-- الختم الشمعي الملكي الفاخر -->
              <div 
                class="wax-seal-emblem" 
                style="background: radial-gradient(circle at 35% 35%, #fff 0%, {selectedWaxColor.hex} 40%, #1a0006 100%);"
                title="الختم الشمعي: {selectedWaxColor.name} | {sealStamp}"
              >
                <div class="wax-seal-rim">
                  <span class="wax-seal-text">{sealStamp}</span>
                </div>
              </div>
            </div>

            <!-- قاعدة العرض الرخامية في الأسفل -->
            <div class="stage-pedestal"></div>
          </div>

          <!-- ملخص التكلفة وإتمام الباقة -->
          <div class="preview-summary">
            <div class="summary-line">
              <span>زهور طبيعية مستوردة ({totalStems} ساق):</span>
              <b>{flowersCost.toFixed(1)} د.ل</b>
            </div>
            <div class="summary-line">
              <span>التغليف الملكي ({selectedWrap.name}):</span>
              <b>{selectedWrap.price} د.ل</b>
            </div>
            <div class="summary-line">
              <span>شريط الساتان والختم الشمعي المخصص:</span>
              <b class="free-badge">مجاني 🌸</b>
            </div>

            <div class="total-bar">
              <span>إجمالي الباقة المصممة:</span>
              <span class="total-price">{grandTotal} د.ل</span>
            </div>

            <button 
              type="button" 
              class="btn btn-primary btn-block btn-lg cta-cart-btn" 
              on:click={handleAddCustomToCart}
            >
              أضف الباقة المنسقة للسلة 🛍️
            </button>
          </div>

        </div>
      </aside>

    </div>

    <!-- 3. قسم محادثة خبير مسكة للذكاء الاصطناعي في الأسفل (AI Florist Live Chat Stream) -->
    <section class="studio-ai-chat-section fade-in">
      <div class="card ai-chat-card">
        
        <!-- رأس الشات -->
        <div class="chat-header">
          <div class="chat-agent-info">
            <div class="agent-avatar-wrap">
              <span class="agent-avatar">🌸</span>
              <span class="agent-status-dot" title="متصل ومستعد للإجابة"></span>
            </div>
            <div>
              <div class="agent-title-row">
                <h3 class="agent-name">محادثة مباشرة مع خبير مسكة للذكاء الاصطناعي</h3>
                <span class="badge badge-gold">Gemini Floral AI ✦</span>
              </div>
              <p class="agent-desc">
                اسأل عن معاني الورود، دلالات الألوان، نصائح العناية وإطالة النضارة، أو اطلب تنسيقاً فورياً للباقة الحية أعلاه.
              </p>
            </div>
          </div>

          <div class="chat-scope-badge">
            <span class="lock-icon">🔒</span>
            <span>نطاق مقيّد بالزهور والباقات فقط</span>
          </div>
        </div>

        <!-- أزرار الأسئلة السريعة الشائعة -->
        <div class="chat-quick-questions">
          <span class="quick-title">جرّب أن تسأل:</span>
          <button type="button" class="quick-q-btn" on:click={() => sendChatMessage('ما هو معنى ودلالة الورد الجوري الأحمر؟')}>
            🌹 ما دلالة الجوري الأحمر؟
          </button>
          <button type="button" class="quick-q-btn" on:click={() => sendChatMessage('كيف أعتني بالباقة في المزهرية لتطول نضارتها لأكثر من 10 أيام؟')}>
            💧 كيف أعتني بالباقة لتدوم نضرة؟
          </button>
          <button type="button" class="quick-q-btn" on:click={() => sendChatMessage('ما أفضل باقة ورد وتغليف لمناسبة تخرج ونجاح؟')}>
            🎓 ما أفضل باقة لمناسبة تخرج؟
          </button>
          <button type="button" class="quick-q-btn" on:click={() => sendChatMessage('ما هو ورق التغليف الملكي الأنسب للورود الفاتحة؟')}>
            🎀 اقتراح ورق تغليف للورد الفاتح
          </button>
          <button type="button" class="quick-q-btn btn-try-guardrail" on:click={() => sendChatMessage('اكتب لي كود بايثون لحساب الأرقام')}>
            ⚠️ تجربة سؤال خارج السياق (اختبار الحظر)
          </button>
        </div>

        <!-- صندوق سيل الرسائل (Chat Stream Body) -->
        <div class="chat-messages-body" bind:this={chatMessagesContainer}>
          {#each chatMessages as msg (msg.id)}
            <div class="chat-msg-row" class:user={msg.sender === 'user'} class:ai={msg.sender === 'ai'}>
              <div class="msg-avatar">
                {msg.sender === 'user' ? '👤' : '🌸'}
              </div>
              <div class="msg-bubble" class:off-topic={msg.isOffTopic}>
                <div class="msg-header">
                  <span class="msg-sender-name">{msg.sender === 'user' ? 'أنت (الزبون)' : 'خبير مسكة للزهور'}</span>
                  <span class="msg-time">{msg.timestamp}</span>
                </div>
                <div class="msg-text">
                  {@html msg.text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}
                </div>
              </div>
            </div>
          {/each}

          {#if chatIsLoading}
            <div class="chat-msg-row ai">
              <div class="msg-avatar">🌸</div>
              <div class="msg-bubble typing-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-text">جاري استشارة خبير مسكة للذكاء الاصطناعي… ✨</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- شريط إدخال الرسالة والإرسال -->
        <form class="chat-input-bar" on:submit|preventDefault={() => sendChatMessage()}>
          <input 
            type="text" 
            class="input-field chat-text-field"
            placeholder="اكتب سؤالك هنا عن أنواع الورد، معانيها، العناية بها، أو التنسيق…"
            bind:value={chatInput}
            disabled={chatIsLoading}
          />
          <button 
            type="submit" 
            class="btn btn-primary chat-send-btn"
            disabled={chatIsLoading || !chatInput.trim()}
          >
            إرسال 💬
          </button>
        </form>

        <div class="chat-disclaimer">
          🔒 تنبيه حاسم: هذا المساعد الذكي مبرمج للإجابة حصرياً عن عالم الزهور والباقات، وأي سؤال خارج هذا النطاق سيتم الاعتذار عنه فوراً لضمان التخصص والدقة.
        </div>

      </div>
    </section>
  </div>
</div>

<style>
  .studio-page {
    padding: 30px 0 80px;
    background: var(--bg);
    min-height: 100vh;
  }
  .studio-header {
    text-align: center;
    max-width: 780px;
    margin: 0 auto 32px;
  }
  .badge-cluster {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .page-title {
    font-size: 2.3rem;
    font-weight: 800;
    color: var(--olive);
    margin: 8px 0;
    font-family: 'Cairo', sans-serif;
  }
  .page-subtitle {
    font-size: 1.02rem;
    color: var(--text-muted);
    line-height: 1.7;
  }

  .studio-toast {
    background: var(--lime);
    color: var(--olive-darker, #2d3812);
    padding: 14px 20px;
    border-radius: var(--radius-sm);
    text-align: center;
    font-weight: 700;
    font-size: 1.05rem;
    margin-bottom: 24px;
    box-shadow: 0 4px 14px rgba(94, 107, 44, 0.2);
  }

  /* تخطيط الصفحة */
  .studio-layout {
    display: grid;
    grid-template-columns: 1.25fr 0.95fr;
    gap: 32px;
    align-items: start;
  }

  /* أشرطة التبويب */
  .studio-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    background: var(--card-solid);
    padding: 6px;
    border-radius: var(--radius-md);
    border: 1px solid var(--line-strong);
    overflow-x: auto;
  }
  .tab-btn {
    flex: 1;
    padding: 10px 14px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  .tab-btn:hover {
    color: var(--text);
    background: rgba(94, 107, 44, 0.06);
  }
  .tab-btn.active {
    background: var(--olive);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(94, 107, 44, 0.3);
  }

  .control-box {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 24px;
    box-shadow: var(--shadow-sm);
  }
  .box-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 18px;
  }
  .box-head h3 {
    font-size: 1.22rem;
    font-weight: 800;
    color: var(--text);
    margin: 0 0 4px;
  }
  .box-subdesc {
    font-size: 0.88rem;
    color: var(--text-muted);
    margin: 0;
  }
  .count-badge {
    background: var(--lime);
    color: var(--olive);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.84rem;
    font-weight: 800;
    white-space: nowrap;
  }

  /* قائمة الزهور */
  .flowers-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .flower-row {
    display: grid;
    grid-template-columns: 1.4fr 0.6fr 1fr 0.8fr;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg);
    border-radius: var(--radius-md);
    border: 1.5px solid var(--line);
    transition: border-color 0.2s;
  }
  .flower-row.has-qty {
    border-color: rgba(94, 107, 44, 0.4);
    background: rgba(94, 107, 44, 0.02);
  }
  .flower-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .color-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 2px 5px rgba(0,0,0,0.15);
    flex-shrink: 0;
  }
  .flower-name {
    font-size: 0.95rem;
    font-weight: 700;
    margin: 0 0 2px;
    color: var(--text);
  }
  .flower-stock {
    font-size: 0.76rem;
    color: var(--text-muted);
  }
  .flower-price {
    font-size: 1rem;
    font-weight: 800;
    color: var(--price);
  }
  .flower-price small {
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .section-dropdown {
    width: 100%;
    padding: 6px 10px;
    font-size: 0.82rem;
    font-weight: 600;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--card-solid);
    color: var(--text);
    cursor: pointer;
  }
  .qty-counter {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    padding: 3px 6px;
    border-radius: var(--radius-full);
  }
  .counter-btn {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: none;
    background: var(--olive);
    color: #fff;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s;
  }
  .counter-btn:disabled {
    background: var(--line-strong);
    cursor: not-allowed;
  }
  .qty-val {
    font-size: 0.95rem;
    font-weight: 800;
    min-width: 18px;
    text-align: center;
  }

  /* تبويب الذكاء الاصطناعي (AI Tab) */
  .ai-banner {
    display: flex;
    align-items: center;
    gap: 16px;
    background: linear-gradient(135deg, rgba(94, 107, 44, 0.12), rgba(197, 155, 39, 0.12));
    border: 1.5px solid rgba(94, 107, 44, 0.25);
    border-radius: var(--radius-md);
    padding: 16px;
    margin-bottom: 22px;
  }
  .ai-icon-ring {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--olive);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    box-shadow: 0 4px 10px rgba(94, 107, 44, 0.25);
    flex-shrink: 0;
  }
  .ai-banner h3 {
    margin: 0 0 4px;
    font-size: 1.15rem;
    color: var(--olive);
    font-weight: 800;
  }
  .ai-banner p {
    margin: 0;
    font-size: 0.88rem;
    color: var(--text-muted);
  }

  .ai-prompt-container {
    margin-bottom: 24px;
  }
  .prompt-label {
    display: block;
    font-size: 0.92rem;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--text);
  }
  .ai-input-group {
    display: flex;
    gap: 10px;
  }
  .ai-text-input {
    flex: 1;
  }
  .ai-run-btn {
    white-space: nowrap;
    padding: 0 20px;
  }
  .quick-prompt-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }
  .quick-label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .chip {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    padding: 4px 12px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text);
    cursor: pointer;
    transition: all 0.2s;
  }
  .chip:hover {
    border-color: var(--olive);
    background: rgba(94, 107, 44, 0.08);
  }

  .section-title {
    font-size: 1rem;
    font-weight: 800;
    color: var(--text);
    margin: 0 0 12px;
  }
  .ai-presets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 22px;
  }
  .preset-card {
    background: var(--bg);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-md);
    padding: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .preset-card:hover, .preset-card.active {
    border-color: var(--olive);
    background: var(--card-solid);
    box-shadow: 0 4px 12px rgba(94, 107, 44, 0.12);
  }
  .preset-card.active {
    box-shadow: 0 0 0 2px var(--olive);
  }
  .preset-icon {
    font-size: 1.5rem;
    display: block;
    margin-bottom: 6px;
  }
  .preset-title {
    font-size: 0.92rem;
    font-weight: 800;
    color: var(--olive);
    margin-bottom: 4px;
  }
  .preset-desc {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .ai-angles-optimizer-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 16px;
    margin-bottom: 24px;
    gap: 16px;
  }
  .opt-title {
    margin: 0 0 4px;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text);
  }
  .opt-desc {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  .ai-analytics-panel {
    border-top: 1px solid var(--line);
    padding-top: 20px;
  }
  .analytics-bars {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }
  .metric-row {
    background: var(--bg);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
  }
  .metric-head {
    display: flex;
    justify-content: space-between;
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 6px;
  }
  .metric-track {
    height: 8px;
    background: var(--line-strong);
    border-radius: var(--radius-full);
    overflow: hidden;
  }
  .metric-fill {
    height: 100%;
    background: var(--olive);
    border-radius: var(--radius-full);
    transition: width 0.4s ease;
  }
  .metric-fill.balance-fill {
    background: #c59b27;
  }
  .ai-suggestion-box {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    background: rgba(197, 155, 39, 0.1);
    border-left: 3px solid #c59b27;
    padding: 12px 14px;
    border-radius: 4px;
  }
  .ai-suggestion-box p {
    margin: 0;
    font-size: 0.86rem;
    color: var(--text);
    line-height: 1.6;
  }

  /* تبويب محرر الوردة الفردية (Stem-by-Stem Inspector) */
  .stems-pill-carousel {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .stem-select-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }
  .stem-select-chip.active {
    border-color: var(--olive);
    background: var(--olive);
    color: #fff;
  }
  .chip-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .stem-inspector-card {
    background: var(--bg);
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 20px;
  }
  .inspector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 12px;
  }
  .insp-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .insp-title h4 {
    margin: 0;
    font-size: 1.05rem;
    color: var(--text);
  }
  .btn-delete-stem {
    background: rgba(192, 39, 65, 0.1);
    color: #c02741;
    border: 1px solid rgba(192, 39, 65, 0.2);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
  }
  .insp-label {
    display: block;
    font-size: 0.86rem;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--text);
  }
  .angle-buttons-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  .angle-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 8px;
    background: var(--card-solid);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text);
    transition: all 0.2s;
  }
  .angle-btn small {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .angle-btn:hover, .angle-btn.active {
    border-color: var(--olive);
    background: rgba(94, 107, 44, 0.08);
  }
  .angle-btn.active {
    box-shadow: 0 0 0 2px var(--olive);
  }

  .inspector-sliders-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }
  .slider-box {
    background: var(--card-solid);
    padding: 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
  }
  .slider-label-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .slider-field {
    width: 100%;
    accent-color: var(--olive);
    cursor: pointer;
  }
  .layer-controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--card-solid);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    margin-bottom: 14px;
  }
  .layer-label {
    font-size: 0.84rem;
    font-weight: 700;
  }
  .layer-btns {
    display: flex;
    gap: 8px;
  }
  .drag-tip-box {
    font-size: 0.8rem;
    color: var(--text-muted);
    background: rgba(94, 107, 44, 0.05);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    text-align: center;
  }

  /* تبويب التغليف والشريط والكرت */
  .pkg-section {
    margin-bottom: 22px;
  }
  .pkg-label {
    display: block;
    font-size: 0.95rem;
    font-weight: 800;
    margin-bottom: 10px;
    color: var(--text);
  }
  .options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
  }
  .option-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.88rem;
    font-weight: 700;
    transition: all 0.2s;
  }
  .option-pill:hover, .option-pill.selected {
    border-color: var(--olive);
    background: var(--card-solid);
  }
  .option-pill.selected {
    box-shadow: 0 0 0 2px var(--olive);
  }
  .option-color {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1.5px solid #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    flex-shrink: 0;
  }
  .opt-info {
    display: flex;
    flex-direction: column;
  }
  .opt-price {
    font-size: 0.75rem;
    color: var(--olive);
  }
  .card-msg-input {
    margin-bottom: 14px;
  }
  .seal-config-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    border-top: 1px solid var(--line);
    padding-top: 14px;
  }
  .sub-label {
    display: block;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .wax-colors-list {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .wax-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid #fff;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    transition: transform 0.2s;
  }
  .wax-dot.active {
    transform: scale(1.2);
    box-shadow: 0 0 0 2px var(--olive);
  }
  .wax-name-display {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  /* العمود الثاني: مسرح المعاينة الحية والتغليف (Sticky Preview) */
  .studio-preview-col {
    position: sticky;
    top: 90px;
  }
  .preview-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-lg);
  }
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .preview-title {
    margin: 0 0 2px;
    font-size: 1.25rem;
    color: var(--olive);
    font-weight: 800;
  }
  .preview-subtitle {
    font-size: 0.82rem;
    color: var(--text-muted);
  }
  .stage-actions {
    display: flex;
    gap: 6px;
  }
  .stage-tool-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    font-size: 0.95rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .stage-tool-btn.active {
    background: var(--olive);
    color: #fff;
    border-color: var(--olive);
  }

  .ai-status-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(90deg, rgba(94, 107, 44, 0.08), rgba(197, 155, 39, 0.08));
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    font-size: 0.82rem;
    color: var(--olive-darker, #2d3812);
    font-weight: 600;
    margin-bottom: 16px;
    border-right: 3px solid var(--olive);
  }
  .ai-spark {
    font-size: 1rem;
  }

  /* مسرح المعاينة الحية للوحة التفاعلية */
  .stage-viewport {
    width: 100%;
    height: 380px;
    background: radial-gradient(circle at 50% 40%, #ffffff 0%, #f7f4ee 70%, #ede7dc 100%);
    border-radius: var(--radius-md);
    position: relative;
    overflow: hidden;
    margin-bottom: 20px;
    border: 1px solid var(--line-strong);
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.04);
    user-select: none;
  }
  .stage-viewport.with-grid {
    background-image: 
      linear-gradient(to right, rgba(94, 107, 44, 0.08) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(94, 107, 44, 0.08) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  .stage-viewport.rotating .stems-layer,
  .stage-viewport.rotating .wrap-back-svg,
  .stage-viewport.rotating .wrap-front-svg,
  .stage-viewport.rotating .ribbon-wax-wrap {
    animation: gentleSway 8s infinite ease-in-out;
  }
  @keyframes gentleSway {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(4deg); }
  }

  /* 1. خلفية ورق التغليف الفاخر */
  .wrap-back-svg {
    position: absolute;
    width: 270px;
    height: 330px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -46%);
    pointer-events: none;
    z-index: 1;
    filter: drop-shadow(0 14px 28px rgba(0,0,0,0.12));
    transition: all 0.4s ease;
  }

  /* 2. طبقة السيقان الحية */
  .stems-layer {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: auto;
  }
  .canvas-empty-hint {
    position: absolute;
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 700;
    font-size: 0.95rem;
  }
  .stem-canvas-node {
    position: absolute;
    width: 95px;
    height: 95px;
    cursor: grab;
    transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .stem-canvas-node:active {
    cursor: grabbing;
    transition: none;
  }
  .stem-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.18));
    pointer-events: none;
  }
  .stem-active-ring {
    position: absolute;
    inset: -4px;
    border: 2px dashed var(--olive);
    border-radius: 50%;
    animation: spinRing 14s linear infinite;
    pointer-events: none;
  }
  @keyframes spinRing {
    100% { transform: rotate(360deg); }
  }

  /* 3. مقدمة ورق التغليف الملكي */
  .wrap-front-svg {
    position: absolute;
    width: 250px;
    height: 190px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -10%);
    pointer-events: none;
    z-index: 80;
    transition: all 0.4s ease;
  }

  /* 4. شريط الساتان والختم الشمعي */
  .ribbon-wax-wrap {
    position: absolute;
    width: 130px;
    height: 90px;
    left: 50%;
    top: 66%;
    transform: translate(-50%, 0);
    z-index: 95;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  }
  .satin-ribbon-band {
    width: 120px;
    height: 18px;
    border-radius: 9px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.25);
    background-image: linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 60%);
  }
  .ribbon-tails-container {
    position: relative;
    width: 60px;
    height: 40px;
    margin-top: -6px;
  }
  .ribbon-tail {
    position: absolute;
    width: 12px;
    height: 42px;
    border-radius: 2px 2px 6px 6px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }
  .tail-left {
    left: 14px;
    transform: rotate(18deg);
  }
  .tail-right {
    right: 14px;
    transform: rotate(-18deg);
  }
  .wax-seal-emblem {
    position: absolute;
    top: -10px;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    box-shadow: 0 4px 10px rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .wax-seal-rim {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px dashed rgba(255,255,255,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .wax-seal-text {
    font-size: 0.52rem;
    font-weight: 800;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.6);
  }

  /* قاعدة العرض الرخامية في الأسفل */
  .stage-pedestal {
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    width: 240px;
    height: 45px;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(94, 107, 44, 0.22) 0%, rgba(94, 107, 44, 0.02) 70%, transparent 100%);
    z-index: 0;
  }

  /* ملخص التكلفة والزر */
  .preview-summary {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .summary-line {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: var(--text-muted);
  }
  .free-badge {
    color: var(--olive);
    font-weight: 800;
  }
  .total-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1.5px solid var(--line);
    margin-top: 6px;
    padding-top: 14px;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text);
  }
  .total-price {
    font-size: 1.65rem;
    font-weight: 800;
    color: var(--price);
  }
  .cta-cart-btn {
    margin-top: 10px;
    font-size: 1.05rem;
    font-weight: 800;
    padding: 14px;
  }

  /* التجاوب مع الهواتف والشاشات الصغيرة */
  @media (max-width: 990px) {
    .studio-layout {
      grid-template-columns: 1fr;
    }
    .studio-preview-col {
      position: static;
      order: -1;
      margin-bottom: 24px;
    }
    .flower-row {
      grid-template-columns: 1fr 1fr;
    }
    .section-select-box {
      grid-column: span 2;
    }
    .qty-counter {
      grid-column: span 2;
      justify-content: center;
    }
  }

  /* 3. شات خبير مسكة للذكاء الاصطناعي في الأسفل */
  .studio-ai-chat-section {
    margin-top: 48px;
  }
  .ai-chat-card {
    background: var(--card-solid);
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 28px;
    box-shadow: var(--shadow-md);
  }
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid var(--line);
    padding-bottom: 18px;
    gap: 16px;
    flex-wrap: wrap;
  }
  .chat-agent-info {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .agent-avatar-wrap {
    position: relative;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, #5e6b2c, #851b2f);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(94, 107, 44, 0.25);
    flex-shrink: 0;
  }
  .agent-avatar {
    font-size: 1.6rem;
  }
  .agent-status-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 13px;
    height: 13px;
    background: #10b981;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
  }
  .agent-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }
  .agent-name {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--olive);
  }
  .agent-desc {
    margin: 0;
    font-size: 0.88rem;
    color: var(--text-muted);
  }
  .chat-scope-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(94, 107, 44, 0.08);
    border: 1px solid rgba(94, 107, 44, 0.25);
    border-radius: var(--radius-full);
    padding: 6px 14px;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--olive);
  }
  .lock-icon {
    font-size: 0.9rem;
  }
  .chat-quick-questions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: 18px 0;
  }
  .quick-title {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-muted);
  }
  .quick-q-btn {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    padding: 5px 13px;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .quick-q-btn:hover {
    border-color: var(--olive);
    background: rgba(94, 107, 44, 0.08);
  }
  .btn-try-guardrail {
    border-color: rgba(192, 39, 65, 0.35);
    color: #c02741;
    background: rgba(192, 39, 65, 0.04);
  }
  .btn-try-guardrail:hover {
    background: rgba(192, 39, 65, 0.1);
    border-color: #c02741;
  }
  .chat-messages-body {
    height: 380px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
    background: var(--bg);
    border-radius: var(--radius-md);
    border: 1px solid var(--line-strong);
    scroll-behavior: smooth;
  }
  .chat-msg-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .chat-msg-row.user {
    flex-direction: row-reverse;
  }
  .msg-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.15rem;
    flex-shrink: 0;
  }
  .msg-bubble {
    max-width: 78%;
    padding: 14px 18px;
    border-radius: 18px;
    box-shadow: var(--shadow-sm);
  }
  .chat-msg-row.ai .msg-bubble {
    background: var(--card-solid);
    border: 1.5px solid var(--line-strong);
    border-top-right-radius: 4px;
    color: var(--text);
  }
  .chat-msg-row.user .msg-bubble {
    background: var(--olive);
    color: #ffffff;
    border-top-left-radius: 4px;
  }
  .msg-bubble.off-topic {
    border-color: rgba(192, 39, 65, 0.5) !important;
    background: rgba(192, 39, 65, 0.06) !important;
    color: var(--text) !important;
  }
  .msg-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    font-size: 0.76rem;
    opacity: 0.8;
  }
  .msg-sender-name {
    font-weight: 700;
  }
  .msg-text {
    font-size: 0.94rem;
    line-height: 1.7;
    word-break: break-word;
  }
  .typing-bubble {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
  }
  .typing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--olive);
    animation: typingPulse 1.2s infinite ease-in-out;
  }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typingPulse {
    0%, 100% { transform: scale(0.6); opacity: 0.4; }
    50% { transform: scale(1.2); opacity: 1; }
  }
  .typing-text {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-right: 4px;
  }
  .chat-input-bar {
    display: flex;
    gap: 12px;
    margin-top: 18px;
  }
  .chat-text-field {
    flex: 1;
    padding: 14px 18px;
    font-size: 0.95rem;
  }
  .chat-send-btn {
    padding: 0 26px;
    font-weight: 800;
    font-size: 0.95rem;
    white-space: nowrap;
  }
  .chat-disclaimer {
    text-align: center;
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-top: 10px;
  }
</style>
