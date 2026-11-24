<script>
  import { onMount, tick } from 'svelte';
  import { router } from '../stores/router.js';
  import { cart } from '../stores/cart.js';
  import { api } from '../lib/api.js';
  import { pendingBouquetDesign } from '../stores/aiChatStore.js';
  import { auth, isFlorist, isAdmin } from '../stores/auth.js';

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

  // 2. خيارات التغليف الملكي المستوحاة من أرقى تصاميم الباقات
  let wrapOptions = [
    { id: 'black', name: 'أسود سهرة فاحم (ملكي)', price: 15, color: '#222222', darkColor: '#111111' },
    { id: 'burgundy', name: 'عنابي مخملي ملكي', price: 15, color: '#541525', darkColor: '#2d0a12' },
    { id: 'olive', name: 'زيتي مسكة ملكي', price: 12, color: '#4a5723', darkColor: '#2b3314' },
    { id: 'blush', name: 'وردي مخملي ناعم', price: 12, color: '#e8b2be', darkColor: '#a86576' },
    { id: 'white', name: 'أبيض عاجي شفاف مذهب', price: 10, color: '#f7f3ed', darkColor: '#d6cbc0' },
    { id: 'kraft', name: 'ورق كرافت فاخر', price: 10, color: '#c8a882', darkColor: '#8a6e4d' },
    { id: 'gold', name: 'ذهبي شامبين عتيق', price: 16, color: '#d4af37', darkColor: '#8c7322' }
  ];
  let selectedWrap = wrapOptions[0];

  // 3. خيارات شريط الساتان
  let ribbonOptions = [
    { id: 'gold_rose', name: 'وردي مذهب', color: '#d4889c' },
    { id: 'sage', name: 'زيتي مسكة', color: '#5e6b2c' },
    { id: 'crimson', name: 'أحمر قرمزي', color: '#963547' },
    { id: 'silk_white', name: 'حرير عاجي', color: '#fcf8f6' },
    { id: 'royal_gold', name: 'ذهب ملكي', color: '#c59b27' }
  ];
  let selectedRibbon = ribbonOptions[0];

  // 4. خيارات الختم الشمعي
  let waxSealColors = [
    { id: 'red', name: 'أحمر قرمزي ملكي', hex: '#851b2f' },
    { id: 'gold', name: 'ذهبي عتيق', hex: '#c59b27' },
    { id: 'olive', name: 'أخضر زيتي مسكة', hex: '#48551f' },
    { id: 'plum', name: 'برغندي مخملي', hex: '#4a1525' }
  ];
  let selectedWaxColor = waxSealColors[0];

  let cardMessage = 'أجمل اللحظات هي التي تبدأ بوردة صادقة…';
  let sealStamp = 'MASKA';
  let is3DRotating = false;
  let showGrid = false;
  let activeTab = 'flowers'; // 'flowers' | 'templates' | 'packaging' | 'chat'
  let addedToast = false;

  // المشهد المرئي للباقة: علوي لقبة الزهور الملكية (top) أو أمامي مغلف بالشريط (front)
  let viewMode = 'top'; // 'top' | 'front'

  // ===========================================================================
  // قوالب وأنماط التنسيق الملكية الفاخرة (Bouquet Templates Engine)
  // ===========================================================================
  let currentTemplateId = 'round_dome';
  let templateFilter = 'all'; // 'all' | 'top' | 'front'

  const bouquetTemplates = [
    // -------------------------------------------------------------------------
    // 1. قوالب المشهد العلوي (Top View Templates - 6 قوالب بتغليفات وهياكل هندسية متفردة تماماً)
    // -------------------------------------------------------------------------
    {
      id: 'round_dome',
      name: 'قالب التغليف الدائري الملكي',
      subtitle: 'قبة الزهور المتناسقة في طوق التاج النجمي الفاخر',
      viewMode: 'top',
      category: 'top',
      wrapStyle: 'royal_origami_crown',
      icon: '🪷',
      tag: 'الأكثر طلباً • قبة دائرية',
      desc: 'تنسيق دائري كروي متناسق يملأ ياقة ورق التغليف الملكية بسجادة زهور متراصة كقبة فخمة تبهر الناظر من الأعلى.',
      suitableFor: 'مناسب لجميع المناسبات، هدايا الطاولات، والمكاتب الراقية',
      badgeClass: 'badge-top'
    },
    {
      id: 'compact_posy',
      name: 'قالب باقة اليد المدمجة (Parisian Posy)',
      subtitle: 'كتلة حلزونية باريسية في علبة دائرية بياقة كشكش ناعمة',
      viewMode: 'top',
      category: 'top',
      wrapStyle: 'parisian_pleated_box',
      icon: '💐',
      tag: 'باريسي ناعم • كشكش دائري',
      desc: 'باقة مدمجة ومتراصة جداً داخل طوق أسطواني فرنسي ناعم بياقة كشكش بليسيه بيضاء مذهبة وتجاور ناعم للألوان.',
      suitableFor: 'مسكات العرائس الناعمة، باقات الحمل باليد، والتهنئة اللطيفة',
      badgeClass: 'badge-top'
    },
    {
      id: 'grand_dome',
      name: 'قالب قبة الـ 100 وردة الكبرى (Grand Dome)',
      subtitle: 'سجادة ورد مخملية متراصة في طوق أوريغامي مزدوج ضخم',
      viewMode: 'top',
      category: 'top',
      wrapStyle: 'grand_double_starburst',
      icon: '👑',
      tag: 'فخامة ملكية ضخمة • طوق مزدوج',
      desc: 'توزيع شديد التراص والكثافة مستوحى من باقات الـ 100 وردة الكبرى داخل طوق أوريغامي مزدوج الطبقات بـ 24 سن مسنن مذهب.',
      suitableFor: 'حفلات الخطوبة الكبرى، مناسبات VIP، والاحتفالات الاستثنائية',
      badgeClass: 'badge-top'
    },
    {
      id: 'heart_shape',
      name: 'قالب القلب الرومانسي الملكي',
      subtitle: 'قلب ورد مصمت وممتلئ داخل طوق أوريغامي على شكل قلب',
      viewMode: 'top',
      category: 'top',
      wrapStyle: 'heart_origami_collar',
      icon: '💖',
      tag: 'رومانسي خالص • قلب أوريغامي',
      desc: 'توزيع دقيق ينسج الورود في قلب مصمت وممتلئ بالكامل من المركز للأطراف، محاطاً بغلاف أوريغامي هندسي مذهب على هيئة قلب.',
      suitableFor: 'ذكرى الزواج، التعبير عن المشاعر الصادقة، وهدايا الفالنتاين',
      badgeClass: 'badge-top'
    },
    {
      id: 'crescent_moon',
      name: 'قالب الهلال الملكي الأنيق (Royal Crescent)',
      subtitle: 'قوس هلالي متوهج مع هالة متوازنة في غلاف هلالي مذهب',
      viewMode: 'top',
      category: 'top',
      wrapStyle: 'crescent_arch_wrap',
      icon: '🌙',
      tag: 'أناقة شرقية عصرية • غلاف هلالي',
      desc: 'تصميم هلالي انسيابي فريد تتألق فيه الأزهار الرئيسية على قوس هلالي بارز وتملأ الورود الناعمة الهالة المحيطة بتوازن تام دون أي فراغ.',
      suitableFor: 'التهنئة بالمناسبات، الأعياد، ورمضان، وتنسيقات الاستقبال الفاخرة',
      badgeClass: 'badge-top'
    },
    {
      id: 'boho_garden',
      name: 'قالب الباقة البوهيمية الحرة (Garden Bloom)',
      subtitle: 'تنسيق مروج طبيعي في غلاف كرافت ريفي بحبل قنب نباتي',
      viewMode: 'top',
      category: 'top',
      wrapStyle: 'boho_kraft_deckle',
      icon: '🌿',
      tag: 'طبيعي عفوي • كرافت ريفي',
      desc: 'توزيع عضوي متناغم يملأ كامل الغلاف بحواف كرافت مشرشرة ومربوطة بحبل قنب ريفي يجمع بين الورود المتفتحة وأغصان الأوكالبتوس.',
      suitableFor: 'عشاق الطبيعة العفوية، جلسات التصوير، وهدايا الأصدقاء المبتكرة',
      badgeClass: 'badge-top'
    },
    {
      id: 'monogram_dome',
      name: 'قالب الحروف والأسماء الملكي (M ❤️ S Monogram)',
      subtitle: 'حروف بيضاء ناصعة في قلب سجادة جوري أحمر بطوق أوريغامي أسود',
      viewMode: 'top',
      category: 'top',
      wrapStyle: 'black_origami_monogram',
      icon: '🔤',
      tag: 'إهداء رومانسي بالاسم • حروف الورد',
      desc: 'تنسيق مبهر مستوحى من الباقات المخصصة كالصورة تماماً، حيث تتراص زهور الجوري الأحمر لتملأ كامل الباقة، وتنسج الزهور البيضاء حرفين وقلب (M ❤️ S) في المركز.',
      suitableFor: 'المفاجآت الرومانسية، ذكرى الخطوبة، وأعياد الميلاد الاستثنائية',
      badgeClass: 'badge-top'
    },

    // -------------------------------------------------------------------------
    // 2. قوالب المشهد الأمامي (Front View Templates - 4 باقات مغلفة بأجنحة وياقات متمايزة)
    // -------------------------------------------------------------------------
    {
      id: 'korean_fan',
      name: 'قالب باقة المروحة الكورية المدرجة',
      subtitle: 'مروحة زهور ممتلئة بين أجنحة التغليف المذهبة وياقة الكشكش',
      viewMode: 'front',
      category: 'front',
      wrapStyle: 'korean_stepped_wings',
      icon: '🎀',
      tag: 'كوري فاخر • مشهد أمامي',
      desc: 'تنسيق رأسي متدرج على هيئة مروحة يستند على أجنحة الورق الكوري ذات الحواف الذهبية وتستقر أزهاره الممتلئة فوق ياقة الكشكش الشاش البيضاء.',
      suitableFor: 'مثالية للإهداء الشخصي، التهنئة بالنجاح، وباقات الزيارات الفاخرة',
      badgeClass: 'badge-front'
    },
    {
      id: 'royal_celebration',
      name: 'قالب باقة المناسبات والتخرج الملكية',
      subtitle: 'قبة زهور أمامية كثيفة محتضنة تعلوها طاقية التخرج الملكية',
      viewMode: 'front',
      category: 'front',
      wrapStyle: 'royal_celebration_cap',
      icon: '🎓',
      tag: 'احتفالي ملكي • قبعة تخرج',
      desc: 'تراص أمامي كثيف متجاور للورود المخملية يعلوه تناسق فخم لطيات الورق العنابي، وتتوجها طاقية التخرج الملكية بالشرابة الذهبية.',
      suitableFor: 'حفلات التخرج، أعياد الميلاد، والاحتفالات الكبرى',
      badgeClass: 'badge-front'
    },
    {
      id: 'royal_cascade',
      name: 'قالب باقة الشلال الملكي المتدلي',
      subtitle: 'شلال هرمي ممتلئ في غلاف ذو أجنحة جانبية وشرائط منسابة',
      viewMode: 'front',
      category: 'front',
      wrapStyle: 'royal_cascade_cape',
      icon: '👑',
      tag: 'فخامة ملكية • شلال هرمي',
      desc: 'تدرج ملكي هرمي يبدأ من قمة مركزية أنيقة وينساب جانبياً ليغطي كامل العرض مع شرائط ساتان متدلية وأغصان أوكالبتوس.',
      suitableFor: 'حفلات الزفاف، كبار الشخصيات VIP، والمناسبات الرسمية',
      badgeClass: 'badge-front'
    },
    {
      id: 'classic_front',
      name: 'قالب الباقة الطولية الكلاسيكية',
      subtitle: 'باقة مخروطية عمودية متناسقة في غلاف متقاطع بشعار مذهب',
      viewMode: 'front',
      category: 'front',
      wrapStyle: 'classic_crossover_cone',
      icon: '💐',
      tag: 'كلاسيكي أنيق • مخروط متقاطع',
      desc: 'توزيع رأسي متوازن يبرز بهاء الجوري في الوسط مع هالة ممتلئة من زهور نَفَس الطفل البيضاء مستندة على مخروط ورقي متقاطع ومختوم بختم MASKA.',
      suitableFor: 'الزيارات الأنيقة، باقات المستشفيات، وهدايا الشكر والتقدير',
      badgeClass: 'badge-front'
    }
  ];

  $: filteredTemplates = templateFilter === 'all' 
    ? bouquetTemplates 
    : bouquetTemplates.filter(t => t.category === templateFilter || t.viewMode === templateFilter);

  // تفعيل المشهد تلقائياً بناءً على مرحلة التصميم والقالب المختار:
  let prevActiveTab = activeTab;
  $: if (activeTab !== prevActiveTab) {
    if (activeTab === 'flowers' || activeTab === 'templates') {
      const curTpl = bouquetTemplates.find(t => t.id === currentTemplateId);
      if (curTpl) {
        viewMode = curTpl.viewMode || 'top';
      }
    }
    prevActiveTab = activeTab;
  }

  function toggleViewMode() {
    viewMode = viewMode === 'top' ? 'front' : 'top';
    aiStatusMessage = viewMode === 'top'
      ? 'تم التبديل إلى المشهد العلوي (تنسيق الزهور كقبة ملكية من الأعلى)'
      : 'تم التبديل إلى المشهد الأمامي (معاينة التغليف والشريط كمنتج نهائي)';
  }

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
  let aiStatusMessage = 'الذكاء الاصطناعي جاهز لمساعدتك في تنسيق وتحريك الباقة.';
  let aiIsThinking = false;
  let aiStylePreset = 'royal'; // 'royal' | 'dome' | 'boho' | 'heart'

  // مفاتيح الزهور المتوفر لها صور فوتوغرافية فائقة الدقة شفافة الخلفية (Real Photographic PNGs)
  const cleanPngTopKeys = [
    'red-rose', 'pink-rose', 'white-rose',
    'white-tulip', 'pink-tulip', 'baby-breath',
    'peony', 'eucalyptus', 'orchid', 'sunflower', 'lily'
  ];

  // خريطة مفاتيح الزهور لتحميل الصور الشفافة النظيفة
  function getFlowerKey(name, color = '') {
    const n = (name || '').toLowerCase();
    const c = (color || '').toLowerCase();
    if (n.includes('أحمر') || n.includes('حمراء') || c.includes('أحمر') || c.includes('قرمزي')) return 'red-rose';
    if (n.includes('وردي') || c.includes('وردي')) {
      if (n.includes('بيوني') || n.includes('فاوانيا')) return 'peony';
      if (n.includes('ليلي') || n.includes('زنابق')) return 'lily';
      return 'pink-rose';
    }
    if (n.includes('توليب') || n.includes('tulip')) return 'white-tulip';
    if (n.includes('جيبسوفيلا') || n.includes('جبسوفيلا') || n.includes('طفل')) return 'baby-breath';
    if (n.includes('فاوانيا') || n.includes('بيوني') || n.includes('peony')) return 'peony';
    if (n.includes('أوكالبتوس') || n.includes('اوكالبتوس') || n.includes('مريمي') || n.includes('eucalyptus')) return 'eucalyptus';
    if (n.includes('أوركيد') || n.includes('اوركيد') || n.includes('orchid')) return 'orchid';
    if (n.includes('شمس') || n.includes('sunflower')) return 'sunflower';
    if (n.includes('ليلي') || n.includes('زنابق') || n.includes('lily')) return 'lily';
    if (n.includes('جوري') || n.includes('ورد')) return 'pink-rose';
    return 'red-rose';
  }

  // الحصول على رابط صورة الزاوية النظيفة للوردة (مع إعطاء الأولوية القصوى للصور الفوتوغرافية الحقيقية الشفافة)
  function getFlowerAngleImage(flower, angle = 'top') {
    const key = flower.key || getFlowerKey(flower.name, flower.color);

    // استخدام الصور الفوتوغرافية الحقيقية الشفافة فائقة الجودة في المشهدين العلوي والأمامي
    if (cleanPngTopKeys.includes(key)) {
      return `/assets/flowers/clean/${key}-top.png`;
    }

    if (flower && flower.image_top && flower.image_top.endsWith('.png')) {
      return flower.image_top;
    }
    if (flower && flower.image_front && flower.image_front.endsWith('.png')) {
      return flower.image_front;
    }

    return `/assets/flowers/clean/${key}-top.svg`;
  }

  // توليد إحداثيات مبدئية طبيعية لكل قسم داخل حدود ورق التغليف الملكي
  function getSectionCoordinates(section) {
    const jitterX = (Math.random() - 0.5) * 16;
    const jitterY = (Math.random() - 0.5) * 14;
    const jitterRot = (Math.random() - 0.5) * 12;

    switch (section) {
      case 'top':
        return {
          x: Math.round(jitterX),
          y: Math.round(-98 + jitterY),
          rotation: Math.round(jitterRot),
          angle: 'front',
          scale: 0.98
        };
      case 'center':
        return {
          x: Math.round(jitterX * 0.8),
          y: Math.round(-62 + jitterY),
          rotation: Math.round(jitterRot),
          angle: 'front',
          scale: 1.05
        };
      case 'left':
        return {
          x: Math.round(-28 + jitterX * 0.6),
          y: Math.round(-52 + jitterY),
          rotation: Math.round(-18 + jitterRot),
          angle: 'side',
          scale: 0.96
        };
      case 'right':
        return {
          x: Math.round(28 + jitterX * 0.6),
          y: Math.round(-52 + jitterY),
          rotation: Math.round(18 + jitterRot),
          angle: 'side',
          scale: 0.96
        };
      case 'bottom':
      default:
        return {
          x: Math.round(jitterX * 0.8),
          y: Math.round(-24 + jitterY),
          rotation: Math.round(jitterRot),
          angle: 'front',
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

  // إعادة بناء السيقان وتطبيق القالب المحدد تلقائياً
  function rebuildStemsAndApplyTemplate(templateId = currentTemplateId) {
    const newStems = [];
    flowers.forEach(f => {
      for (let i = 0; i < f.qty; i++) {
        newStems.push({
          id: 'stem_' + f.id + '_' + i + '_' + Math.random().toString(36).substr(2, 4),
          flowerId: f.id,
          flowerName: f.name,
          flowerKey: f.key || getFlowerKey(f.name, f.color),
          color: f.color,
          price: f.unit_price,
          section: f.section || 'center',
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1.0,
          angle: 'front',
          zIndex: 10
        });
      }
    });
    stems = newStems;
    applyBouquetTemplate(templateId);
  }

  // ملء الباقة الملكي بالكامل تلقائياً (Lush Bouquet Auto-Fill) لضمان تغطية كامل مساحة الغلاف
  function fillFullLushBouquet() {
    flowers = flowers.map((f, idx) => {
      let targetQty = 0;
      if (f.key.includes('red-rose') || f.section === 'center') {
        targetQty = Math.min(f.stock_quantity, 10);
      } else if (f.key.includes('baby') || f.key.includes('eucalyptus') || f.section === 'bottom') {
        targetQty = Math.min(f.stock_quantity, 6);
      } else if (f.key.includes('white') || f.key.includes('tulip') || f.key.includes('peony')) {
        targetQty = Math.min(f.stock_quantity, 5);
      } else {
        targetQty = Math.min(f.stock_quantity, 3);
      }
      return { ...f, qty: Math.max(f.qty, targetQty) };
    });
    rebuildStemsAndApplyTemplate(currentTemplateId);
    aiStatusMessage = '👑 تم ملء الباقة بالكامل بسجادة زهور ملكية كثيفة تملأ كامل الغلاف دون أي فراغات!';
  }

  onMount(async () => {
    try {
      const res = await api.getInventory();
      if (res && res.data && res.data.length > 0) {
        // نضمن أن كل صنف من المخزون يظهر لمرة واحدة فقط بمعرفه الدقيق لمنع تكرار المعرفات
        const invList = res.data;
        flowers = invList.map((inv, idx) => {
          const old = flowers.find(f => f.id === inv.id || f.name.includes(inv.name_ar.split(' ')[0]) || inv.name_ar.includes(f.name.split(' ')[0]));
          return {
            id: inv.id,
            name: inv.name_ar,
            color: inv.color || old?.color || '#c02741',
            key: getFlowerKey(inv.name_ar, inv.color),
            unit_price: Number(inv.unit_price),
            qty: old ? old.qty : (idx < 3 ? 2 : 0),
            stock_quantity: inv.stock_quantity,
            section: old?.section || (idx === 0 ? 'center' : idx === 1 ? 'top' : idx === 2 ? 'left' : 'bottom'),
            image_front: inv.image_front,
            image_side: inv.image_side,
            image_top: inv.image_top,
            image_stem: inv.image_stem,
            images_angles_json: inv.images_angles_json
          };
        });
      }
    } catch (e) {
      console.log('Using default flower inventory in Studio');
    }

    // جلب خيارات التغليف وأشرطة الساتان والختم الشمعي المحدثة ديناميكياً من قاعدة البيانات
    try {
      const packRes = await api.getPackaging();
      if (packRes) {
        if (packRes.wraps && packRes.wraps.length > 0) {
          wrapOptions = packRes.wraps.map(w => ({
            id: w.code,
            name: w.name_ar,
            price: Number(w.price) || 0,
            color: w.color,
            darkColor: w.dark_color || w.color
          }));
          selectedWrap = wrapOptions[0];
        }
        if (packRes.ribbons && packRes.ribbons.length > 0) {
          ribbonOptions = packRes.ribbons.map(r => ({
            id: r.code,
            name: r.name_ar,
            color: r.color
          }));
          selectedRibbon = ribbonOptions[0];
        }
        if (packRes.wax_seals && packRes.wax_seals.length > 0) {
          waxSealColors = packRes.wax_seals.map(x => ({
            id: x.code,
            name: x.name_ar,
            hex: x.color
          }));
          selectedWaxColor = waxSealColors[0];
        }
      }
    } catch (e) {
      console.log('Using default packaging options in Studio');
    }

    rebuildStemsAndApplyTemplate(currentTemplateId);
  });

  // تطبيق تصميم باقة مقترح بالكامل من الذكاء الاصطناعي على اللوحة الحية
  function applyAiBouquetDesign(design) {
    if (!design || !design.stems) return;

    flowers = flowers.map(f => {
      const match = design.stems.find(s => 
        (s.flower_id && s.flower_id === f.id) ||
        (s.name && (f.name.includes(s.name) || s.name.includes(f.name.split(' ')[0]))) ||
        (s.key && (f.key === s.key || f.key.includes(s.key)))
      );
      if (match) {
        return {
          ...f,
          qty: Math.min(match.qty || 1, f.stock_quantity),
          section: match.section || f.section
        };
      }
      return { ...f, qty: 0 };
    });

    if (design.wrap) {
      const w = wrapOptions.find(o => o.id === design.wrap || o.name.includes(design.wrap));
      if (w) selectedWrap = w;
    }
    if (design.ribbon) {
      const r = ribbonOptions.find(o => o.id === design.ribbon || o.name.includes(design.ribbon));
      if (r) selectedRibbon = r;
    }
    if (design.style) {
      aiStylePreset = design.style;
    }

    initializeStemsFromQuantities();
    applyStylePreset(aiStylePreset);

    aiStatusMessage = `تم تطبيق تصميم "${design.name || 'باقة مسكة'}" بالكامل على اللوحة!`;
    activeTab = 'flowers';

    const canvas = document.querySelector('.bouquet-canvas-box') || document.querySelector('.canvas-view-port');
    if (canvas) {
      canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // الاستماع للتصميم المعلق القادم من الشات العائم أو الصفحة الرئيسية
  $: if ($pendingBouquetDesign) {
    const design = $pendingBouquetDesign;
    pendingBouquetDesign.set(null);
    setTimeout(() => {
      applyAiBouquetDesign(design);
    }, 150);
  }

  // تعديل كمية الزهرة (+ أو -) وإعادة التنسيق بالقالب تلقائياً وبأعلى معايير الجمال
  function adjustQty(flowerId, delta) {
    const flower = flowers.find(f => f.id === flowerId);
    if (!flower) return;

    const nextQty = Math.max(0, Math.min(flower.stock_quantity, flower.qty + delta));
    if (nextQty === flower.qty) return;

    flower.qty = nextQty;
    flowers = [...flowers];

    rebuildStemsAndApplyTemplate(currentTemplateId);
  }

  // تغيير قسم نوع الزهرة كاملاً وتحديث التوزيع بالقالب تلقائياً
  function handleSectionChange(flowerId, newSection) {
    flowers = flowers.map(f => f.id === flowerId ? { ...f, section: newSection } : f);
    rebuildStemsAndApplyTemplate(currentTemplateId);
    const flower = flowers.find(f => f.id === flowerId);
    aiStatusMessage = `تم نقل زهور "${flower ? flower.name : ''}" إلى قسم (${getSectionNameAr(newSection)}) وتنسيقها بالقالب تلقائياً`;
  }

  function getSectionNameAr(sec) {
    switch (sec) {
      case 'top': return 'الأعلى والقمة 🔝';
      case 'center': return 'الوسط والمركز 🎯';
      case 'left': return 'الجهة اليسرى 👈';
      case 'right': return 'الجهة اليمنى 👉';
      case 'bottom': return 'القاعدة والمحيط 🔽';
      default: return sec;
    }
  }

  // --- محرر الوردة الفردية (Stem-by-Stem Inspector - الوردة التي تم النقر عليها فقط) ---
  $: effectiveStemId = (selectedStemId && stems.some(s => s.id === selectedStemId)) 
    ? selectedStemId 
    : null;
  $: selectedStem = effectiveStemId ? (stems.find(s => s.id === effectiveStemId) || null) : null;
  $: selectedFlowerData = selectedStem ? flowers.find(f => f.id === selectedStem.flowerId) : null;
  $: selectedStemInfo = selectedStem ? getFlowerMeaningAndCare(selectedStem.flowerName) : null;

  function getCleanFlowerName(name) {
    if (!name) return 'وردة';
    if (name.includes('أوكالبتوس') || name.includes('اوكالبتوس')) return 'أوكالبتوس';
    if (name.includes('جيبسوفيلا') || name.includes('جبسوفيلا')) return 'جيبسوفيلا';
    if (name.includes('فاوانيا') || name.includes('بيوني')) return 'بيوني';
    if (name.includes('أوركيد') || name.includes('اوركيد')) return 'أوركيد';
    if (name.includes('توليب')) return 'توليب';
    if (name.includes('شمس') || name.includes('عباد')) return 'عباد الشمس';
    if (name.includes('ليلي') || name.includes('زنابق')) return 'زنابق الليلي';
    if (name.includes('جوري أحمر') || (name.includes('جوري') && name.includes('أحمر'))) return 'جوري أحمر';
    if (name.includes('جوري وردي') || (name.includes('جوري') && name.includes('وردي'))) return 'جوري وردي';
    return name.split(' ')[0] || name;
  }

  function selectNextStem(delta = 1) {
    if (stems.length === 0) return;
    const currentIdx = stems.findIndex(s => s.id === selectedStemId);
    let nextIdx = (currentIdx + delta + stems.length) % stems.length;
    selectedStemId = stems[nextIdx].id;
  }

  function setStemAngle(angle) {
    if (!selectedStem) return;
    selectedStem.angle = angle;
    stems = [...stems];
    aiStatusMessage = `تم ضبط زاوية الرؤية إلى (${getAngleLabelAr(angle)})`;
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

  function rotateSelectedStem(delta = 15) {
    if (!selectedStem) return;
    selectedStem.rotation = Math.max(-60, Math.min(60, (selectedStem.rotation || 0) + delta));
    stems = [...stems];
  }

  function scaleSelectedStem(delta = 0.05) {
    if (!selectedStem) return;
    const nextScale = Math.round(((selectedStem.scale || 1.0) + delta) * 100) / 100;
    selectedStem.scale = Math.max(0.7, Math.min(1.4, nextScale));
    stems = [...stems];
  }

  function cycleSelectedStemAngle() {
    if (!selectedStem) return;
    const angles = ['front', 'side', 'top', 'stem'];
    const curIdx = angles.indexOf(selectedStem.angle || 'front');
    const nextAngle = angles[(curIdx + 1) % angles.length];
    setStemAngle(nextAngle);
  }

  function nudgeSelectedStem(dx, dy) {
    if (!selectedStem) return;
    selectedStem.x = Math.max(-140, Math.min(140, (selectedStem.x || 0) + dx));
    selectedStem.y = Math.max(-140, Math.min(140, (selectedStem.y || 0) + dy));
    stems = [...stems];
  }

  function moveStemToSection(newSection) {
    if (!selectedStem) return;
    const coords = getSectionCoordinates(newSection);
    selectedStem.section = newSection;
    selectedStem.x = coords.x + Math.round((Math.random() - 0.5) * 16);
    selectedStem.y = coords.y + Math.round((Math.random() - 0.5) * 12);
    selectedStem.rotation = coords.rotation;
    selectedStem.angle = coords.angle;
    stems = [...stems];
    aiStatusMessage = `تم نقل الساق إلى قسم (${getSectionNameAr(newSection)})`;
  }

  function resetStemPosition() {
    if (!selectedStem) return;
    const coords = getSectionCoordinates(selectedStem.section || 'center');
    selectedStem.x = coords.x;
    selectedStem.y = coords.y;
    selectedStem.rotation = coords.rotation;
    selectedStem.scale = 1.0;
    stems = [...stems];
    aiStatusMessage = `🔄 تم إعادة ضبط موقع الساق للموضع المتناسق`;
  }

  function duplicateSelectedStem() {
    if (!selectedStem) return;
    const flower = flowers.find(f => f.id === selectedStem.flowerId);
    if (!flower) return;
    if (flower.qty >= flower.stock_quantity) {
      alert(`عذراً، وصلت للحد الأقصى المتوفر بالمخزن (${flower.stock_quantity} ساق)`);
      return;
    }
    flower.qty += 1;
    flowers = [...flowers];
    const newStem = {
      ...selectedStem,
      id: 'stem_' + flower.id + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      x: selectedStem.x + 12,
      y: selectedStem.y + 10,
      zIndex: stems.length + 10
    };
    stems = [...stems, newStem];
    selectedStemId = newStem.id;
    aiStatusMessage = `➕ تم تكرار ساق من \"${flower.name}\" بنجاح`;
  }

  function getFlowerMeaningAndCare(flowerName = '') {
    const n = flowerName.toLowerCase();
    if (n.includes('أحمر') || n.includes('حمراء')) {
      return {
        meaning: 'الحب العميق والخلود والمشاعر الصادقة الفاخرة.',
        care: 'اقطع الساق بزاوية 45° تحت الماء كل يومين واغمرها بماء بارد ونقي.',
        season: 'متوفر طوال العام'
      };
    }
    if (n.includes('توليب')) {
      return {
        meaning: 'النقاء والبدايات الجديدة المشرقة والصفاء الملكي.',
        care: 'ضع مكعب ثلج صغير يومياً في ماء المزهرية لتبقى الساق منتصبة وقوية.',
        season: 'موسم الربيع الهولندي'
      };
    }
    if (n.includes('أوركيد') || n.includes('اوركيد')) {
      return {
        meaning: 'الفخامة الاستثنائية والجمال النادر والأناقة الدائمة.',
        care: 'احفظها بعيداً عن أشعة الشمس المباشرة ورش محيطها برذاذ خفيف.',
        season: 'زهور ملكية استوائية'
      };
    }
    if (n.includes('شمس') || n.includes('عباد')) {
      return {
        meaning: 'البهجة، الطاقة الإيجابية، الصداقة المتينة، والنجاح.',
        care: 'تحتاج ماء عميقاً نسبياً لدعم ثقل رأس الزهرة وغيّر الماء بانتظام.',
        season: 'الصيف والربيع المشرق'
      };
    }
    if (n.includes('بيوني') || n.includes('فاوانيا')) {
      return {
        meaning: 'الرقي الأرستقراطي، السعادة الزوجية، والحظ الوفير.',
        care: 'احفظها في مكان بارد معتدل، وقص أطراف الساق بمقص حاد كل 48 ساعة.',
        season: 'موسم أوائل الصيف الفاخر'
      };
    }
    if (n.includes('ليلي') || n.includes('زنابق')) {
      return {
        meaning: 'السمو، العظمة، والشذى العطري الفواح.',
        care: 'أزل حبوب اللقاح البرتقالية بمنديل فور تفتح الزهرة لمضاعفة عمرها.',
        season: 'طوال العام'
      };
    }
    if (n.includes('أوكالبتوس') || n.includes('اوكالبتوس')) {
      return {
        meaning: 'النضارة، الحماية، والتناغم الطبيعي العطري الأخضر.',
        care: 'تدوم لأكثر من 3 أسابيع، ويمكن تجفيفها لتبقى تذكاراً جميلاً.',
        season: 'نبات عطري دائم الخضرة'
      };
    }
    return {
      meaning: 'الرقة والمودة والجمال الطبيعي المتناسق.',
      care: 'تغيير الماء كل يومين وإزالة أي أوراق تقع تحت خط الماء في الفازة.',
      season: 'أزهار مسكة الطبيعية'
    };
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

  // --- السحب والإفلات اليدوي الحر (Freeform Touch & Pointer Drag) ---
  function startStemDrag(e, stemId) {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    selectedStemId = stemId;
    isDragging = true;
    dragStemId = stemId;

    const clientX = e.touches ? e.touches[0].clientX : (e.clientX ?? 0);
    const clientY = e.touches ? e.touches[0].clientY : (e.clientY ?? 0);

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
    window.addEventListener('pointermove', onStemDragMove, { passive: false });
    window.addEventListener('pointerup', endStemDrag);
    window.addEventListener('pointercancel', endStemDrag);
  }

  function onStemDragMove(e) {
    if (!isDragging || !dragStemId || !canvasContainer) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : (e.clientX ?? 0);
    const clientY = e.touches ? e.touches[0].clientY : (e.clientY ?? 0);

    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let newX = Math.round(clientX - centerX - dragOffset.x);
    let newY = Math.round(clientY - centerY - dragOffset.y);

    if (viewMode === 'top') {
      // قيود الحركة الدائرية الطبيعية لقبة الباقة في المشهد العلوي
      const dist = Math.sqrt(newX * newX + newY * newY);
      const maxRadius = 145;
      if (dist > maxRadius) {
        newX = Math.round((newX / dist) * maxRadius);
        newY = Math.round((newY / dist) * maxRadius);
      }
    } else {
      // قيود المشهد الأمامي الرأسي
      newX = Math.max(-155, Math.min(155, newX));
      newY = Math.max(-190, Math.min(85, newY));
    }

    stems = stems.map(s => {
      if (s.id === dragStemId) {
        return { ...s, x: newX, y: newY };
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
    window.removeEventListener('pointermove', onStemDragMove);
    window.removeEventListener('pointerup', endStemDrag);
    window.removeEventListener('pointercancel', endStemDrag);
  }

  // --- محرك قوالب وأنماط التنسيق التلقائي الفاخر (Templates Arrangement Engine) ---

  function selectTemplate(tplId) {
    currentTemplateId = tplId;
    const tpl = bouquetTemplates.find(t => t.id === tplId);
    if (tpl) {
      viewMode = tpl.viewMode || 'top';
    }
    rebuildStemsAndApplyTemplate(tplId);
  }

  function applyBouquetTemplate(templateId = currentTemplateId, isManualCall = false) {
    currentTemplateId = templateId;
    const tpl = bouquetTemplates.find(t => t.id === templateId) || bouquetTemplates[0];

    // ضبط المشهد المناسب للقالب (علوي لقبة الزهور والأطواق الدائرية، وأمامي للباقات المغلفة)
    viewMode = tpl.viewMode || 'top';

    if (stems.length === 0) {
      if (isManualCall) {
        aiStatusMessage = `تم اختيار "${tpl.name}". أضف وروداً للباقة لتظهر فوراً بتناسق ملكي!`;
      }
      return;
    }

    aiIsThinking = true;

    // فرز السيقان: نضع الورود الكبيرة والمميزة (جوري، بيوني، عباد الشمس، أو قسم الوسط) في قلب الجمال
    const sortedStems = [...stems].sort((a, b) => {
      const isFocalA = a.flowerKey.includes('rose') || a.flowerKey.includes('peony') || a.flowerKey.includes('sunflower') || a.section === 'center';
      const isFocalB = b.flowerKey.includes('rose') || b.flowerKey.includes('peony') || b.flowerKey.includes('sunflower') || b.section === 'center';
      if (isFocalA && !isFocalB) return -1;
      if (!isFocalA && isFocalB) return 1;
      return (b.price || 0) - (a.price || 0);
    });

    const total = sortedStems.length;
    let newStems = [];

    if (templateId === 'round_dome') {
      // 1. قالب قبة الزهور الملكية المتناسقة - تغطية كاملة وشاملة لمساحة الباقة (Full Volume Phyllotaxis Dome)
      const baseScale = total <= 4 ? 1.85 : total <= 8 ? 1.62 : total <= 14 ? 1.40 : total <= 24 ? 1.22 : 1.05;
      newStems = sortedStems.map((s, idx) => {
        let x, y, rot, scale;
        if (idx === 0) {
          x = 0; y = 0; rot = 0; scale = baseScale * 1.15;
        } else {
          const frac = idx / Math.max(1, total - 1);
          // توزيع حلزوني كامل يصل حتى طوق الغلاف الملكي (r يصل حتى 132px)
          const maxR = total <= 8 ? 116 : total <= 14 ? 126 : 134;
          const r = 24 + Math.sqrt(frac) * (maxR - 24);
          const theta = idx * 137.507764 * (Math.PI / 180);
          x = Math.cos(theta) * r;
          y = Math.sin(theta) * r;
          rot = Math.round(theta * 180 / Math.PI + (idx % 3) * 15) % 360;
          scale = baseScale * (1.05 - frac * 0.08);
        }
        return {
          ...s,
          x: Math.round(x),
          y: Math.round(y),
          rotation: rot,
          scale: scale,
          angle: 'top',
          zIndex: 10 + (total - idx)
        };
      });
      aiStatusMessage = `تم ملء قبة الزهور الملكية بتوزيع كامل وممتلئ يشمل مساحة الباقة دون أي فراغات.`;

    } else if (templateId === 'compact_posy') {
      // 2. باقة اليد الفرنسية المدمجة (Parisian Posy) - كتلة مدمجة متراصة في علبة دائرية
      const baseScale = total <= 4 ? 1.85 : total <= 8 ? 1.62 : total <= 14 ? 1.40 : 1.18;
      newStems = sortedStems.map((s, idx) => {
        let x, y, rot, scale;
        if (idx === 0) {
          x = 0; y = 0; rot = 0; scale = baseScale * 1.16;
        } else {
          const frac = idx / Math.max(1, total - 1);
          const maxR = total <= 8 ? 85 : total <= 14 ? 98 : 108;
          const r = 18 + Math.sqrt(frac) * (maxR - 18);
          const theta = (idx * 137.507764 + (idx % 2) * 8) * (Math.PI / 180);
          x = Math.cos(theta) * r;
          y = Math.sin(theta) * r;
          rot = Math.round(theta * 180 / Math.PI) % 360;
          scale = baseScale * 1.02;
        }
        return {
          ...s,
          x: Math.round(x),
          y: Math.round(y),
          rotation: rot,
          scale: scale,
          angle: 'top',
          zIndex: 10 + (total - idx)
        };
      });
      aiStatusMessage = `تم تنسيق باقة اليد المدمجة بكتلة زهور باريسية متراصة ومفعمة بالحيوية.`;

    } else if (templateId === 'grand_dome') {
      // 3. قبة الـ 100 وردة الكبرى (Grand Dome) - سجادة زهور كثيفة تملأ كامل الطوق المزدوج
      const baseScale = total <= 6 ? 1.80 : total <= 12 ? 1.55 : total <= 24 ? 1.32 : 1.12;
      newStems = sortedStems.map((s, idx) => {
        let x, y, rot, scale;
        if (idx === 0) {
          x = 0; y = 0; rot = 0; scale = baseScale * 1.18;
        } else {
          const frac = idx / Math.max(1, total - 1);
          const maxR = total <= 10 ? 120 : total <= 20 ? 130 : 138;
          const r = 26 + Math.sqrt(frac) * (maxR - 26);
          const theta = (idx * 137.507764 + (idx % 4) * 10) * (Math.PI / 180);
          x = Math.cos(theta) * r;
          y = Math.sin(theta) * r;
          rot = Math.round(theta * 180 / Math.PI + 30) % 360;
          scale = baseScale * (1.04 - frac * 0.1);
        }
        return {
          ...s,
          x: Math.round(x),
          y: Math.round(y),
          rotation: rot,
          scale: scale,
          angle: 'top',
          zIndex: 10 + (total - idx)
        };
      });
      aiStatusMessage = `تم ملء قبة الـ 100 وردة الكبرى بسجادة مخملية تمتد لكافة أطراف الغلاف المزدوج.`;

    } else if (templateId === 'monogram_dome') {
      // 3.1 قالب الحروف والأسماء بالورد (M ❤️ S Monogram Dome) - كالصورة 2 تماماً
      const baseScale = total <= 8 ? 1.60 : total <= 16 ? 1.38 : 1.18;
      
      // إحداثيات رسم الحروف "M ❤️ S" بالزهور البيضاء في المركز
      const monogramCoords = [
        // حرف M
        { x: -55, y: -25 }, { x: -55, y: 0 }, { x: -55, y: 25 },
        { x: -42, y: -10 }, { x: -30, y: -25 }, { x: -30, y: 0 }, { x: -30, y: 25 },
        // قلب ❤️
        { x: -5, y: -6 }, { x: 5, y: -6 }, { x: 0, y: 8 },
        // حرف S
        { x: 30, y: -25 }, { x: 45, y: -25 }, { x: 30, y: -5 },
        { x: 45, y: 8 }, { x: 30, y: 25 }, { x: 45, y: 25 }
      ];

      const lightStems = sortedStems.filter(s => 
        s.flowerKey.includes('white') || s.flowerKey.includes('baby') || s.color.toLowerCase().includes('fff') || s.color.toLowerCase().includes('f7') || s.color.toLowerCase().includes('fa')
      );
      const darkStems = sortedStems.filter(s => !lightStems.includes(s));

      let mIdx = 0;
      let dIdx = 0;

      newStems = sortedStems.map((s, idx) => {
        let x, y, rot, scale;
        if ((lightStems.includes(s) || idx < monogramCoords.length) && mIdx < monogramCoords.length) {
          const pt = monogramCoords[mIdx++];
          x = pt.x;
          y = pt.y;
          rot = (idx % 2 === 0 ? 5 : -5);
          scale = baseScale * 0.98;
        } else {
          const outerTotal = Math.max(1, total - monogramCoords.length);
          const frac = dIdx++ / outerTotal;
          const r = 58 + Math.sqrt(frac) * (134 - 58);
          const theta = (dIdx * 137.507764) * (Math.PI / 180);
          x = Math.cos(theta) * r;
          y = Math.sin(theta) * r;
          rot = Math.round(theta * 180 / Math.PI) % 360;
          scale = baseScale * 1.10;
        }
        return {
          ...s,
          x: Math.round(x),
          y: Math.round(y),
          rotation: rot,
          scale: scale,
          angle: 'top',
          zIndex: 10 + (total - idx)
        };
      });
      aiStatusMessage = `تم نسج قالب الحروف والأسماء بالورد "M ❤️ S" محاطاً بسجادة مخملية كثيفة.`;

    } else if (templateId === 'heart_shape') {
      // 4. قالب القلب الرومانسي الملكي - هيكل قلب مصمت وممتلئ بالكامل من المركز إلى المحيط
      const baseScale = total <= 4 ? 1.55 : total <= 8 ? 1.38 : total <= 14 ? 1.25 : 1.08;
      
      function getHeartPt(t) {
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        return { hx, hy };
      }

      // تقسيم الورود إلى طبقات متحدة المركز داخل القلب لمنع أي فراغ داخلي
      const coreCount = total <= 5 ? 1 : total <= 10 ? 2 : Math.max(3, Math.round(total * 0.22));
      const midCount = total <= 6 ? 0 : total <= 14 ? Math.round((total - coreCount) * 0.45) : Math.round((total - coreCount) * 0.4);
      const outerCount = total - coreCount - midCount;

      newStems = sortedStems.map((s, idx) => {
        let x, y, rot, scale;
        if (idx < coreCount) {
          if (idx === 0) {
            x = 0; y = -8; rot = 0; scale = baseScale * 1.15;
          } else {
            const t = -Math.PI + ((idx - 1) / Math.max(1, coreCount - 1)) * 2 * Math.PI;
            const { hx, hy } = getHeartPt(t);
            x = hx * 2.2;
            y = hy * 2.2 - 8;
            rot = Math.round(t * 180 / Math.PI);
            scale = baseScale * 1.05;
          }
        } else if (idx < coreCount + midCount) {
          const mIdx = idx - coreCount;
          const t = -Math.PI + (mIdx / Math.max(1, midCount)) * 2 * Math.PI;
          const { hx, hy } = getHeartPt(t);
          x = hx * 3.8;
          y = hy * 3.8 - 8;
          rot = Math.round(t * 180 / Math.PI);
          scale = baseScale * 1.0;
        } else {
          const oIdx = idx - coreCount - midCount;
          const t = -Math.PI + (oIdx / Math.max(1, outerCount)) * 2 * Math.PI;
          const { hx, hy } = getHeartPt(t);
          x = hx * 5.3;
          y = hy * 5.3 - 8;
          rot = Math.round(t * 180 / Math.PI);
          scale = baseScale * 0.96;
        }
        return {
          ...s,
          x: Math.round(x),
          y: Math.round(y),
          rotation: rot,
          scale: scale,
          angle: 'top',
          zIndex: 10 + (total - idx)
        };
      });
      aiStatusMessage = `تم ملء قالب القلب الرومانسي بهيكل زهور متراص وممتلئ بالكامل من المركز إلى المحيط.`;

    } else if (templateId === 'crescent_moon') {
      // 5. قالب الهلال الملكي الأنيق - قوس هلالي بارز مع تعبئة الهالة والمهد الداخلي بتوازن تام
      const baseScale = total <= 4 ? 1.55 : total <= 8 ? 1.38 : total <= 14 ? 1.25 : 1.08;
      const crescentCount = Math.max(3, Math.round(total * 0.65));
      const fillerCount = total - crescentCount;

      newStems = sortedStems.map((s, idx) => {
        let x, y, rot, scale;
        if (idx < crescentCount) {
          const t = idx / Math.max(1, crescentCount - 1);
          const theta = (-135 + t * 270) * (Math.PI / 180);
          const r = 62 + 26 * Math.cos(theta * 0.75);
          x = Math.cos(theta) * r - 12;
          y = Math.sin(theta) * r;
          rot = Math.round(theta * 180 / Math.PI + 90) % 360;
          scale = baseScale * (1.05 + 0.1 * Math.cos(theta * 0.75));
        } else {
          const fIdx = idx - crescentCount;
          const fFrac = fIdx / Math.max(1, fillerCount - 1 || 1);
          const fAngle = (-80 + fFrac * 160) * (Math.PI / 180);
          const fR = 26 + (fIdx % 2) * 28;
          x = Math.cos(fAngle) * fR + 18;
          y = Math.sin(fAngle) * fR;
          rot = Math.round(fAngle * 180 / Math.PI);
          scale = baseScale * 0.94;
        }
        return {
          ...s,
          x: Math.round(x),
          y: Math.round(y),
          rotation: rot,
          scale: scale,
          angle: 'top',
          zIndex: 10 + (total - idx)
        };
      });
      aiStatusMessage = `تم تشكيل الهلال الملكي بقوس زهري فخم مع تعبئة متوازنة تملأ الباقة دون أي فراغ.`;

    } else if (templateId === 'boho_garden') {
      // 6. قالب الباقة البوهيمية الحرة - توزيع مروج عضوي يملأ كامل الغلاف بحيوية طبيعية
      const baseScale = total <= 4 ? 1.55 : total <= 8 ? 1.38 : total <= 14 ? 1.25 : 1.08;
      newStems = sortedStems.map((s, idx) => {
        let x, y, rot, scale;
        if (idx === 0) {
          x = -10; y = -8; rot = 15; scale = baseScale * 1.12;
        } else {
          const frac = idx / Math.max(1, total - 1);
          const r = 18 + Math.sqrt(frac) * (92 - 18);
          const theta = (idx * 137.507764 + Math.sin(idx * 2.2) * 22) * (Math.PI / 180);
          x = Math.cos(theta) * r;
          y = Math.sin(theta) * r;
          rot = (idx * 47) % 360;
          scale = baseScale * (0.96 + (idx % 3) * 0.05);
        }
        return {
          ...s,
          x: Math.round(x),
          y: Math.round(y),
          rotation: rot,
          scale: scale,
          angle: 'top',
          zIndex: 10 + (total - idx)
        };
      });
      aiStatusMessage = `تم تنسيق الباقة البوهيمية بتوزيع مروج حر يملأ كامل غلاف الكرافت بنضارة طبيعية.`;

    } else if (templateId === 'korean_fan') {
      // 7. باقة المروحة الكورية المدرجة - انتشار مروحي واسع متدرج يملأ العرض بالكامل كالصورة 1
      const baseScaleFront = total <= 4 ? 1.75 : total <= 8 ? 1.55 : total <= 14 ? 1.38 : total <= 24 ? 1.24 : 1.12;
      const numRows = total <= 4 ? 2 : total <= 9 ? 3 : total <= 16 ? 4 : 5;

      newStems = sortedStems.map((s, idx) => {
        const row = Math.min(numRows - 1, Math.floor((idx / total) * numRows));
        const countInRow = Math.max(1, Math.round(total / numRows));
        const colIdx = idx % countInRow;
        const offset = colIdx - (countInRow - 1) / 2;
        const stagger = (row % 2 === 1) ? 0.35 : 0;
        // انتشار عريض يملأ كامل المسافة بين الجناحين
        const spanX = 110 + row * 38;
        const x = (offset + stagger) * (spanX / Math.max(1, countInRow));
        // قوس تقوس لطيف للورد في كل صف ليعطي شكل مروحة ممتلئة
        const arch = -Math.cos((offset / Math.max(1, countInRow)) * Math.PI) * 10;
        const y = -128 + row * (115 / Math.max(1, numRows - 1)) + arch;
        const rot = Math.round((offset / Math.max(1, countInRow)) * 26);
        const scale = baseScaleFront * (1.0 + row * 0.05);
        return {
          ...s,
          x: Math.round(Math.max(-118, Math.min(118, x))),
          y: Math.round(Math.max(-138, Math.min(5, y))),
          rotation: rot,
          scale: scale,
          angle: 'front',
          zIndex: 10 + row * 12 + colIdx
        };
      });
      aiStatusMessage = `تم توزيع مروحة الورد الكورية لتملأ كامل عرض الأجنحة وطيات الياقة بامتلاء تام.`;

    } else if (templateId === 'royal_celebration') {
      // 8. قبة الزهور الأمامية الكثيفة للاحتفالات والتخرج تعلوها قبعة التخرج كالصورة 3
      const baseScaleFront = total <= 4 ? 1.75 : total <= 8 ? 1.55 : total <= 14 ? 1.38 : total <= 24 ? 1.24 : 1.12;
      const numRows = total <= 5 ? 2 : total <= 11 ? 3 : total <= 18 ? 4 : 5;

      newStems = sortedStems.map((s, idx) => {
        const row = Math.min(numRows - 1, Math.floor((idx / total) * numRows));
        const countInRow = Math.max(2, Math.ceil(total / numRows));
        const colIdx = idx % countInRow;
        const offset = colIdx - (countInRow - 1) / 2;
        const spanX = 105 + row * 35;
        // ترك مساحة خفيفة في اليمين العلوي لقبعة التخرج
        const capOffset = (row === 0 && colIdx >= countInRow / 2) ? -14 : 0;
        const x = offset * (spanX / Math.max(1, countInRow - 1 || 1)) + capOffset;
        const arch = -Math.cos((offset / Math.max(1, countInRow)) * Math.PI) * 12;
        const y = -125 + row * (112 / Math.max(1, numRows - 1)) + arch;
        const rot = Math.round(offset * 8);
        const scale = baseScaleFront * (1.0 + row * 0.06);
        return {
          ...s,
          x: Math.round(Math.max(-115, Math.min(115, x))),
          y: Math.round(Math.max(-138, Math.min(5, y))),
          rotation: rot,
          scale: scale,
          angle: 'front',
          zIndex: 10 + row * 12 + colIdx
        };
      });
      aiStatusMessage = `تم ملء باقة التخرج والاحتفالات بقبة زهور أمامية ممتلئة بالكامل تتوجها قبعة التخرج.`;

    } else if (templateId === 'royal_cascade') {
      // 9. باقة قبة الـ 100 وردة والأوريغامي المدرج الأمامية كالصورة 5
      const baseScaleFront = total <= 4 ? 1.80 : total <= 8 ? 1.60 : total <= 14 ? 1.40 : total <= 24 ? 1.25 : 1.12;
      const numRows = total <= 5 ? 2 : total <= 12 ? 3 : total <= 20 ? 4 : 5;

      newStems = sortedStems.map((s, idx) => {
        const row = Math.min(numRows - 1, Math.floor((idx / total) * numRows));
        const countInRow = Math.max(2, Math.ceil(total / numRows));
        const colIdx = idx % countInRow;
        const offset = colIdx - (countInRow - 1) / 2;
        // قبة دائرية عريضة ممتلئة تشبه نصف كرة من الورد
        const spanX = 125 + Math.sin((row / Math.max(1, numRows - 1)) * Math.PI) * 55;
        const x = offset * (spanX / Math.max(1, countInRow - 1 || 1));
        const domeArch = -Math.sqrt(Math.max(0, 1 - Math.pow(offset / (countInRow || 1), 2))) * 18;
        const y = -130 + row * (118 / Math.max(1, numRows - 1)) + domeArch;
        const rot = Math.round(offset * 12);
        const scale = baseScaleFront * (1.02 + Math.sin((row / Math.max(1, numRows - 1)) * Math.PI) * 0.1);
        return {
          ...s,
          x: Math.round(Math.max(-122, Math.min(122, x))),
          y: Math.round(Math.max(-142, Math.min(5, y))),
          rotation: rot,
          scale: scale,
          angle: 'front',
          zIndex: 10 + row * 12 + colIdx
        };
      });
      aiStatusMessage = `تم ملء باقة قبة الورد الأمامية بسجادة متراصة وممتلئة تمتد لكامل أطراف الغلاف.`;

    } else if (templateId === 'classic_front') {
      // 10. الباقة الطولية الكلاسيكية - عمود مركزي وأجنحة متناسقة ممتلئة
      const baseScaleFront = total <= 4 ? 1.75 : total <= 8 ? 1.55 : total <= 14 ? 1.38 : total <= 24 ? 1.22 : 1.10;
      const numRows = total <= 5 ? 2 : total <= 12 ? 3 : 4;
      newStems = sortedStems.map((s, idx) => {
        const row = Math.min(numRows - 1, Math.floor((idx / total) * numRows));
        const countInRow = Math.max(1, Math.round(total / numRows));
        const colIdx = idx % countInRow;
        const offset = colIdx - (countInRow - 1) / 2;
        const spanX = 85 + row * 32;
        const x = offset * (spanX / Math.max(1, countInRow - 1 || 1));
        const y = -120 + row * (105 / Math.max(1, numRows - 1));
        const rot = Math.round(offset * 10);
        return {
          ...s,
          x: Math.round(Math.max(-105, Math.min(105, x))),
          y: Math.round(Math.max(-130, Math.min(5, y))),
          rotation: rot,
          scale: baseScaleFront,
          angle: 'front',
          zIndex: 10 + row * 12 + colIdx
        };
      });
      aiStatusMessage = `تم تشكيل الباقة الطولية الكلاسيكية بامتلاء متناسق بين المحور المركزي والأطراف.`;
    }

    stems = newStems;
    aiIsThinking = false;
  }

  // دعم الاستدعاء التوافقي لأسماء الأنماط
  function aiArrangeBouquet(preset = 'dome') {
    const map = {
      royal: 'korean_fan',
      fan: 'korean_fan',
      korean: 'korean_fan',
      celebration: 'royal_celebration',
      grad: 'royal_celebration',
      dome: 'round_dome',
      grand: 'grand_dome',
      classic: 'classic_front',
      cascade: 'royal_cascade',
      boho: 'boho_garden',
      heart: 'heart_shape',
      crescent: 'crescent_moon',
      posy: 'compact_posy'
    };
    selectTemplate(map[preset] || 'round_dome');
  }

  function applyStylePreset(preset) {
    aiArrangeBouquet(preset);
  }

  // 2. المحاكي الذكي لزوايا الرؤية ثلاثية الأبعاد (AI 3D Perspective Optimizer)
  function aiAutoAngles() {
    if (stems.length === 0) return;
    stems = stems.map(s => {
      let angle = viewMode === 'top' ? 'top' : 'front';
      let rot = s.rotation;
      return { ...s, angle, rotation: rot };
    });
    aiStatusMessage = 'تم ضبط تناغم زوايا الورود تلقائياً بدقة متناهية!';
  }

  // 3. محرك الأوامر بالذكاء الاصطناعي (AI Natural Language Prompt Parser)
  function executeAiPrompt() {
    const p = aiPromptText.trim().toLowerCase();
    if (!p) {
      alert('الرجاء كتابة طلبك للمنسق الذكي أولاً');
      return;
    }

    aiIsThinking = true;

    setTimeout(() => {
      // 1. الكشف عن قوالب وأنماط التنسيق
      if (p.includes('مروحة') || p.includes('كوري') || p.includes('مدرج')) {
        selectTemplate('korean_fan');
        return;
      }
      if (p.includes('تخرج') || p.includes('احتفال') || p.includes('طاقية') || p.includes('قبعة')) {
        selectTemplate('royal_celebration');
        return;
      }
      if (p.includes('شلال') || p.includes('متدلي') || p.includes('هرمي')) {
        selectTemplate('royal_cascade');
        return;
      }
      if (p.includes('طولي') || p.includes('كلاسيكي') || p.includes('مخروطي') || p.includes('أمامي')) {
        selectTemplate('classic_front');
        return;
      }
      if (p.includes('دائري') || p.includes('قبة') || p.includes('متناسق') || p.includes('كروي') || p.includes('علوي')) {
        selectTemplate('round_dome');
        return;
      }
      if (p.includes('100') || p.includes('كبير') || p.includes('ضخم') || p.includes('كبرى') || p.includes('جراند')) {
        selectTemplate('grand_dome');
        return;
      }
      if (p.includes('هلال') || p.includes('قوس') || p.includes('مونس')) {
        selectTemplate('crescent_moon');
        return;
      }
      if (p.includes('بوهيمي') || p.includes('عصري') || p.includes('عشوائي') || p.includes('طبيعي') || p.includes('مروج')) {
        selectTemplate('boho_garden');
        return;
      }
      if (p.includes('قلب') || p.includes('رومانسي')) {
        selectTemplate('heart_shape');
        return;
      }
      if (p.includes('مدمج') || p.includes('بوزي') || p.includes('باريسي') || p.includes('حلزوني')) {
        selectTemplate('compact_posy');
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
        aiStatusMessage = `نفّذ الذكاء الاصطناعي أمرك: وضع ${appliedDetails.join('، ')} بنجاح!`;
      } else {
        // توزيع ذكي متوازن افتراضي
        aiArrangeBouquet('royal');
        aiStatusMessage = `تم تحليل نصك وتوزيع الباقة بنمط ذكي مخصص متناغم!`;
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
    if (stemsList.length < 5) return 'نصيحة المنسق الذكي: إضافة 2-3 سيقان جيبسوفيلا أو أوكالبتوس سيعطي حجماً إضافياً وامتلاءً ملكياً.';
    if (wrap.id === 'black') return 'اختيار ورق السهرة الأسود يُبرز تباين الورود الزاهية بأسلوب فاخر وعصري.';
    if (wrap.id === 'kraft') return 'التغليف الكرافت الكلاسيكي يمنح إحساساً بالأصالة والحدائق الإيطالية النضرة.';
    return 'تناسق الألوان رائع ومتوازن، جاهز للاعتماد والتقديم بالختم الشمعي.';
  }

  // الحسابات المالية
  $: totalStems = flowers.reduce((sum, f) => sum + f.qty, 0);
  $: flowersCost = flowers.reduce((sum, f) => sum + (f.qty * f.unit_price), 0);
  $: grandTotal = Math.round(flowersCost + (selectedWrap.price || 0));

  // إضافة الباقة المصممة للسلة
  function handleAddCustomToCart() {
    if (totalStems < 3) {
      alert('الرجاء اختيار 3 سيقان زهور على الأقل لتنسيق باقة متناسقة');
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

  // ===========================================================================
  // اعتماد ونشر الباقة في الكتالوج (Florist & Admin Studio Catalog Creator)
  // ===========================================================================
  let floristCatalogActive = false;
  $: isCatalogCreateMode = $router.params?.mode === 'catalog_create' || floristCatalogActive;

  let catalogBouquet = {
    title: '',
    occasion_tag: 'عيد ميلاد',
    price: null,
    description: '',
    image_svg_path: '/assets/bouquet-pink-spring.svg'
  };

  const occasionOptions = [
    'عيد ميلاد',
    'زفاف',
    'تخرج',
    'رومانسية',
    'شكر وتقدير',
    'مواليد',
    'اعتذار',
    'عام'
  ];

  const bouquetImageOptions = [
    { path: '/assets/bouquet-pink-spring.svg', label: 'ربيع وردي كلاسيكي' },
    { path: '/assets/bouquet-royal.svg', label: 'ملكي قرمزي فاخر' },
    { path: '/assets/bouquet-ivory-elegance.svg', label: 'أناقة العاج والذهب' },
    { path: '/assets/bouquet-sage-whisper.svg', label: 'زيتي مسكة الهادئ' },
    { path: '/assets/bouquet.svg', label: 'باقة الأتيليه الشاملة' }
  ];

  let isPublishingToCatalog = false;
  let catalogPublishError = '';
  let catalogPublishSuccess = '';

  // اقتراح السعر المعتمد تلقائياً عند تغيير الورود
  $: if (isCatalogCreateMode && (!catalogBouquet.price || catalogBouquet.price <= 0)) {
    if (grandTotal > 0) {
      catalogBouquet.price = Math.round(grandTotal * 1.35);
    }
  }

  async function handlePublishBouquetToCatalog() {
    catalogPublishError = '';
    catalogPublishSuccess = '';

    if (!catalogBouquet.title.trim()) {
      catalogPublishError = 'الرجاء إدخال اسم الباقة الشاعري للكتالوج';
      return;
    }

    // دمج وتجميع أي زهور تحمل نفس المعرف لمنع التكرار
    const flowersMap = new Map();
    for (const f of flowers.filter(f => f.qty > 0)) {
      if (flowersMap.has(f.id)) {
        const item = flowersMap.get(f.id);
        item.quantity_stems += f.qty;
      } else {
        flowersMap.set(f.id, {
          flower_id: f.id,
          quantity_stems: f.qty,
          notes: `موقع التنسيق: ${f.section || 'وسط'}`
        });
      }
    }
    const selectedFlowers = Array.from(flowersMap.values());

    if (selectedFlowers.length === 0) {
      catalogPublishError = 'الرجاء اختيار وتوزيع زهرة واحدة على الأقل في الاستوديو';
      return;
    }

    if (!catalogBouquet.price || Number(catalogBouquet.price) <= 0) {
      catalogPublishError = 'سعر البيع المعتمد للباقة يجب أن يكون أكبر من صفر';
      return;
    }

    isPublishingToCatalog = true;
    try {
      const payload = {
        title: catalogBouquet.title.trim(),
        price: Number(catalogBouquet.price),
        occasion_tag: catalogBouquet.occasion_tag || 'عام',
        description: catalogBouquet.description.trim() || `تنسيق ${catalogBouquet.title.trim()} الفاخر بالأستوديو، مكون من ${totalStems} ساق زهور طبيعية بتغليف ${selectedWrap.name} وشريط ${selectedRibbon.name}.`,
        image_svg_path: catalogBouquet.image_svg_path || '/assets/bouquet-pink-spring.svg',
        flowers: selectedFlowers
      };

      const res = await api.createBouquet(payload);
      if (res && res.success) {
        catalogPublishSuccess = `تم اعتماد وإضافة باقة "${payload.title}" بنجاح في كتالوج باقات مسكة! 🌸`;
        setTimeout(() => {
          if ($isFlorist) {
            router.navigate('/florist');
          } else if ($isAdmin) {
            router.navigate('/admin');
          } else {
            router.navigate('/catalog');
          }
        }, 1500);
      } else {
        catalogPublishError = res?.message || 'تعذر نشر الباقة، يرجى مراجعة البيانات';
      }
    } catch (e) {
      catalogPublishError = e.message || 'حدث خطأ أثناء اعتماد ونشر الباقة';
    } finally {
      isPublishingToCatalog = false;
    }
  }

  // 6. محادثة خبير مسكة للذكاء الاصطناعي في الأسفل (AI Florist Live Chat Stream)
  let chatInput = '';
  let chatIsLoading = false;
  let chatMessagesContainer = null;
  let chatMessages = [
    {
      id: 1,
      sender: 'ai',
      text: 'مرحباً بك في مسكة أتيليه! أنا منسقك ومستشارك الذكي المتخصص في عالم الزهور الطبيعية. اسألني عن معاني الورود، دلالات الألوان، نصائح العناية وإطالة النضارة، أو اقترح لي تنسيقاً لباقة أحلامك!',
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
    if (lower.includes('حط') || lower.includes('وسط') || lower.includes('فوق') || lower.includes('هرمي') || lower.includes('ملكي') || lower.includes('متلت') || lower.includes('مثلث') || lower.includes('دائري') || lower.includes('بوهيمي') || lower.includes('قلب') || lower.includes('رومانسي')) {
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
            designAction: res.designAction || null,
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
          text: 'عذراً، حدث خطأ مؤقت في الاتصال بمساعد الذكاء الاصطناعي. يمكنك المحاولة مجدداً أو كتابة سؤالك في الزهور',
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

  function scrollToChat() {
    activeTab = 'chat';
    setTimeout(() => {
      const el = document.getElementById('studio-ai-chat');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  }
</script>

<div class="studio-page fade-in">
  <div class="container">
    <!-- رأس الصفحة -->
    <div class="studio-header">
      <div class="badge-cluster">
        <span class="badge badge-lime">استوديو التصميم الحي</span>
        <span class="badge badge-gold">مدعوم بالذكاء الاصطناعي</span>
        {#if $isFlorist}
          <span class="badge badge-florist">🌸 الأتيليه الملكي للمنسقة</span>
        {/if}
      </div>
      <h1 class="page-title">{isCatalogCreateMode ? 'تصميم واعتماد باقة جديدة للكتالوج' : 'صمّم باقتك بقوالب راقية وتغليف ملكي'}</h1>
      <p class="page-subtitle">
        {isCatalogCreateMode 
          ? 'استخدمي الاستوديو التفاعلي لتنسيق الورود واختيار التغليف والسعر، ثم اعتمديها لتضاف فوراً في كتالوج باقات مسكة'
          : 'اختر ورودك المفضلة وسيقوم النظام بتنسيقها تلقائياً وبأعلى معايير التوازن في القالب المفضل لديك مع التغليف والشريط الملكي.'}
      </p>

      <!-- أزرار الدخول السريع للشات والذكاء الاصطناعي والتبديل للكتالوج -->
      <div class="header-action-pills">
        <button type="button" class="action-pill-chat" on:click={() => activeTab = 'chat'}>
          💬 فتح شات الذكاء الاصطناعي للزهور
        </button>
        <button type="button" class="action-pill-scroll" on:click={scrollToChat}>
          ⬇️ النزول إلى الشات المباشر بالأسفل
        </button>
        {#if $isFlorist || $isAdmin}
          <button 
            type="button" 
            class="action-pill-mode"
            class:active-mode={isCatalogCreateMode}
            on:click={() => floristCatalogActive = !floristCatalogActive}
          >
            {isCatalogCreateMode ? '✕ إغلاق وضع الكتالوج' : '✨ وضع اعتماد باقة للكتالوج'}
          </button>
        {/if}
      </div>
    </div>

    <!-- لوحة اعتماد باقة جديدة للكتالوج (الأتيليه الرسمي) -->
    {#if isCatalogCreateMode}
      <div class="florist-catalog-creator-banner fade-in">
        <div class="f-banner-top">
          <div class="f-banner-title-box">
            <span class="f-live-indicator">🌸 وضع اعتماد باقة جديدة للكتالوج الرسمي</span>
            <h2 class="f-banner-heading">أتيليه تصميم وإضافة الباقات للمتجر</h2>
            <p class="f-banner-sub">نسقي الورود مباشرة على اللوحة ثلاثية الأبعاد، حددي الغلاف والشريط، وضعي السعر المعتمد لتضاف فوراً في الكتالوج.</p>
          </div>
          <div class="f-banner-quick-actions">
            {#if $isFlorist}
              <button type="button" class="btn btn-outline btn-sm" on:click={() => router.navigate('/florist')}>
                ← العودة لورشة المنسقة
              </button>
            {:else if $isAdmin}
              <button type="button" class="btn btn-outline btn-sm" on:click={() => router.navigate('/admin')}>
                ← العودة لإدارة الباقات
              </button>
            {/if}
          </div>
        </div>

        {#if catalogPublishError}
          <div class="f-alert-box error fade-in">{catalogPublishError}</div>
        {/if}
        {#if catalogPublishSuccess}
          <div class="f-alert-box success fade-in">{catalogPublishSuccess}</div>
        {/if}

        <div class="f-catalog-fields-grid">
          <div class="f-field">
            <label for="catalog-title">اسم الباقة الشاعري: *</label>
            <input 
              id="catalog-title"
              type="text" 
              class="input-field styled-input" 
              placeholder="مثال: سحر الفاوانيا الربيعية" 
              bind:value={catalogBouquet.title}
            />
          </div>

          <div class="f-field">
            <label for="catalog-occasion">المناسبة الأساسية: *</label>
            <select id="catalog-occasion" class="input-field styled-select" bind:value={catalogBouquet.occasion_tag}>
              {#each occasionOptions as occ}
                <option value={occ}>{occ}</option>
              {/each}
            </select>
          </div>

          <div class="f-field">
            <label for="catalog-price">سعر البيع المعتمد بالمتجر (د.ل): *</label>
            <div class="f-price-input-wrapper">
              <input 
                id="catalog-price"
                type="number" 
                min="5" 
                step="1" 
                class="input-field styled-input price-input" 
                bind:value={catalogBouquet.price}
              />
              <span class="currency-tag">د.ل</span>
            </div>
          </div>

          <div class="f-field">
            <label for="catalog-img">نموذج العرض بالكتالوج:</label>
            <select id="catalog-img" class="input-field styled-select" bind:value={catalogBouquet.image_svg_path}>
              {#each bouquetImageOptions as opt}
                <option value={opt.path}>{opt.label}</option>
              {/each}
            </select>
          </div>

          <div class="f-field full-row">
            <label for="catalog-desc">الوصف الفني والتسويقي للباقة:</label>
            <input 
              id="catalog-desc"
              type="text" 
              class="input-field styled-input" 
              placeholder="توليفة فاخرة من الورود الطبيعية بتنسيق شاعري أنيق وغلاف ملكي..." 
              bind:value={catalogBouquet.description}
            />
          </div>
        </div>

        <div class="f-banner-footer">
          <div class="f-financial-metrics">
            <div class="metric-chip">
              <span class="m-lbl">مجموع السيقان:</span>
              <b class="m-val">{totalStems} ساق</b>
            </div>
            <div class="metric-chip">
              <span class="m-lbl">تكلفة الورود:</span>
              <b class="m-val">{flowersCost} د.ل</b>
            </div>
            <div class="metric-chip">
              <span class="m-lbl">سعر الغلاف:</span>
              <b class="m-val">{selectedWrap.price || 0} د.ل</b>
            </div>
            <div class="metric-chip highlight">
              <span class="m-lbl">هامش الربح المتوقع:</span>
              <b class="m-val profit">{((Number(catalogBouquet.price) || 0) - grandTotal).toFixed(1)} د.ل</b>
            </div>
          </div>

          <div class="f-publish-btn-box">
            <button 
              type="button" 
              class="btn btn-primary btn-publish-now"
              disabled={isPublishingToCatalog || totalStems < 1}
              on:click={handlePublishBouquetToCatalog}
            >
              {isPublishingToCatalog ? 'جاري الاعتماد والنشر...' : 'اعتماد ونشر الباقة في الكتالوج 🌸'}
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if addedToast}
      <div class="studio-toast fade-in">
        تمت إضافة باقتك المنسقة إلى السلة! جاري الانتقال لصفحة إتمام الطلب...
      </div>
    {/if}

    <!-- تخطيط الاستوديو الرئيسي: شاشة التحكم يميناً والمعاينة الحية يساراً -->
    <div class="studio-layout">
      
      <!-- العمود الأول: أدوات وتفاصيل التصميم التفاعلي -->
      <div class="studio-controls">
        
        <!-- أشرطة التبويب المتناسقة والمتسلسلة لخطوات التصميم -->
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
            class:active={activeTab === 'templates'}
            on:click={() => activeTab = 'templates'}
          >
            📐 قوالب التنسيق ({bouquetTemplates.length})
          </button>

          <button 
            type="button" 
            class="tab-btn" 
            class:active={activeTab === 'packaging'}
            on:click={() => activeTab = 'packaging'}
          >
            🎀 التغليف والشريط
          </button>

          <button 
            type="button" 
            class="tab-btn tab-btn-chat" 
            class:active={activeTab === 'chat'}
            on:click={() => activeTab = 'chat'}
          >
            💬 مساعد الذكاء الاصطناعي
          </button>
        </div>

        <!-- 0. تبويب محادثة خبير مسكة للذكاء الاصطناعي المباشرة -->
        {#if activeTab === 'chat'}
          <div class="card control-box fade-in">
            <div class="chat-header">
              <div class="chat-agent-info">
                <div class="agent-avatar-wrap">
                  <span class="agent-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2L3 9l9 13 9-13-9-7z"/>
                    </svg>
                  </span>
                  <span class="agent-status-dot" title="متصل الآن"></span>
                </div>
                <div>
                  <div class="agent-title-row">
                    <h3 class="agent-name">محادثة مباشرة مع خبير مسكة للذكاء الاصطناعي</h3>
                    <span class="badge badge-gold">Gemini Floral AI</span>
                  </div>
                  <p class="agent-desc">
                    اسأل عن معاني الورود، نصائح العناية وإطالة النضارة، أو اطلب تنسيقاً فورياً للباقة الحية.
                  </p>
                </div>
              </div>
              <div class="chat-scope-badge">
                
                <span>نطاق مقيّد بالزهور فقط</span>
              </div>
            </div>

            <!-- أزرار الأسئلة السريعة -->
            <div class="chat-quick-questions">
              <span class="quick-title">جرّب الضغط على سؤال سريع أو طلب تصميم فوري:</span>
              <button type="button" class="quick-q-btn btn-design-quick" on:click={() => sendChatMessage('صمملي باقة رومانسية فخمة من الورد المتوفر عندك')}>
                صمملي باقة رومانسية
              </button>
              <button type="button" class="quick-q-btn btn-design-quick" on:click={() => sendChatMessage('صمملي باقة تخرج ونجاح مبهجة بالورد المتاح')}>
                صمملي باقة تخرج
              </button>
              <button type="button" class="quick-q-btn btn-design-quick" on:click={() => sendChatMessage('صمملي باقة زفاف ملكية ناصعة')}>
                صمملي باقة زفاف ملكية
              </button>
              <button type="button" class="quick-q-btn" on:click={() => sendChatMessage('ما هو معنى ودلالة الورد الجوري الأحمر؟')}>
                ما دلالة الجوري الأحمر؟
              </button>
              <button type="button" class="quick-q-btn" on:click={() => sendChatMessage('كيف أعتني بالباقة في المزهرية لتطول نضارتها لأكثر من 10 أيام؟')}>
                كيف أعتني بالباقة؟
              </button>
              <button type="button" class="quick-q-btn btn-try-guardrail" on:click={() => sendChatMessage('اكتب لي كود بايثون لحساب الأرقام')}>
                تجربة سؤال خارج السياق
              </button>
            </div>

            <!-- صندوق سيل الرسائل -->
            <div class="chat-messages-body tab-messages-body" bind:this={chatMessagesContainer}>
              {#each chatMessages as msg (msg.id)}
                <div class="chat-msg-row" class:user={msg.sender === 'user'} class:ai={msg.sender === 'ai'}>
                  <div class="msg-avatar">
                    {msg.sender === 'user' ? 'أنت' : 'مسكة'}
                  </div>
                  <div class="msg-bubble" class:off-topic={msg.isOffTopic}>
                    <div class="msg-header">
                      <span class="msg-sender-name">{msg.sender === 'user' ? 'أنت (الزبون)' : 'خبير مسكة للزهور'}</span>
                      <span class="msg-time">{msg.timestamp}</span>
                    </div>
                    <div class="msg-text">
                      {@html msg.text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}
                    </div>

                    {#if msg.designAction}
                      <div class="ai-bouquet-proposal-card">
                        <div class="proposal-head">
                          <span class="proposal-tag">تصميم مقترح من المخزون المتوفر</span>
                          <h4 class="proposal-title">{msg.designAction.name}</h4>
                        </div>
                        <div class="proposal-details">
                          <div class="proposal-row">
                            <span>نمط التنسيق:</span>
                            <b>{msg.designAction.style === 'dome' ? 'دائري كلاسيكي متناسق' : msg.designAction.style === 'royal' ? 'ملكي متدرج فاخر' : msg.designAction.style === 'heart' ? 'رومانسي مدمج فاخر' : 'بوهيمي عصري'}</b>
                          </div>
                          <div class="proposal-row">
                            <span>التغليف والشريط:</span>
                            <b>{msg.designAction.wrapName || msg.designAction.wrap} + {msg.designAction.ribbonName || msg.designAction.ribbon}</b>
                          </div>
                          <div class="proposal-row">
                            <span>السعر الإجمالي:</span>
                            <b class="price-val">{msg.designAction.totalPrice} د.ل</b>
                          </div>
                          <div class="proposal-stems-list">
                            {#each msg.designAction.stems as s}
                              <div class="stem-chip">
                                <span class="chip-dot" style="background-color: {s.color || '#5e6b2c'}"></span>
                                <span>{s.qty} × {s.name}</span>
                                <span class="sec-label">({s.section === 'center' ? 'الوسط' : s.section === 'top' ? 'فوق' : s.section === 'bottom' ? 'القاعدة' : s.section === 'left' ? 'يسار' : 'يمين'})</span>
                              </div>
                            {/each}
                          </div>
                        </div>
                        <button 
                          type="button" 
                          class="btn btn-apply-design" 
                          on:click={() => applyAiBouquetDesign(msg.designAction)}
                        >
                          تطبيق هذا التصميم على اللوحة فوراً
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}

              {#if chatIsLoading}
                <div class="chat-msg-row ai">
                  <div class="msg-avatar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2L3 9l9 13 9-13-9-7z"/>
                    </svg>
                  </div>
                  <div class="msg-bubble typing-bubble">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-text">جاري استشارة خبير مسكة للذكاء الاصطناعي…</span>
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
                إرسال ↵
              </button>
            </form>

            <div class="chat-disclaimer">
              تنبيه: هذا المساعد مبرمج للإجابة حصرياً عن الزهور والباقات، وأي سؤال خارج هذا النطاق يتم الاعتذار عنه فوراً لضمان التخصص والدقة.
            </div>
          </div>
        {/if}

        <!-- 1. تبويب اختيار زهور الباقة وكمياتها (تنسيق تلقائي بالقالب دون تعديل يدوي) -->
        {#if activeTab === 'flowers'}
          <div class="card control-box fade-in main-design-box">
            <div class="box-head">
              <div>
                <span class="badge badge-gold">الخطوة الأولى</span>
                <h3>1. اختيار زهور الباقة وكمياتها</h3>
                <p class="box-subdesc">
                  اختر الورود والكميات، وسيقوم النظام بتنسيقها تلقائياً وبشكل متناغم وفوري بالقالب المختار:
                </p>
              </div>
              <span class="count-badge">{totalStems} ساق مختارة</span>
            </div>

            <!-- بطاقة إشعار القالب المطبق حالياً مع خيار التبديل -->
            <div class="active-template-banner">
              <div class="at-info">
                <span class="at-icon">{bouquetTemplates.find(t => t.id === currentTemplateId)?.icon || '🪷'}</span>
                <div>
                  <div class="at-name-row">
                    <span class="at-label">القالب المطبق حالياً:</span>
                    <b class="at-name">{bouquetTemplates.find(t => t.id === currentTemplateId)?.name || ''}</b>
                    <span class="tpl-tag {bouquetTemplates.find(t => t.id === currentTemplateId)?.badgeClass || ''}">
                      {bouquetTemplates.find(t => t.id === currentTemplateId)?.viewMode === 'top' ? 'مشهد علوي 🪷' : 'مشهد أمامي 🎀'}
                    </span>
                  </div>
                  <span class="at-desc">{bouquetTemplates.find(t => t.id === currentTemplateId)?.subtitle || ''}</span>
                </div>
              </div>
              <div class="at-actions">
                <button type="button" class="btn btn-lush-fill btn-sm" on:click={fillFullLushBouquet} title="ملء الباقة بسجادة زهور متراصة وممتلئة لكامل الغلاف كصور الـ 100 وردة">
                  ملء الباقة الملكي 👑
                </button>
                <button type="button" class="btn btn-outline btn-sm btn-jump-templates" on:click={() => activeTab = 'templates'}>
                  تغيير القالب 📐
                </button>
              </div>
            </div>

            <div class="flowers-list">
              {#each flowers as f (f.id)}
                <div class="flower-row" class:has-qty={f.qty > 0}>
                  <div class="flower-meta">
                    <div class="flower-blossom-preview" title="{f.name} - بتلات طبيعية نقية بدون خلفية">
                      <img 
                        src={getFlowerAngleImage(f, 'top')} 
                        alt={f.name} 
                        class="blossom-thumb-img" 
                        loading="lazy" 
                      />
                      <span class="blossom-color-dot" style="background-color: {f.color};"></span>
                    </div>
                    <div>
                      <h4 class="flower-name">{f.name}</h4>
                      <span class="flower-stock">المخزون المتوفر: {f.stock_quantity} ساق</span>
                    </div>
                  </div>

                  <div class="flower-price">
                    {f.unit_price} د.ل
                    <small>/ساق</small>
                  </div>

                  <!-- اختيار موقع الوردة في التنسيق -->
                  <div class="section-select-box">
                    <label for="sec-{f.id}" class="sr-only">موقع النوع:</label>
                    <select 
                      id="sec-{f.id}" 
                      class="section-dropdown"
                      value={f.section}
                      on:change={(e) => handleSectionChange(f.id, e.target.value)}
                      title="الموقع المفضل لنوع الزهرة في التنسيق"
                    >
                      <option value="center">في الوسط والمركز 🎯</option>
                      <option value="top">في الأعلى والقمة 🔝</option>
                      <option value="left">على اليسار 👈</option>
                      <option value="right">على اليمين 👉</option>
                      <option value="bottom">في الأسفل والقاعدة 🔽</option>
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

        <!-- 2. تبويب كتاكوري قوالب وأنماط التنسيق الفاخرة (Bouquet Templates Category) -->
        {#if activeTab === 'templates'}
          <div class="card control-box fade-in templates-panel-card">
            <div class="box-head">
              <div>
                <span class="badge badge-gold">قوالب التنسيق الملكية</span>
                <h3>قوالب وأشكال التنسيق الهندسي</h3>
                <p class="box-subdesc">
                  اختر القالب المفضل، وسيقوم النظام بتنسيق باقتك تلقائياً وبأعلى معايير التناسق والجمال الفني:
                </p>
              </div>
              <span class="count-badge active-tpl-name">
                {bouquetTemplates.find(t => t.id === currentTemplateId)?.name || 'قالب محدد'}
              </span>
            </div>

            <!-- شريط تصفية القوالب حسب المشهد ونوع التصميم -->
            <div class="template-filter-bar">
              <button 
                type="button" 
                class="filter-pill" 
                class:active={templateFilter === 'all'}
                on:click={() => templateFilter = 'all'}
              >
                جميع القوالب ({bouquetTemplates.length})
              </button>
              <button 
                type="button" 
                class="filter-pill" 
                class:active={templateFilter === 'top'}
                on:click={() => templateFilter = 'top'}
              >
                🪷 المشهد العلوي ({bouquetTemplates.filter(t => t.viewMode === 'top').length})
              </button>
              <button 
                type="button" 
                class="filter-pill" 
                class:active={templateFilter === 'front'}
                on:click={() => templateFilter = 'front'}
              >
                🎀 المشهد الأمامي ({bouquetTemplates.filter(t => t.viewMode === 'front').length})
              </button>
            </div>

            <!-- شبكة بطاقات القوالب الفاخرة -->
            <div class="templates-grid">
              {#each filteredTemplates as tpl (tpl.id)}
                <div 
                  class="template-card" 
                  class:selected={currentTemplateId === tpl.id}
                  on:click={() => selectTemplate(tpl.id)}
                >
                  <div class="tpl-header">
                    <div class="tpl-icon-box">
                      <span class="tpl-icon">{tpl.icon}</span>
                    </div>
                    <div class="tpl-titles">
                      <div class="tpl-name-row">
                        <h4 class="tpl-name">{tpl.name}</h4>
                        {#if currentTemplateId === tpl.id}
                          <span class="active-sparkle-pill">القالب المطبق ✨</span>
                        {/if}
                      </div>
                      <span class="tpl-subtitle">{tpl.subtitle}</span>
                    </div>
                  </div>

                  <p class="tpl-desc">{tpl.desc}</p>

                  <div class="tpl-meta-strip">
                    <span class="tpl-tag {tpl.badgeClass}">{tpl.tag}</span>
                    <span class="tpl-suitable">{tpl.suitableFor}</span>
                  </div>

                  <div class="tpl-action-row">
                    <button 
                      type="button" 
                      class="btn btn-tpl-select" 
                      class:active={currentTemplateId === tpl.id}
                      on:click|stopPropagation={() => selectTemplate(tpl.id)}
                    >
                      {currentTemplateId === tpl.id ? 'القالب المطبق حالياً ✓' : 'اختيار وتطبيق هذا القالب'}
                    </button>
                  </div>
                </div>
              {/each}
            </div>

            <!-- أدوات التحليل والانسجام اللوني بالذكاء الاصطناعي -->
            <div class="ai-harmony-box">
              <div class="ai-harmony-header">
                <div>
                  <h4 class="harmony-title">تحليل التناغم والانسجام الفني للباقة</h4>
                  <p class="harmony-sub">حساب التوازن البصري والانسجام اللوني وفق عدد وتوزيع الزهور الحالية</p>
                </div>
                <button 
                  type="button" 
                  class="btn btn-outline btn-sm btn-rebalance"
                  disabled={aiIsThinking || totalStems === 0}
                  on:click={() => applyBouquetTemplate(currentTemplateId, true)}
                >
                  {aiIsThinking ? 'جاري التنسيق...' : 'إعادة ضبط التناغم الذكي 🪄'}
                </button>
              </div>

              <div class="analytics-bars">
                <div class="metric-row">
                  <div class="metric-head">
                    <span>تناغم الألوان وتكاملها</span>
                    <b>{colorHarmonyScore}%</b>
                  </div>
                  <div class="metric-track">
                    <div class="metric-fill" style="width: {colorHarmonyScore}%;"></div>
                  </div>
                </div>

                <div class="metric-row">
                  <div class="metric-head">
                    <span>التوازن البصري وتوزيع الكتل في القالب</span>
                    <b>{visualBalanceScore}%</b>
                  </div>
                  <div class="metric-track">
                    <div class="metric-fill balance-fill" style="width: {visualBalanceScore}%;"></div>
                  </div>
                </div>
              </div>

              <div class="ai-suggestion-box">
                <p>{aiSuggestion}</p>
              </div>
            </div>

            <!-- أوامر التنسيق النصية السريعة بالذكاء الاصطناعي داخل تبويب القوالب -->
            <div class="ai-prompt-container template-prompt-addon">
              <label class="prompt-label" for="tpl-prompt-input">أمر مخصص للمنسق الذكي لتعديل توزيع القالب:</label>
              <div class="ai-input-group">
                <input 
                  id="tpl-prompt-input"
                  type="text" 
                  class="input-field ai-text-input" 
                  placeholder="مثال: ركز الجوري بالوسط، وزع الأوكالبتوس على الأطراف، واجعل التنسيق متدرجاً…"
                  bind:value={aiPromptText}
                  on:keydown={(e) => e.key === 'Enter' && executeAiPrompt()}
                />
                <button 
                  type="button" 
                  class="btn btn-primary ai-run-btn"
                  disabled={aiIsThinking}
                  on:click={executeAiPrompt}
                >
                  {aiIsThinking ? 'جاري التنفيذ…' : 'تطبيق بالذكاء الاصطناعي'}
                </button>
              </div>
            </div>

          </div>
        {/if}



        <!-- 4. تبويب التغليف الملكي وشريط الساتان والختم الشمعي -->
        {#if activeTab === 'packaging'}
          <div class="card control-box fade-in">
            <div class="box-head">
              <div>
                <h3>أغلفة الباقة، شريط الساتان، والختم الشمعي</h3>
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
                    on:click={() => { selectedWrap = wrap; aiStatusMessage = `تم تغيير ورق التغليف إلى (${wrap.name})`; }}
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
                    on:click={() => { selectedRibbon = ribbon; aiStatusMessage = `تم تغيير شريط الساتان إلى (${ribbon.name})`; }}
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
                    <option value="MASKA">MASKA (شعار مسكة الرسمي)</option>
                    <option value="زهرة اللوتس">زهرة اللوتس الملكية</option>
                    <option value="غصن الزيتون">غصن الزيتون والأصالة</option>
                    <option value="تاج المحبة">تاج المحبة والتقدير</option>
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
              <div class="preview-title-row">
                <h3 class="preview-title">معاينة الباقة الحية</h3>
                <span class="scene-mode-badge" class:top={viewMode === 'top'} class:front={viewMode === 'front'}>
                  {#if viewMode === 'top'}
                    🪷 مشهد علوي • قبة الزهور الملكية
                  {:else}
                    🎀 مشهد أمامي • باقة مغلفة
                  {/if}
                </span>
              </div>
              <span class="preview-subtitle">
                {#if viewMode === 'top'}
                  {stems.length} وردة منسقة | رؤية علوية لتنسيق وتوزيع الزهور بحرية
                {:else}
                  {stems.length} وردة منسقة | {selectedWrap.name} ({selectedRibbon.name})
                {/if}
              </span>
            </div>

            <!-- أزرار التحكم بالمسرح -->
            <div class="stage-actions">
              <!-- زر تبديل المشهد بين علوي (تنسيق الزهور) وأمامي (التغليف والشريط) -->
              <button 
                type="button" 
                class="stage-tool-btn view-toggle-btn" 
                class:active={viewMode === 'top'}
                title={viewMode === 'top' ? 'التبديل للمشهد الأمامي المغلف (زي توا)' : 'التبديل للمشهد العلوي لقبة الزهور'}
                on:click={toggleViewMode}
              >
                {#if viewMode === 'top'}
                  🪷 علوي
                {:else}
                  🎀 أمامي
                {/if}
              </button>

              <button 
                type="button" 
                class="stage-tool-btn" 
                class:active={showGrid}
                title="إظهار/إخفاء شبكة التوجيه الحرفية"
                on:click={() => showGrid = !showGrid}
              >
                📐
              </button>

              <button 
                type="button" 
                class="stage-tool-btn" 
                class:active={is3DRotating}
                title={is3DRotating ? 'إيقاف الدوران' : 'تدوير تلقائي 360°'}
                on:click={() => is3DRotating = !is3DRotating}
              >
                {is3DRotating ? '⏸️' : '🔄'}
              </button>
            </div>
          </div>

          <!-- شريط حالة وتنبيه الذكاء الاصطناعي اللحظي -->
          <div class="ai-status-strip">
            <span class="ai-spark">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L3 9l9 13 9-13-9-7z"/>
              </svg>
            </span>
            <span class="ai-strip-text">{aiStatusMessage}</span>
          </div>

          <!-- لوحة المسرح المرئي (Interactive Canvas Viewport) -->
          <div 
            class="stage-viewport" 
            class:rotating={is3DRotating}
            class:with-grid={showGrid && viewMode === 'front'}
            class:is-top-view={viewMode === 'top'}
            class:is-front-view={viewMode === 'front'}
            bind:this={canvasContainer}
          >
            <!-- 0. طوق التاج النجمي المسنن الملكي في المشهد العلوي (Royal Star-Point Origami Crown - كالصورة 2 و 5 و 6) -->
            {#if viewMode === 'top'}
              <svg class="wrap-top-svg fade-in" viewBox="0 0 460 460">
                <defs>
                  <radialGradient id="starWrapNestGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="{selectedWrap.darkColor}" stop-opacity="0.92" />
                    <stop offset="70%" stop-color="{selectedWrap.color}" stop-opacity="0.96" />
                    <stop offset="100%" stop-color="{selectedWrap.darkColor}" stop-opacity="1" />
                  </radialGradient>
                  <filter id="starCrownShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="12" stdDeviation="18" flood-opacity="0.35" />
                  </filter>
                </defs>

                {#if currentTemplateId === 'round_dome'}
                  <!-- 1. طوق التاج النجمي المسنن: 16 مثلث أوريغامي حاد ومسنن يلتف 360° حول الباقة بالكامل كالصورة 5 و 6 -->
                  <g transform="translate(230, 230)" filter="url(#starCrownShadow)">
                    {#each Array(16) as _, i}
                      <g transform="rotate({i * 22.5})">
                        <polygon 
                          points="0,-225 -45,-114 0,-114" 
                          fill="{selectedWrap.color}" 
                          stroke="rgba(255,255,255,0.3)" 
                          stroke-width="0.8"
                        />
                        <polygon 
                          points="0,-225 0,-114 45,-114" 
                          fill="{selectedWrap.darkColor}" 
                          stroke="rgba(255,255,255,0.2)" 
                          stroke-width="0.8"
                        />
                        <line x1="0" y1="-225" x2="0" y2="-114" stroke="#ffffff" stroke-width="1.2" opacity="0.45" />
                        <line x1="0" y1="-225" x2="-22" y2="-170" stroke="rgba(218,165,32,0.7)" stroke-width="1.4" />
                        <line x1="0" y1="-225" x2="22" y2="-170" stroke="rgba(218,165,32,0.7)" stroke-width="1.4" />
                      </g>
                    {/each}
                    <circle r="122" fill="{selectedWrap.darkColor}" opacity="0.75" />
                    <circle r="116" fill="url(#starWrapNestGrad)" stroke="rgba(255,255,255,0.35)" stroke-width="2" />
                    <circle r="110" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="4" />
                    <circle r="85" fill="none" stroke="rgba(255,255,255,0.18)" stroke-dasharray="4 4" stroke-width="1" />
                  </g>

                {:else if currentTemplateId === 'compact_posy'}
                  <!-- 2. طوق أسطواني فرنسي ناعم بياقة كشكش بليسيه بيضاء ناعمة مذهبة (Parisian Box Collar) -->
                  <g transform="translate(230, 230)" filter="url(#starCrownShadow)">
                    <circle r="218" fill="{selectedWrap.darkColor}" opacity="0.5" />
                    <circle r="210" fill="url(#starWrapNestGrad)" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" />
                    <circle r="202" fill="none" stroke="rgba(218,165,32,0.85)" stroke-width="2.5" />
                    <circle r="196" fill="none" stroke="rgba(218,165,32,0.4)" stroke-width="1" stroke-dasharray="5 4" />
                    
                    <!-- 24 ثنية كشكش بليسيه حريرية بيضاء تلف الزهور بنعومة -->
                    {#each Array(24) as _, i}
                      <g transform="rotate({i * 15})">
                        <path d="M -16,-196 Q 0,-208 16,-196 L 12,-114 Q 0,-120 -12,-114 Z" fill="#ffffff" opacity="0.88" stroke="rgba(218,165,32,0.4)" stroke-width="0.8" />
                        <line x1="0" y1="-202" x2="0" y2="-116" stroke="rgba(197,155,39,0.3)" stroke-width="0.8" />
                      </g>
                    {/each}

                    <circle r="114" fill="{selectedWrap.darkColor}" opacity="0.9" />
                    <circle r="108" fill="url(#starWrapNestGrad)" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
                    <circle r="80" fill="none" stroke="rgba(218,165,32,0.3)" stroke-width="1" stroke-dasharray="3 3" />

                    <!-- شعار MASKA PARIS المذهب على حافة العلبة -->
                    <g transform="translate(0, -170)">
                      <rect x="-42" y="-9" width="84" height="18" rx="9" fill="rgba(34,34,34,0.85)" stroke="rgba(218,165,32,0.9)" stroke-width="1.2" />
                      <text x="0" y="4" fill="#d4af37" font-size="8.5" font-weight="900" text-anchor="middle" letter-spacing="1">MASKA PARIS</text>
                    </g>
                  </g>

                {:else if currentTemplateId === 'grand_dome'}
                  <!-- 3. طوق أوريغامي مزدوج الطبقات ضخم (24 سن مسنن مذهب على طبقتين) لباقات الـ 100 وردة -->
                  <g transform="translate(230, 230)" filter="url(#starCrownShadow)">
                    <!-- الطبقة الخارجية: 24 سن مسنن واسع -->
                    {#each Array(24) as _, i}
                      <g transform="rotate({i * 15})">
                        <polygon points="0,-228 -30,-120 0,-120" fill="{selectedWrap.color}" stroke="rgba(255,255,255,0.25)" stroke-width="0.7" />
                        <polygon points="0,-228 0,-120 30,-120" fill="{selectedWrap.darkColor}" stroke="rgba(255,255,255,0.18)" stroke-width="0.7" />
                        <line x1="0" y1="-228" x2="0" y2="-120" stroke="#ffffff" stroke-width="1.1" opacity="0.4" />
                        <line x1="0" y1="-228" x2="-16" y2="-178" stroke="rgba(218,165,32,0.7)" stroke-width="1.2" />
                        <line x1="0" y1="-228" x2="16" y2="-178" stroke="rgba(218,165,32,0.7)" stroke-width="1.2" />
                      </g>
                    {/each}

                    <!-- الطبقة الداخلية المتداخلة: 24 سن مسنن مذهب -->
                    {#each Array(24) as _, i}
                      <g transform="rotate({i * 15 + 7.5})">
                        <polygon points="0,-175 -22,-116 0,-116" fill="{selectedWrap.darkColor}" opacity="0.95" />
                        <polygon points="0,-175 0,-116 22,-116" fill="{selectedWrap.color}" opacity="0.95" />
                        <line x1="0" y1="-175" x2="-14" y2="-140" stroke="rgba(218,165,32,0.9)" stroke-width="1.4" />
                        <line x1="0" y1="-175" x2="14" y2="-140" stroke="rgba(218,165,32,0.9)" stroke-width="1.4" />
                      </g>
                    {/each}

                    <circle r="124" fill="{selectedWrap.darkColor}" opacity="0.85" />
                    <circle r="118" fill="url(#starWrapNestGrad)" stroke="rgba(218,165,32,0.7)" stroke-width="2.5" />
                    <circle r="112" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="3" />
                  </g>

                {:else if currentTemplateId === 'heart_shape'}
                  <!-- 4. غلاف أوريغامي هندسي فاخر على شكل قلب مذهب بالكامل -->
                  <g transform="translate(230, 230)" filter="url(#starCrownShadow)">
                    <path 
                      d="M 0,-70 
                         C -130,-185 -235,-85 -235,45 
                         C -235,135 -115,195 0,230 
                         C 115,195 235,135 235,45 
                         C 235,-85 130,-185 0,-70 Z" 
                      fill="url(#starWrapNestGrad)" 
                      stroke="rgba(255,255,255,0.3)" 
                      stroke-width="1.5" 
                    />

                    <!-- طيات الأوريغامي الهندسية على فصوص القلب -->
                    <line x1="0" y1="-70" x2="0" y2="230" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />
                    <line x1="0" y1="-70" x2="-160" y2="-130" stroke="rgba(255,255,255,0.3)" stroke-width="1.2" />
                    <line x1="0" y1="-70" x2="160" y2="-130" stroke="rgba(255,255,255,0.3)" stroke-width="1.2" />
                    <line x1="0" y1="0" x2="-230" y2="40" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" />
                    <line x1="0" y1="0" x2="230" y2="40" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" />
                    <line x1="0" y1="90" x2="-160" y2="170" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" />
                    <line x1="0" y1="90" x2="160" y2="170" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" />

                    <!-- برواز ذهبي ملكي يحيط بشكل القلب بالكامل -->
                    <path 
                      d="M 0,-62 
                         C -120,-175 -225,-75 -225,45 
                         C -225,128 -110,188 0,220 
                         C 110,188 225,128 225,45 
                         C 225,-75 120,-175 0,-62 Z" 
                      fill="none" 
                      stroke="rgba(218,165,32,0.85)" 
                      stroke-width="2.5" 
                    />

                    <!-- بطانة داخلية للقلب تحتضن الورود -->
                    <path 
                      d="M 0,-34 
                         C -65,-95 -122,-45 -122,22 
                         C -122,72 -58,104 0,126 
                         C 58,104 122,72 122,22 
                         C 122,-45 65,-95 0,-34 Z" 
                      fill="{selectedWrap.darkColor}" 
                      stroke="rgba(218,165,32,0.95)" 
                      stroke-width="2.5" 
                      opacity="0.9"
                    />
                    <path 
                      d="M 0,-26 
                         C -55,-80 -105,-38 -105,18 
                         C -105,62 -48,90 0,110 
                         C 48,90 105,62 105,18 
                         C 105,-38 55,-80 0,-26 Z" 
                      fill="none" 
                      stroke="rgba(255,255,255,0.2)" 
                      stroke-width="1.5" 
                      stroke-dasharray="4 4" 
                    />
                  </g>

                {:else if currentTemplateId === 'crescent_moon'}
                  <!-- 5. طوق الهلال الملكي الشرقي المذهب: جناح هلالي انسيابي بارز على الجانب -->
                  <g transform="translate(230, 230)" filter="url(#starCrownShadow)">
                    <path 
                      d="M 0,-225 
                         C -170,-225 -235,-95 -235,0 
                         C -235,125 -160,225 0,225 
                         C -105,175 -155,95 -155,0 
                         C -155,-95 -105,-175 0,-225 Z" 
                      fill="url(#starWrapNestGrad)" 
                      stroke="rgba(255,255,255,0.3)" 
                      stroke-width="1.5" 
                    />

                    <!-- قوس ذهبي ملكي على حافة الهلال -->
                    <path 
                      d="M -10,-210 
                         C -155,-200 -218,-85 -218,0 
                         C -218,85 -155,200 -10,210" 
                      stroke="rgba(218,165,32,0.9)" 
                      stroke-width="3" 
                      fill="none" 
                    />
                    <path 
                      d="M -22,-190 
                         C -140,-180 -196,-75 -196,0 
                         C -196,75 -140,180 -22,190" 
                      stroke="rgba(218,165,32,0.4)" 
                      stroke-width="1.5" 
                      stroke-dasharray="6 4" 
                      fill="none" 
                    />

                    <!-- نقوش وزخارف ذهبية على الجناح الهلالي -->
                    <g fill="#d4af37">
                      <polygon points="-190,-60 -186,-52 -178,-50 -184,-44 -182,-36 -190,-40 -198,-36 -196,-44 -202,-50 -194,-52" transform="scale(0.8)" />
                      <polygon points="-210,0 -206,8 -198,10 -204,16 -202,24 -210,20 -218,24 -216,16 -222,10 -214,8" transform="scale(0.7)" />
                      <polygon points="-190,60 -186,68 -178,70 -184,76 -182,84 -190,80 -198,84 -196,76 -202,70 -194,68" transform="scale(0.8)" />
                    </g>

                    <!-- حافة ناعمة على الجانب الأيمن -->
                    <path 
                      d="M 0,-225 C 130,-220 185,-130 185,0 C 185,130 130,220 0,225" 
                      stroke="rgba(218,165,32,0.5)" 
                      stroke-width="2" 
                      fill="none" 
                    />

                    <circle r="116" fill="{selectedWrap.darkColor}" opacity="0.9" />
                    <circle r="110" fill="url(#starWrapNestGrad)" stroke="rgba(218,165,32,0.7)" stroke-width="2" />
                    <circle r="85" fill="none" stroke="rgba(255,255,255,0.2)" stroke-dasharray="4 4" stroke-width="1" />
                  </g>

                {:else if currentTemplateId === 'boho_garden'}
                  <!-- 6. طوق ورق كرافت ريفي بحواف مشرشرة طبيعية وحبل قنب مربوط -->
                  <g transform="translate(230, 230)" filter="url(#starCrownShadow)">
                    <circle r="218" fill="#a48259" opacity="0.4" />
                    <circle r="210" fill="#c8a882" stroke="#8a6e4d" stroke-width="2.5" />
                    
                    <!-- 20 ثنية مشرشرة يدوية (Deckle Edge Scallops) -->
                    {#each Array(20) as _, i}
                      <circle transform="rotate({i * 18}) translate(0, -208)" r="18" fill="#c8a882" stroke="#9d7d56" stroke-width="1" />
                    {/each}

                    <circle r="195" fill="#be9c74" stroke="#7a5d3c" stroke-width="1.8" />
                    <circle r="185" fill="#b18f67" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" stroke-dasharray="5 5" />

                    <!-- حبل قنب طبيعي ملفوف مرتين حول الغلاف -->
                    <circle r="176" fill="none" stroke="#5a4228" stroke-width="3" />
                    <circle r="170" fill="none" stroke="#6f5334" stroke-width="2.5" stroke-dasharray="8 3" />

                    <!-- عقدة حبل القنب وبطاقة نباتية حرفية في الأسفل -->
                    <g transform="translate(0, 172)">
                      <ellipse cx="0" cy="0" rx="9" ry="6" fill="#4a351e" />
                      <path d="M 0,0 C -22,-14 -35,5 -18,16 C -6,22 0,0 0,0" fill="none" stroke="#5a4228" stroke-width="2.5" />
                      <path d="M 0,0 C 22,-14 35,5 18,16 C 6,22 0,0 0,0" fill="none" stroke="#5a4228" stroke-width="2.5" />
                      <g transform="translate(0, 24)">
                        <rect x="-18" y="-7" width="36" height="15" rx="3" fill="#dfcfb8" stroke="#8a6e4d" stroke-width="1" />
                        <text x="0" y="4" fill="#5a4228" font-size="8" font-weight="900" text-anchor="middle">🌿 MASKA</text>
                      </g>
                    </g>

                    <circle r="114" fill="{selectedWrap.darkColor}" opacity="0.85" />
                    <circle r="108" fill="#3a481c" opacity="0.9" stroke="rgba(255,255,255,0.3)" stroke-width="2" />
                  </g>

                {:else if currentTemplateId === 'monogram_dome'}
                  <!-- 7. طوق الأوريغامي الأسود الفاخر لقالب الحروف والأسماء (M ❤️ S Monogram Collar) كالصورة 2 -->
                  <g transform="translate(230, 230)" filter="url(#starCrownShadow)">
                    {#each Array(18) as _, i}
                      <g transform="rotate({i * 20})">
                        <polygon 
                          points="0,-226 -40,-120 0,-120" 
                          fill="#181818" 
                          stroke="rgba(255,255,255,0.2)" 
                          stroke-width="0.8"
                        />
                        <polygon 
                          points="0,-226 0,-120 40,-120" 
                          fill="#0d0d0d" 
                          stroke="rgba(255,255,255,0.15)" 
                          stroke-width="0.8"
                        />
                        <line x1="0" y1="-226" x2="0" y2="-120" stroke="#ffffff" stroke-width="1.1" opacity="0.4" />
                        <line x1="0" y1="-226" x2="-18" y2="-175" stroke="rgba(218,165,32,0.85)" stroke-width="1.4" />
                        <line x1="0" y1="-226" x2="18" y2="-175" stroke="rgba(218,165,32,0.85)" stroke-width="1.4" />
                      </g>
                    {/each}
                    <circle r="126" fill="#0d0d0d" opacity="0.95" />
                    <circle r="120" fill="url(#starWrapNestGrad)" stroke="rgba(218,165,32,0.85)" stroke-width="2.5" />
                    <circle r="114" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="3" />
                    <!-- شارة MASKA MONOGRAM المذهبة -->
                    <g transform="translate(0, -135)">
                      <rect x="-35" y="-8" width="70" height="16" rx="8" fill="rgba(20,20,20,0.9)" stroke="rgba(218,165,32,0.9)" stroke-width="1.2" />
                      <text x="0" y="3" fill="#d4af37" font-size="7.5" font-weight="900" text-anchor="middle" letter-spacing="1">M ❤️ S MONOGRAM</text>
                    </g>
                  </g>
                {/if}
              </svg>

              <!-- حلقة عمق الظل الداخلي فوق حواف الزهور لتبدو مغمورة بعمق داخل الغلاف -->
              <div class="wrap-top-depth-ring"></div>

              <!-- شبكة التوجيه الدائرية الحرفية في المشهد العلوي (عند تفعيل شبكة التوجيه) -->
              {#if showGrid}
                <svg class="radial-guide-grid fade-in" viewBox="0 0 460 460">
                  <g transform="translate(230, 230)">
                    <circle r="30" fill="none" stroke="var(--olive)" stroke-dasharray="3 3" opacity="0.55" stroke-width="1.2" />
                    <circle r="75" fill="none" stroke="var(--olive)" stroke-dasharray="4 4" opacity="0.55" stroke-width="1.2" />
                    <circle r="115" fill="none" stroke="var(--olive)" stroke-dasharray="5 5" opacity="0.45" stroke-width="1.2" />
                    <line x1="-200" y1="0" x2="200" y2="0" stroke="var(--olive)" stroke-dasharray="2 4" opacity="0.4" />
                    <line x1="0" y1="-200" x2="0" y2="200" stroke="var(--olive)" stroke-dasharray="2 4" opacity="0.4" />
                    <text x="6" y="-34" fill="var(--olive)" font-size="11" font-weight="800" opacity="0.85">المركز</text>
                    <text x="6" y="-79" fill="var(--olive)" font-size="11" font-weight="800" opacity="0.85">الوسط</text>
                    <text x="6" y="-119" fill="var(--olive)" font-size="11" font-weight="800" opacity="0.85">المحيط</text>
                  </g>
                </svg>
              {/if}
            {/if}

            <!-- 1. أجنحة ورق التغليف في المشهد الأمامي (هياكل متباينة 100% لكل قالب كصور المستخدم) -->
            {#if viewMode === 'front'}
              <svg class="wrap-back-svg fade-in" viewBox="0 0 420 460">
                <defs>
                  <linearGradient id="koreanWingGradLeft" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="{selectedWrap.color}" stop-opacity="0.95" />
                    <stop offset="60%" stop-color="{selectedWrap.color}" />
                    <stop offset="100%" stop-color="{selectedWrap.darkColor}" stop-opacity="0.98" />
                  </linearGradient>
                  <linearGradient id="koreanWingGradRight" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="{selectedWrap.color}" stop-opacity="0.95" />
                    <stop offset="60%" stop-color="{selectedWrap.color}" />
                    <stop offset="100%" stop-color="{selectedWrap.darkColor}" stop-opacity="0.98" />
                  </linearGradient>
                  <linearGradient id="frostedTranslucentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.80" />
                    <stop offset="50%" stop-color="#fdfbf7" stop-opacity="0.70" />
                    <stop offset="100%" stop-color="#e8e2d5" stop-opacity="0.85" />
                  </linearGradient>
                  <linearGradient id="burgundyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#6b1226" />
                    <stop offset="50%" stop-color="#4a0e1c" />
                    <stop offset="100%" stop-color="#24040a" />
                  </linearGradient>
                  <linearGradient id="origamiBlackGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#2a2a2a" />
                    <stop offset="50%" stop-color="#181818" />
                    <stop offset="100%" stop-color="#0a0a0a" />
                  </linearGradient>
                  <filter id="koreanWrapShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="14" stdDeviation="16" flood-opacity="0.28"/>
                  </filter>
                </defs>

                {#if currentTemplateId === 'korean_fan'}
                  <!-- أ. أجنحة التغليف الشفاف الكوري المذهب (Frosted Translucent Fan) كالصورة 1 تماماً -->
                  <g filter="url(#koreanWrapShadow)">
                    <!-- الجناح الخارجي الأيسر الشفاف -->
                    <path d="M 210,400 L 165,445 L 130,445 L 18,210 C 5,145 15,80 40,40 L 125,115 L 210,400 Z" fill="url(#frostedTranslucentGrad)" stroke="rgba(205,140,110,0.85)" stroke-width="2" />
                    <!-- الجناح الخارجي الأيمن الشفاف -->
                    <path d="M 210,400 L 255,445 L 290,445 L 402,210 C 415,145 405,80 380,40 L 295,115 L 210,400 Z" fill="url(#frostedTranslucentGrad)" stroke="rgba(205,140,110,0.85)" stroke-width="2" />
                    <!-- الورقة المركزية العالية خلف الباقة -->
                    <path d="M 210,10 C 255,15 330,40 370,95 C 380,155 350,260 260,380 L 210,445 L 160,380 C 70,260 40,155 50,95 C 90,40 165,15 210,10 Z" fill="url(#frostedTranslucentGrad)" stroke="rgba(205,140,110,0.85)" stroke-width="2.2" />
                    <!-- خطوط الإطار البرونزي المذهب الداخلية كالصورة 1 -->
                    <path d="M 45,55 L 120,118 L 205,390" stroke="rgba(205,140,110,0.7)" stroke-width="1.8" fill="none" />
                    <path d="M 375,55 L 300,118 L 215,390" stroke="rgba(205,140,110,0.7)" stroke-width="1.8" fill="none" />
                    <path d="M 120,55 Q 210,25 300,55" stroke="rgba(205,140,110,0.75)" stroke-width="1.8" fill="none" />
                  </g>

                {:else if currentTemplateId === 'royal_celebration'}
                  <!-- ب. طيات التغليف المخروطية الأسطوانية العنابية الفاخرة كصورة التخرج 3 تماماً -->
                  <g filter="url(#koreanWrapShadow)">
                    <!-- الأسطوانات/الأنابيب المخروطية المتتالية باللون العنابي -->
                    <!-- أسطوانة أقصى اليسار -->
                    <path d="M 210,400 L 140,445 L 35,160 C 25,110 40,65 65,55 L 120,120 L 210,400 Z" fill="url(#burgundyGrad)" stroke="rgba(218,165,32,0.6)" stroke-width="1.5" />
                    <!-- أسطوانة أقصى اليمين -->
                    <path d="M 210,400 L 280,445 L 385,160 C 395,110 380,65 355,55 L 300,120 L 210,400 Z" fill="url(#burgundyGrad)" stroke="rgba(218,165,32,0.6)" stroke-width="1.5" />
                    <!-- أسطوانة وسطى يسار -->
                    <path d="M 210,400 L 160,420 L 80,120 C 75,70 100,40 135,35 L 175,100 L 210,400 Z" fill="url(#burgundyGrad)" stroke="rgba(218,165,32,0.6)" stroke-width="1.5" />
                    <!-- أسطوانة وسطى يمين -->
                    <path d="M 210,400 L 260,420 L 340,120 C 345,70 320,40 285,35 L 245,100 L 210,400 Z" fill="url(#burgundyGrad)" stroke="rgba(218,165,32,0.6)" stroke-width="1.5" />
                    <!-- التاج العنابي الأوسط المرتفع -->
                    <path d="M 210,12 C 240,15 285,35 305,75 C 315,120 290,240 240,360 L 210,430 L 180,360 C 130,240 105,120 115,75 C 135,35 180,15 210,12 Z" fill="url(#burgundyGrad)" stroke="rgba(218,165,32,0.85)" stroke-width="2" />
                    <!-- بطانة حريرية سوداء/عنابية داكنة خلف الورد -->
                    <ellipse cx="210" cy="180" rx="125" ry="110" fill="#1c0308" opacity="0.8" />
                  </g>

                {:else if currentTemplateId === 'royal_cascade'}
                  <!-- ج. طوق الأوريغامي الأسود المتدرج لباقة الـ 100 وردة كالصورة 5 تماماً -->
                  <g filter="url(#koreanWrapShadow)">
                    <!-- أجنحة ومثلثات أوريغامي حادة فاحمة السواد خلف القبة -->
                    <polygon points="210,420 50,260 20,180 90,140" fill="url(#origamiBlackGrad)" stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
                    <polygon points="210,420 370,260 400,180 330,140" fill="url(#origamiBlackGrad)" stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
                    <polygon points="210,420 80,150 50,70 140,60" fill="url(#origamiBlackGrad)" stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
                    <polygon points="210,420 340,150 370,70 280,60" fill="url(#origamiBlackGrad)" stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
                    <polygon points="210,420 140,70 120,15 210,25" fill="url(#origamiBlackGrad)" stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
                    <polygon points="210,420 280,70 300,15 210,25" fill="url(#origamiBlackGrad)" stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
                    <circle cx="210" cy="190" r="140" fill="#0d0d0d" />
                  </g>

                {:else}
                  <!-- د. قالب الباقة الكلاسيكية الطولية (المخروط المتقاطع) -->
                  <g filter="url(#koreanWrapShadow)">
                    <path d="M 210,430 L 150,445 L 55,200 C 45,130 70,60 110,40 L 170,110 L 210,430 Z" fill="url(#koreanWingGradLeft)" stroke="rgba(218,165,32,0.7)" stroke-width="1.6" />
                    <path d="M 210,430 L 270,445 L 365,200 C 375,130 350,60 310,40 L 250,110 L 210,430 Z" fill="url(#koreanWingGradRight)" stroke="rgba(218,165,32,0.7)" stroke-width="1.6" />
                    <path d="M 210,20 C 240,25 300,50 330,105 C 340,165 310,265 240,380 L 210,440 L 180,380 C 110,265 80,165 90,105 C 120,50 180,25 210,20 Z" fill="url(#koreanWingGradLeft)" stroke="rgba(218,165,32,0.7)" stroke-width="1.6" />
                  </g>
                {/if}
              </svg>
            {/if}

            <!-- 2. طبقة سيقان وزهور الباقة الحية التفاعلية (Draggable Stems & Flowers Layer) -->
            <div class="stems-layer" class:top-spinning={is3DRotating && viewMode === 'top'}>
              {#if stems.length === 0}
                <div class="canvas-empty-hint">
                  <span>الباقة فارغة حالياً</span>
                  <small>أضف سيقان الورد من القائمة لتظهر هنا فوراً!</small>
                </div>
              {/if}

              {#each stems as stem, idx (stem.id)}
                <div 
                  class="stem-canvas-node"
                  class:selected={isCatalogCreateMode && effectiveStemId === stem.id}
                  class:dragging={isCatalogCreateMode && isDragging && dragStemId === stem.id}
                  style="
                    left: calc(50% + {stem.x}px);
                    top: calc(50% + {stem.y}px);
                    transform: translate(-50%, -50%) rotate({stem.rotation}deg) scale({isCatalogCreateMode && isDragging && dragStemId === stem.id ? stem.scale * 1.08 : stem.scale});
                    z-index: {isCatalogCreateMode && isDragging && dragStemId === stem.id ? 9999 : (stem.zIndex || 10)};
                    cursor: {isCatalogCreateMode ? 'grab' : 'default'};
                  "
                  on:mousedown={(e) => isCatalogCreateMode && startStemDrag(e, stem.id)}
                  on:touchstart={(e) => isCatalogCreateMode && startStemDrag(e, stem.id)}
                  on:pointerdown={(e) => isCatalogCreateMode && startStemDrag(e, stem.id)}
                  on:click={() => { if (isCatalogCreateMode) selectedStemId = stem.id; }}
                  role="button"
                  tabindex="0"
                  title="{stem.flowerName} ({getAngleLabelAr(viewMode === 'top' ? 'top' : stem.angle)})"
                >
                  <img 
                    src={getFlowerAngleImage(flowers.find(f => f.id === stem.flowerId) || { key: stem.flowerKey, name: stem.flowerName, color: stem.color }, viewMode === 'top' ? 'top' : stem.angle)} 
                    alt={stem.flowerName}
                    class="stem-img"
                    draggable="false"
                  />
                  
                  {#if isCatalogCreateMode && effectiveStemId === stem.id}
                    <div class="stem-active-ring"></div>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- 3. ياقة الكشكش الحريرية ومقدمة ورق التغليف الملكي (Ruffled Tulle Collar & Front Cone - كالصورة 1 و 3) -->
            {#if viewMode === 'front'}
              <svg class="wrap-front-svg fade-in" viewBox="0 0 380 280">
                <defs>
                  <linearGradient id="koreanFrontConeGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="{selectedWrap.color}" />
                    <stop offset="60%" stop-color="{selectedWrap.color}" />
                    <stop offset="100%" stop-color="{selectedWrap.darkColor}" />
                  </linearGradient>
                  <linearGradient id="tulleRuffleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
                    <stop offset="50%" stop-color="#fdfbf7" stop-opacity="0.9" />
                    <stop offset="100%" stop-color="#ede7db" stop-opacity="0.8" />
                  </linearGradient>
                  <linearGradient id="frontBurgundyGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#5a1020" />
                    <stop offset="50%" stop-color="#420b16" />
                    <stop offset="100%" stop-color="#22040a" />
                  </linearGradient>
                  <linearGradient id="frontOrigamiBlackGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#282828" />
                    <stop offset="60%" stop-color="#141414" />
                    <stop offset="100%" stop-color="#080808" />
                  </linearGradient>
                  <filter id="ruffleShadow">
                    <feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity="0.25"/>
                  </filter>
                  <filter id="coneFoldShadow">
                    <feDropShadow dx="-2" dy="8" stdDeviation="8" flood-opacity="0.32"/>
                  </filter>
                </defs>

                {#if currentTemplateId === 'korean_fan'}
                  <!-- أ. ياقة الكشكش البليسيه الشاش ومخروط التغليف الشفاف كالصورة 1 تماماً -->
                  <!-- مخروط التغليف الورقي الشفاف السفلي -->
                  <path d="M 55,65 C 95,55 140,90 190,120 L 205,200 L 170,275 L 140,275 L 105,245 C 70,195 48,130 55,65 Z" fill="rgba(255,255,255,0.78)" stroke="rgba(205,140,110,0.85)" stroke-width="1.8" filter="url(#coneFoldShadow)" />
                  <path d="M 325,65 C 285,55 240,90 180,130 L 175,205 L 210,275 L 240,275 L 275,245 C 310,195 332,130 325,65 Z" fill="rgba(250,248,242,0.84)" stroke="rgba(205,140,110,0.85)" stroke-width="1.8" filter="url(#coneFoldShadow)" />

                  <!-- ياقة الكشكش الشاش الأبيض الحريري المموج (Plissé Organza Ruffle Collar) -->
                  <g filter="url(#ruffleShadow)">
                    <path 
                      d="M 45,70 
                         C 60,45 80,75 100,52 
                         C 120,78 145,48 170,72 
                         C 195,48 220,78 245,52 
                         C 270,78 295,48 315,70 
                         C 330,55 342,75 348,80 
                         C 335,115 300,132 260,138 
                         C 210,145 170,145 120,138 
                         C 80,132 55,115 45,70 Z" 
                      fill="url(#tulleRuffleGrad)" 
                      stroke="#ffffff" 
                      stroke-width="2.2" 
                    />
                    <!-- خطوط الثنيات البليسيه الرقيقة داخل ياقة الكشكش -->
                    <path d="M 100,52 C 105,80 115,125 120,138" stroke="rgba(197,155,39,0.3)" stroke-width="1" />
                    <path d="M 170,72 C 172,95 175,130 175,145" stroke="rgba(197,155,39,0.3)" stroke-width="1" />
                    <path d="M 245,52 C 240,80 235,125 230,138" stroke="rgba(197,155,39,0.3)" stroke-width="1" />
                    <path d="M 315,70 C 305,92 285,120 270,132" stroke="rgba(197,155,39,0.3)" stroke-width="1" />
                  </g>

                {:else if currentTemplateId === 'royal_celebration'}
                  <!-- ب. طيات التغليف المخروطية الأسطوانية الملفوفة كصورة التخرج 3 تماماً -->
                  <!-- قاعدة المخروط العنابية المجمعة -->
                  <path d="M 60,75 L 180,130 L 195,210 L 165,275 L 130,275 L 90,230 Z" fill="url(#frontBurgundyGrad)" stroke="rgba(218,165,32,0.6)" stroke-width="1.5" filter="url(#coneFoldShadow)" />
                  <path d="M 320,75 L 195,135 L 185,210 L 215,275 L 250,275 L 290,230 Z" fill="url(#frontBurgundyGrad)" stroke="rgba(218,165,32,0.6)" stroke-width="1.5" filter="url(#coneFoldShadow)" />

                  <!-- طيات الأنابيب الأسطوانية الملفوفة المتتالية حول الياقة كالصورة 3 -->
                  <g filter="url(#ruffleShadow)">
                    {#each [-70, -35, 0, 35, 70] as offset, idx}
                      <g transform="translate({190 + offset}, 82) rotate({offset * 0.16})">
                        <!-- أسطوانة ورقية ملفوفة مفرغة الحافة -->
                        <ellipse cx="0" cy="0" rx="16" ry="9" fill="#24040a" stroke="rgba(218,165,32,0.7)" stroke-width="1.4" />
                        <ellipse cx="0" cy="0" rx="12" ry="6" fill="#140206" />
                        <path d="M -16,0 L -12,45 L 12,45 L 16,0 Z" fill="url(#frontBurgundyGrad)" stroke="rgba(218,165,32,0.5)" stroke-width="1" />
                      </g>
                    {/each}
                  </g>

                {:else if currentTemplateId === 'royal_cascade'}
                  <!-- ج. قاعدة الأوريغامي السوداء المسننة لباقة الـ 100 وردة كالصورة 5 تماماً -->
                  <g filter="url(#coneFoldShadow)">
                    <polygon points="190,135 60,80 120,270 190,275" fill="url(#frontOrigamiBlackGrad)" stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
                    <polygon points="190,135 320,80 260,270 190,275" fill="#121212" stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
                    <polygon points="190,135 150,70 190,45 230,70" fill="#222222" stroke="rgba(218,165,32,0.85)" stroke-width="1.5" />
                  </g>

                {:else}
                  <!-- د. ثنية الكيمونو المتقاطعة الكلاسيكية مع الختم الشمعي -->
                  <path d="M 55,60 C 95,50 140,85 190,115 L 205,200 L 170,275 L 140,275 L 105,245 C 70,195 48,130 55,60 Z" fill="url(#koreanFrontConeGrad)" filter="url(#coneFoldShadow)" stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
                  <path d="M 325,60 C 285,50 240,85 180,125 L 175,205 L 210,275 L 240,275 L 275,245 C 310,195 332,130 325,60 Z" fill="url(#koreanFrontConeGrad)" opacity="0.98" filter="url(#coneFoldShadow)" stroke="rgba(218,165,32,0.7)" stroke-width="1.5" />
                {/if}
              </svg>

              <!-- 4. شريط الساتان والختم الشمعي الملكي المدمج في المشهد الأمامي -->
              <div class="ribbon-wax-wrap fade-in">
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

              <!-- 4.1 طاقية التخرج الملكية في باقة التخرج والاحتفالات (كالصورة 3) -->
              {#if currentTemplateId === 'royal_celebration'}
                <div class="grad-cap-overlay fade-in">
                  <svg viewBox="0 0 100 80" class="grad-cap-svg">
                    <defs>
                      <filter id="capShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="2" dy="5" stdDeviation="4" flood-opacity="0.35"/>
                      </filter>
                    </defs>
                    <g filter="url(#capShadow)">
                      <polygon points="50,10 92,28 50,44 8,28" fill="{selectedWrap.darkColor || '#541525'}" stroke="rgba(218,165,32,0.85)" stroke-width="1.4" />
                      <path d="M 24,34 L 24,54 C 24,64 76,64 76,54 L 76,34" fill="{selectedWrap.color || '#3a0d18'}" stroke="rgba(218,165,32,0.7)" stroke-width="1" />
                      <!-- Tassel -->
                      <circle cx="50" cy="27" r="3.5" fill="#d4af37" />
                      <path d="M 50,27 Q 68,34 74,48 L 78,64" stroke="#d4af37" stroke-width="2.2" fill="none" />
                      <polygon points="76,64 80,64 78,72" fill="#d4af37" />
                    </g>
                  </svg>
                </div>
              {/if}

              <!-- قاعدة العرض الرخامية في الأسفل (في المشهد الرأسي فقط) -->
              <div class="stage-pedestal fade-in"></div>
            {/if}

            <!-- 5. شريط التعديل باليد المباشر فوق الباقة الحية (مخصص لوضع المنسقة فقط) -->
            {#if isCatalogCreateMode && selectedStem}
              <div class="canvas-hand-indicator fade-in">
                <span>وضع المنسقة: يمكنك سحب الوردة بيدك للتحريك الدقيق</span>
              </div>

              <div class="canvas-floating-toolbar fade-in">
                <span class="floating-stem-title">#{stems.findIndex(s => s.id === selectedStem.id) + 1} {getCleanFlowerName(selectedStem.flowerName)}:</span>
                <div class="floating-btns-group">
                  <button type="button" class="floating-btn" on:click={() => rotateSelectedStem(-15)} title="لف لليسار 15°">⟲</button>
                  <button type="button" class="floating-btn" on:click={() => rotateSelectedStem(15)} title="لف لليمين 15°">⟳</button>
                  <button type="button" class="floating-btn" on:click={() => scaleSelectedStem(-0.05)} title="تصغير الحجم">🔍−</button>
                  <button type="button" class="floating-btn" on:click={() => scaleSelectedStem(0.05)} title="تكبير الحجم">🔍+</button>
                  <button type="button" class="floating-btn" on:click={cycleSelectedStemAngle} title="تغيير زاوية الرؤية">
                    {selectedStem.angle === 'front' ? '🌸 أمامي' : (selectedStem.angle === 'side' ? '🌿 جانبي' : (selectedStem.angle === 'top' ? '🪷 علوي' : '🌾 ساق'))}
                  </button>
                  <button type="button" class="floating-btn floating-btn-del" on:click={deleteSelectedStem} title="حذف الوردة">🗑️</button>
                  <button type="button" class="floating-btn" on:click={() => selectedStemId = null} title="إلغاء التحديد وإخفاء الشريط">✕</button>
                </div>
              </div>
            {/if}
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
              <b class="free-badge">مجاني</b>
            </div>

            <div class="total-bar">
              <span>إجمالي الباقة المصممة:</span>
              <span class="total-price">{grandTotal} د.ل</span>
            </div>

            {#if isCatalogCreateMode}
              <button 
                type="button" 
                class="btn btn-primary btn-block btn-lg cta-cart-btn florist-cta-publish" 
                disabled={isPublishingToCatalog || totalStems < 1}
                on:click={handlePublishBouquetToCatalog}
              >
                {isPublishingToCatalog ? 'جاري الاعتماد والنشر...' : 'اعتماد ونشر الباقة في الكتالوج 🌸'}
              </button>
            {:else}
              <button 
                type="button" 
                class="btn btn-primary btn-block btn-lg cta-cart-btn" 
                on:click={handleAddCustomToCart}
              >
                أضف الباقة المنسقة للسلة 🛍️
              </button>
            {/if}
          </div>

        </div>
      </aside>

    </div>

    <!-- 3. قسم محادثة خبير مسكة للذكاء الاصطناعي في الأسفل (AI Florist Live Chat Stream) -->
    <section class="studio-ai-chat-section fade-in" id="studio-ai-chat">
      <div class="card ai-chat-card">
        
        <!-- رأس الشات -->
        <div class="chat-header">
          <div class="chat-agent-info">
            <div class="agent-avatar-wrap">
              <span class="agent-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L3 9l9 13 9-13-9-7z"/>
                </svg>
              </span>
              <span class="agent-status-dot" title="متصل ومستعد للإجابة"></span>
            </div>
            <div>
              <div class="agent-title-row">
                <h3 class="agent-name">محادثة مباشرة مع خبير مسكة للذكاء الاصطناعي</h3>
                <span class="badge badge-gold">Gemini Floral AI</span>
              </div>
              <p class="agent-desc">
                اسأل عن معاني الورود، دلالات الألوان، نصائح العناية وإطالة النضارة، أو اطلب تنسيقاً فورياً للباقة الحية أعلاه.
              </p>
            </div>
          </div>

          <div class="chat-scope-badge">
            
            <span>نطاق مقيّد بالزهور والباقات فقط</span>
          </div>
        </div>

        <!-- أزرار الأسئلة السريعة الشائعة -->
        <div class="chat-quick-questions">
          <span class="quick-title">جرّب الضغط على طلب تصميم فوري أو سؤال سريع:</span>
          <button type="button" class="quick-q-btn btn-design-quick" on:click={() => sendChatMessage('صمملي باقة رومانسية فخمة من الورد المتوفر عندك')}>
            صمملي باقة رومانسية
          </button>
          <button type="button" class="quick-q-btn btn-design-quick" on:click={() => sendChatMessage('صمملي باقة تخرج ونجاح مبهجة بالورد المتاح')}>
            صمملي باقة تخرج
          </button>
          <button type="button" class="quick-q-btn btn-design-quick" on:click={() => sendChatMessage('صمملي باقة زفاف ملكية ناصعة')}>
            صمملي باقة زفاف ملكية
          </button>
          <button type="button" class="quick-q-btn" on:click={() => sendChatMessage('ما هو معنى ودلالة الورد الجوري الأحمر؟')}>
            ما دلالة الجوري الأحمر؟
          </button>
          <button type="button" class="quick-q-btn" on:click={() => sendChatMessage('كيف أعتني بالباقة في المزهرية لتطول نضارتها لأكثر من 10 أيام؟')}>
            كيف أعتني بالباقة لتدوم نضرة؟
          </button>
          <button type="button" class="quick-q-btn btn-try-guardrail" on:click={() => sendChatMessage('اكتب لي كود بايثون لحساب الأرقام')}>
            تجربة سؤال خارج السياق
          </button>
        </div>

        <!-- صندوق سيل الرسائل (Chat Stream Body) -->
        <div class="chat-messages-body" bind:this={chatMessagesContainer}>
          {#each chatMessages as msg (msg.id)}
            <div class="chat-msg-row" class:user={msg.sender === 'user'} class:ai={msg.sender === 'ai'}>
              <div class="msg-avatar">
                {msg.sender === 'user' ? 'أنت' : 'مسكة'}
              </div>
              <div class="msg-bubble" class:off-topic={msg.isOffTopic}>
                <div class="msg-header">
                  <span class="msg-sender-name">{msg.sender === 'user' ? 'أنت (الزبون)' : 'خبير مسكة للزهور'}</span>
                  <span class="msg-time">{msg.timestamp}</span>
                </div>
                <div class="msg-text">
                  {@html msg.text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}
                </div>

                {#if msg.designAction}
                  <div class="ai-bouquet-proposal-card">
                    <div class="proposal-head">
                      <span class="proposal-tag">تصميم مقترح من المخزون المتوفر</span>
                      <h4 class="proposal-title">{msg.designAction.name}</h4>
                    </div>
                    <div class="proposal-details">
                      <div class="proposal-row">
                        <span>نمط التنسيق:</span>
                        <b>{msg.designAction.style === 'dome' ? 'دائري كلاسيكي متناسق' : msg.designAction.style === 'royal' ? 'ملكي متدرج فاخر' : msg.designAction.style === 'heart' ? 'رومانسي مدمج فاخر' : 'بوهيمي عصري'}</b>
                      </div>
                      <div class="proposal-row">
                        <span>التغليف والشريط:</span>
                        <b>{msg.designAction.wrapName || msg.designAction.wrap} + {msg.designAction.ribbonName || msg.designAction.ribbon}</b>
                      </div>
                      <div class="proposal-row">
                        <span>السعر الإجمالي:</span>
                        <b class="price-val">{msg.designAction.totalPrice} د.ل</b>
                      </div>
                      <div class="proposal-stems-list">
                        {#each msg.designAction.stems as s}
                          <div class="stem-chip">
                            <span class="chip-dot" style="background-color: {s.color || '#5e6b2c'}"></span>
                            <span>{s.qty} × {s.name}</span>
                            <span class="sec-label">({s.section === 'center' ? 'الوسط' : s.section === 'top' ? 'فوق' : s.section === 'bottom' ? 'القاعدة' : s.section === 'left' ? 'يسار' : 'يمين'})</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                    <button 
                      type="button" 
                      class="btn btn-apply-design" 
                      on:click={() => applyAiBouquetDesign(msg.designAction)}
                    >
                      تطبيق هذا التصميم على اللوحة فوراً
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          {/each}

          {#if chatIsLoading}
            <div class="chat-msg-row ai">
              <div class="msg-avatar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L3 9l9 13 9-13-9-7z"/>
                </svg>
              </div>
              <div class="msg-bubble typing-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-text">جاري استشارة خبير مسكة للذكاء الاصطناعي…</span>
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
            إرسال ↵
          </button>
        </form>

        <div class="chat-disclaimer">
          تنبيه: هذا المساعد الذكي مبرمج للإجابة حصرياً عن عالم الزهور والباقات، وأي سؤال خارج هذا النطاق سيتم الاعتذار عنه فوراً لضمان التخصص والدقة.
        </div>

      </div>
    </section>
  </div>

  <!-- زر الشات العائم في أسفل الشاشة (Floating Chat Pill) -->
  <button type="button" class="floating-chat-trigger" on:click={scrollToChat} title="محادثة خبير الذكاء الاصطناعي">
    <span class="float-icon">AI</span>
    <span class="float-text">شات خبير مسكة للزهور</span>
    <span class="float-status-dot"></span>
  </button>
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
    margin-bottom: 16px;
  }

  /* أزرار الإجراءات السريعة في رأس الصفحة */
  .header-action-pills {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 14px;
  }
  .action-pill-chat {
    background: linear-gradient(135deg, var(--olive), #3a471b);
    color: #ffffff;
    border: none;
    padding: 10px 20px;
    border-radius: var(--radius-full);
    font-size: 0.95rem;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(94, 107, 44, 0.35);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .action-pill-chat:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(94, 107, 44, 0.45);
  }
  .action-pill-scroll {
    background: var(--card-solid);
    color: var(--olive);
    border: 1.5px solid var(--olive);
    padding: 10px 18px;
    border-radius: var(--radius-full);
    font-size: 0.92rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .action-pill-scroll:hover {
    background: rgba(94, 107, 44, 0.08);
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
    grid-template-columns: 1fr 1.08fr;
    gap: 24px;
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
  .flower-blossom-preview {
    position: relative;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(246,242,235,0.55) 100%);
    border: 1.5px solid rgba(197, 155, 39, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    flex-shrink: 0;
  }
  .blossom-thumb-img {
    width: 34px;
    height: 34px;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
    pointer-events: none;
    user-select: none;
  }
  .blossom-color-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1.5px solid #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
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

  /* =========================================================================
     Active Template Banner (in Flowers Tab)
     ========================================================================= */
  .active-template-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, rgba(94, 107, 44, 0.08) 0%, rgba(197, 155, 39, 0.08) 100%);
    border: 1.5px solid rgba(94, 107, 44, 0.25);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    margin-bottom: 18px;
    gap: 12px;
    flex-wrap: wrap;
  }
  .at-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .at-icon {
    font-size: 1.6rem;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--card-solid);
    border-radius: 50%;
    border: 1px solid rgba(94, 107, 44, 0.2);
    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
    flex-shrink: 0;
  }
  .at-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 2px;
  }
  .at-label {
    font-size: 0.82rem;
    color: var(--text-muted);
  }
  .at-name {
    font-size: 0.98rem;
    font-weight: 800;
    color: var(--olive);
  }
  .at-desc {
    font-size: 0.78rem;
    color: var(--text-muted);
  }
  .at-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn-lush-fill {
    background: linear-gradient(135deg, #c59b27, #e6c875);
    color: #1a1a1a;
    font-weight: 800;
    border: none;
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 10px rgba(197, 155, 39, 0.35);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }
  .btn-lush-fill:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(197, 155, 39, 0.5);
  }
  .btn-jump-templates {
    font-weight: 700;
    font-size: 0.85rem;
    padding: 6px 14px;
    white-space: nowrap;
  }

  /* =========================================================================
     Templates Category Panel Styles
     ========================================================================= */
  .templates-panel-card {
    padding: 24px;
  }
  .active-tpl-name {
    background: var(--olive);
    color: #fff;
    font-weight: 800;
  }
  .template-filter-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }
  .filter-pill {
    background: var(--bg);
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius-full);
    padding: 6px 16px;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
    transition: all 0.2s;
  }
  .filter-pill:hover {
    border-color: var(--olive);
    background: rgba(94, 107, 44, 0.06);
  }
  .filter-pill.active {
    background: var(--olive);
    color: #ffffff;
    border-color: var(--olive);
    box-shadow: 0 2px 8px rgba(94, 107, 44, 0.25);
  }

  /* شبكة بطاقات القوالب الفاخرة */
  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .template-card {
    background: var(--bg);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-md);
    padding: 16px;
    cursor: pointer;
    transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
  }
  .template-card:hover {
    transform: translateY(-2px);
    border-color: var(--olive);
    background: var(--card-solid);
    box-shadow: 0 8px 20px rgba(94, 107, 44, 0.12);
  }
  .template-card.selected {
    border-color: var(--olive);
    border-width: 2px;
    background: linear-gradient(180deg, rgba(94, 107, 44, 0.05) 0%, var(--card-solid) 100%);
    box-shadow: 0 0 0 1px var(--olive), 0 8px 24px rgba(94, 107, 44, 0.18);
  }
  .tpl-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
  }
  .tpl-icon-box {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--card-solid);
    border: 1.5px solid var(--line-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  }
  .template-card.selected .tpl-icon-box {
    border-color: var(--olive);
    background: rgba(94, 107, 44, 0.1);
  }
  .tpl-titles {
    flex: 1;
  }
  .tpl-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 2px;
  }
  .tpl-name {
    font-size: 1rem;
    font-weight: 800;
    color: var(--text);
    margin: 0;
  }
  .active-sparkle-pill {
    background: linear-gradient(135deg, #c59b27, #8c7322);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    box-shadow: 0 2px 6px rgba(197, 155, 39, 0.3);
  }
  .tpl-subtitle {
    font-size: 0.78rem;
    color: var(--olive);
    font-weight: 700;
  }
  .tpl-desc {
    font-size: 0.82rem;
    color: var(--text-muted);
    line-height: 1.55;
    margin: 0 0 12px;
  }
  .tpl-meta-strip {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .tpl-tag {
    display: inline-block;
    align-self: flex-start;
    font-size: 0.72rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: var(--radius-full);
  }
  .tpl-tag.badge-top {
    background: rgba(94, 107, 44, 0.12);
    color: var(--olive);
    border: 1px solid rgba(94, 107, 44, 0.25);
  }
  .tpl-tag.badge-front {
    background: rgba(197, 155, 39, 0.12);
    color: #8c7322;
    border: 1px solid rgba(197, 155, 39, 0.25);
  }
  .tpl-suitable {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
  }
  .tpl-action-row {
    margin-top: auto;
  }
  .btn-tpl-select {
    width: 100%;
    padding: 8px 14px;
    font-size: 0.86rem;
    font-weight: 800;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--line-strong);
    background: var(--card-solid);
    color: var(--text);
    cursor: pointer;
    transition: all 0.18s;
  }
  .btn-tpl-select:hover {
    border-color: var(--olive);
    background: rgba(94, 107, 44, 0.08);
    color: var(--olive);
  }
  .btn-tpl-select.active {
    background: var(--olive);
    color: #fff;
    border-color: var(--olive);
    box-shadow: 0 2px 8px rgba(94, 107, 44, 0.3);
  }

  /* أدوات الانسجام والذكاء الاصطناعي داخل لوحة القوالب */
  .ai-harmony-box {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 16px 18px;
    margin-bottom: 20px;
  }
  .ai-harmony-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    gap: 12px;
    flex-wrap: wrap;
  }
  .harmony-title {
    font-size: 0.96rem;
    font-weight: 800;
    color: var(--text);
    margin: 0 0 3px;
  }
  .harmony-sub {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin: 0;
  }
  .btn-rebalance {
    font-weight: 800;
    white-space: nowrap;
  }
  .template-prompt-addon {
    margin-top: 14px;
    margin-bottom: 0;
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

  /* تبويب محرر الوردة الفردية (تعديل وردة بوردة) فائق الرشاقة والصغر */
  .stem-inspector-box-compact {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 18px !important;
  }
  .single-stem-focus {
    border: 1.5px solid var(--olive);
    background: linear-gradient(180deg, rgba(94, 107, 44, 0.04) 0%, var(--card-solid) 100%);
    box-shadow: 0 4px 16px rgba(94, 107, 44, 0.15);
    margin-bottom: 20px;
  }
  .stem-inspector-mini-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
  }
  .mini-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mini-head-title {
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--text);
  }
  .head-actions-compact {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn-close-edit {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 800;
    cursor: pointer;
    color: var(--text-muted);
    transition: all 0.15s;
  }
  .btn-close-edit:hover {
    background: #c02741;
    color: #ffffff;
    border-color: #c02741;
  }
  .badge-hand-hint {
    background: rgba(94, 107, 44, 0.12);
    color: var(--olive);
    font-size: 0.72rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    border: 1px solid rgba(94, 107, 44, 0.25);
  }
  .hint-no-stem-box {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    margin-bottom: 20px;
    background: rgba(94, 107, 44, 0.05);
    border: 1.5px dashed var(--olive);
    border-radius: var(--radius-md);
  }
  .hint-icon {
    font-size: 1.8rem;
  }
  .hint-title {
    margin: 0 0 4px;
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--olive);
  }
  .hint-desc {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  /* جسم المحرر المصغر */
  .stem-editor-body-compact {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .stem-detail-strip-compact {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 6px 12px;
  }
  .stem-left-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .stem-thumb-mini {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .stem-thumb-img-mini {
    width: 22px;
    height: 22px;
    object-fit: contain;
  }
  .stem-name-compact {
    font-size: 0.86rem;
    font-weight: 800;
    color: var(--text);
  }
  .tag-price-mini {
    font-size: 0.72rem;
    font-weight: 800;
    color: #b45309;
    background: rgba(180, 83, 9, 0.1);
    padding: 1px 6px;
    border-radius: 4px;
  }
  .tag-sec-mini {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-weight: 600;
  }
  .stem-mini-actions {
    display: flex;
    gap: 5px;
  }
  .btn-icon-action {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 0.74rem;
    font-weight: 700;
    cursor: pointer;
    color: var(--text);
    transition: all 0.15s;
  }
  .btn-icon-action:hover {
    border-color: var(--olive);
    color: var(--olive);
  }
  .btn-icon-del {
    color: #c02741;
    background: rgba(192, 39, 65, 0.06);
    border-color: rgba(192, 39, 65, 0.2);
  }
  .btn-icon-del:hover {
    background: #c02741;
    color: #ffffff;
  }

  /* صفوف الأزرار المقطعية المدمجة */
  .compact-field-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .compact-label {
    font-size: 0.78rem;
    font-weight: 800;
    color: var(--text);
    white-space: nowrap;
    min-width: 62px;
  }
  .compact-label-with-reset {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 62px;
    white-space: nowrap;
  }
  .btn-reset-mini {
    background: none;
    border: none;
    color: var(--olive);
    font-size: 0.7rem;
    font-weight: 800;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }
  .angles-segmented-compact {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    flex: 1;
  }
  .sections-segmented-compact {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
    flex: 1;
  }
  .seg-btn-compact {
    padding: 6px 4px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 4px;
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
    text-align: center;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .seg-btn-compact:hover {
    border-color: var(--olive);
    background: rgba(94, 107, 44, 0.06);
  }
  .seg-btn-compact.active {
    background: var(--olive);
    color: #ffffff;
    border-color: var(--olive);
    box-shadow: 0 1px 4px rgba(94, 107, 44, 0.25);
  }

  /* منزلقات مصغرة */
  .compact-sliders-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .mini-slider-cell {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 10px;
  }
  .mini-slider-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.74rem;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .val-pill {
    color: var(--olive);
    background: rgba(94, 107, 44, 0.12);
    padding: 0 5px;
    border-radius: 3px;
    font-size: 0.72rem;
  }
  .slider-ultra-compact {
    width: 100%;
    accent-color: var(--olive);
    height: 4px;
    cursor: pointer;
  }

  /* تذييل الطبقات */
  .compact-layer-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 6px 10px;
  }
  .layer-btns-mini {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .layer-lbl-mini {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-muted);
  }
  .btn-layer-mini {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    padding: 3px 7px;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-layer-mini:hover {
    border-color: var(--olive);
    color: var(--olive);
  }
  .direct-hand-tip {
    font-size: 0.7rem;
    color: var(--olive);
    font-weight: 700;
  }
  .empty-stems-state-compact {
    text-align: center;
    padding: 20px 10px;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  /* شارة رقم الساق على المسرح */
  .stem-number-badge {
    position: absolute;
    top: -10px;
    right: -10px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--olive);
    color: #ffffff;
    font-size: 0.72rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    border: 1.5px solid #ffffff;
    pointer-events: none;
    transition: transform 0.2s, background 0.2s;
  }
  .stem-number-badge.active {
    background: #c59b27;
    transform: scale(1.2);
    box-shadow: 0 0 0 2px #ffffff, 0 3px 8px rgba(0,0,0,0.3);
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
  .preview-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }
  .scene-mode-badge {
    font-size: 0.72rem;
    font-weight: 800;
    padding: 2px 10px;
    border-radius: var(--radius-full);
    background: rgba(94, 107, 44, 0.1);
    color: var(--olive);
    border: 1px solid rgba(94, 107, 44, 0.2);
    transition: all 0.3s ease;
  }
  .scene-mode-badge.top {
    background: #2d3812;
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.25);
    box-shadow: 0 2px 10px rgba(45, 56, 18, 0.35);
  }
  .scene-mode-badge.front {
    background: rgba(197, 155, 39, 0.14);
    color: #855d10;
    border-color: rgba(197, 155, 39, 0.35);
  }
  .preview-title {
    margin: 0;
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
    align-items: center;
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
  .stage-tool-btn.view-toggle-btn {
    width: auto;
    padding: 0 12px;
    border-radius: var(--radius-full);
    font-size: 0.8rem;
    font-weight: 800;
    white-space: nowrap;
    gap: 4px;
    border: 1.5px solid var(--line-strong);
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
    height: 460px;
    background: radial-gradient(circle at 50% 40%, #ffffff 0%, #f7f4ee 70%, #ede7dc 100%);
    border-radius: var(--radius-lg);
    position: relative;
    overflow: hidden;
    margin-bottom: 20px;
    border: 1.5px solid var(--line-strong);
    box-shadow: 0 8px 30px rgba(0,0,0,0.06);
    user-select: none;
    touch-action: none;
    transition: background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease;
  }
  .stage-viewport.is-top-view {
    background-color: #f7f4ee;
    background-image: 
      radial-gradient(circle at 50% 50%, #ffffff 0%, #faf8f4 45%, #eee7da 80%, #dfd6c6 100%);
    border-color: rgba(197, 155, 39, 0.45);
    box-shadow: inset 0 2px 18px rgba(94, 107, 44, 0.12), 0 10px 32px rgba(0,0,0,0.08);
  }
  .stage-viewport.is-front-view {
    background-image: radial-gradient(circle at 50% 36%, #ffffff 0%, #f7f4ee 65%, #ede6da 100%);
  }
  .stage-viewport.with-grid {
    background-image: 
      linear-gradient(to right, rgba(94, 107, 44, 0.08) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(94, 107, 44, 0.08) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  /* طوق التاج النجمي المسنن في المشهد العلوي */
  .wrap-top-svg {
    position: absolute;
    width: 440px;
    height: 440px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 2;
    transition: all 0.4s ease;
  }
  .wrap-top-depth-ring {
    position: absolute;
    width: 236px;
    height: 236px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.45);
    pointer-events: none;
    z-index: 15;
  }
  .radial-guide-grid {
    position: absolute;
    width: 440px;
    height: 440px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 3;
  }

  /* تكبير وتألق الورود في المشهد العلوي */
  .stage-viewport.is-top-view .stem-canvas-node {
    width: 68px;
    height: 68px;
  }
  .stage-viewport.is-top-view .stem-img {
    filter: drop-shadow(0 6px 14px rgba(0,0,0,0.24));
    transition: transform 0.2s ease, filter 0.2s ease;
  }
  .stage-viewport.is-top-view .stem-canvas-node:hover .stem-img {
    transform: scale(1.08);
    filter: drop-shadow(0 14px 28px rgba(0,0,0,0.36));
  }

  /* تألق الورود الحقيقية في المشهد الأمامي */
  .stage-viewport.is-front-view .stem-canvas-node {
    width: 70px;
    height: 70px;
  }
  .stage-viewport.is-front-view .stem-img {
    filter: drop-shadow(0 8px 18px rgba(0,0,0,0.32));
    transition: transform 0.2s ease, filter 0.2s ease;
  }
  .stage-viewport.is-front-view .stem-canvas-node:hover .stem-img {
    transform: scale(1.1);
    filter: drop-shadow(0 14px 28px rgba(0,0,0,0.48));
  }

  /* طاقية التخرج الملكية في باقة الاحتفالات */
  .grad-cap-overlay {
    position: absolute;
    width: 94px;
    height: 76px;
    left: calc(50% + 22px);
    top: calc(50% - 138px);
    z-index: 70;
    pointer-events: none;
    transform: rotate(12deg);
    filter: drop-shadow(0 6px 14px rgba(0,0,0,0.38));
  }
  .grad-cap-svg {
    width: 100%;
    height: 100%;
  }

  .stems-layer.top-spinning {
    animation: spinTopBouquet 16s linear infinite;
    transform-origin: 50% 50%;
  }
  @keyframes spinTopBouquet {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .stage-viewport.rotating:not(.is-top-view) .stems-layer,
  .stage-viewport.rotating .wrap-front-svg,
  .stage-viewport.rotating .ribbon-wax-wrap {
    animation: gentleSway 8s infinite ease-in-out;
  }
  @keyframes gentleSway {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(4deg); }
  }

  /* 1. أجنحة ورق التغليف الكوري الملكي الفاخر */
  .wrap-back-svg {
    position: absolute;
    width: 380px;
    height: 450px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 1;
    filter: drop-shadow(0 14px 30px rgba(0,0,0,0.16));
    transition: all 0.4s ease;
  }

  /* 2. طبقة السيقان الحية */
  .stems-layer {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: auto;
    touch-action: none;
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
    width: 68px;
    height: 68px;
    cursor: grab;
    transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .stem-canvas-node:active,
  .stem-canvas-node.dragging {
    cursor: grabbing !important;
    transition: none !important;
  }
  .stem-canvas-node.dragging {
    filter: drop-shadow(0 16px 32px rgba(0,0,0,0.4)) !important;
  }
  .stem-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.18));
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
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

  /* شريط التعديل باليد المباشر فوق اللوحة الحية */
  .canvas-hand-indicator {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(45, 56, 18, 0.88);
    backdrop-filter: blur(6px);
    color: #ffffff;
    padding: 5px 14px;
    border-radius: var(--radius-full);
    font-size: 0.74rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 120;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.22);
    border: 1px solid rgba(255,255,255,0.25);
    white-space: nowrap;
  }
  .hand-icon {
    font-size: 0.85rem;
  }
  .canvas-floating-toolbar {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    border: 1.5px solid var(--olive);
    border-radius: var(--radius-full);
    padding: 4px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 120;
    box-shadow: 0 6px 20px rgba(94, 107, 44, 0.28);
    white-space: nowrap;
  }
  .floating-stem-title {
    font-size: 0.76rem;
    font-weight: 800;
    color: var(--olive);
  }
  .floating-btns-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .floating-btn {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-full);
    padding: 3px 8px;
    font-size: 0.74rem;
    font-weight: 800;
    color: var(--text);
    cursor: pointer;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .floating-btn:hover {
    background: var(--olive);
    color: #ffffff;
    border-color: var(--olive);
  }
  .floating-btn.floating-btn-del:hover {
    background: #c02741;
    border-color: #c02741;
    color: #ffffff;
  }

  /* 3. ياقة الكشكش ومقدمة ورق التغليف الملكي */
  .wrap-front-svg {
    position: absolute;
    width: 340px;
    height: 250px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -15px);
    pointer-events: none;
    z-index: 80;
    filter: drop-shadow(0 10px 22px rgba(0,0,0,0.18));
    transition: all 0.4s ease;
  }

  /* 4. شريط الساتان والختم الشمعي */
  .ribbon-wax-wrap {
    position: absolute;
    width: 140px;
    height: 90px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, 82px);
    z-index: 95;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    transition: all 0.4s ease;
  }
  .satin-ribbon-band {
    width: 130px;
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

  @media (max-width: 600px) {
    .angles-segmented-compact {
      grid-template-columns: repeat(2, 1fr);
    }
    .sections-segmented-compact {
      grid-template-columns: repeat(3, 1fr);
    }
    .compact-sliders-row {
      grid-template-columns: 1fr;
      gap: 6px;
    }
    .compact-field-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .angles-segmented-compact,
    .sections-segmented-compact {
      width: 100%;
    }
    .stem-detail-strip-compact {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .stem-mini-actions {
      width: 100%;
      justify-content: flex-end;
    }
    .canvas-floating-toolbar {
      padding: 3px 6px;
      gap: 4px;
      max-width: 96%;
      overflow-x: auto;
    }
    .floating-stem-title {
      display: none;
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

  .tab-btn-chat {
    background: linear-gradient(135deg, rgba(94, 107, 44, 0.15), rgba(197, 155, 39, 0.2)) !important;
    color: var(--olive) !important;
    border: 1.5px solid var(--olive) !important;
    position: relative;
    font-weight: 800 !important;
  }
  .tab-btn-chat.active {
    background: var(--olive) !important;
    color: #ffffff !important;
  }
  .tab-messages-body {
    height: 320px;
  }

  /* زر الشات العائم في أسفل الشاشة */
  .floating-chat-trigger {
    position: fixed;
    bottom: 24px;
    left: 24px;
    z-index: 999;
    background: linear-gradient(135deg, var(--olive), #3a471b);
    color: #ffffff;
    border: 2px solid #ffffff;
    border-radius: var(--radius-full);
    padding: 12px 22px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 8px 24px rgba(94, 107, 44, 0.45);
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 800;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .floating-chat-trigger:hover {
    transform: translateY(-4px) scale(1.03);
    box-shadow: 0 12px 30px rgba(94, 107, 44, 0.6);
  }
  .float-icon {
    font-size: 1.3rem;
  }
  .float-status-dot {
    width: 10px;
    height: 10px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 6px #10b981;
  }

  .btn-design-quick {
    background: linear-gradient(135deg, rgba(94, 107, 44, 0.12) 0%, rgba(212, 175, 55, 0.18) 100%) !important;
    border-color: #5e6b2c !important;
    color: #465020 !important;
    font-weight: 800 !important;
  }
  .btn-design-quick:hover {
    background: #5e6b2c !important;
    color: #ffffff !important;
  }

  /* بطاقة عرض تصميم الباقة المقترح من الذكاء الاصطناعي */
  .ai-bouquet-proposal-card {
    margin-top: 14px;
    background: #ffffff;
    border: 2px solid #5e6b2c;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 8px 24px rgba(94, 107, 44, 0.15);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .proposal-head {
    border-bottom: 1px solid #ebd9c8;
    padding-bottom: 8px;
  }

  .proposal-tag {
    display: inline-block;
    background: #eef2dc;
    color: #5e6b2c;
    font-size: 0.72rem;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 999px;
    margin-bottom: 4px;
  }

  .proposal-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #2b2b28;
    margin: 4px 0 0;
  }

  .proposal-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.85rem;
  }

  .proposal-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #555;
  }

  .proposal-row b {
    color: #2b2b28;
  }

  .price-val {
    color: #b45309 !important;
    font-size: 1.05rem;
  }

  .proposal-stems-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .stem-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #fdfaf4;
    border: 1px solid #d4c5b3;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #465020;
  }

  .chip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .sec-label {
    font-size: 0.68rem;
    color: #71716e;
    font-weight: normal;
  }

  .btn-apply-design {
    background: linear-gradient(135deg, #5e6b2c 0%, #465020 100%);
    color: #ffffff;
    border: none;
    padding: 10px 18px;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(94, 107, 44, 0.3);
    transition: all 0.2s;
    text-align: center;
    width: 100%;
  }

  .btn-apply-design:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(94, 107, 44, 0.45);
    background: #465020;
  }

  /* =========================================================================
     Florist Catalog Creator Banner Styles
     ========================================================================= */
  .badge-florist {
    background: #059669;
    color: #fff;
  }

  .action-pill-mode {
    background: #fdf2f8;
    color: #be123c;
    border: 1.5px solid #fbcfe8;
    padding: 8px 18px;
    border-radius: var(--radius-full);
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .action-pill-mode:hover, .action-pill-mode.active-mode {
    background: #be123c;
    color: #fff;
    border-color: #be123c;
  }

  .florist-catalog-creator-banner {
    background: linear-gradient(135deg, #ffffff 0%, #fdf8f6 100%);
    border: 2px solid #059669;
    border-radius: var(--radius-lg);
    padding: 24px 28px;
    margin-bottom: 30px;
    box-shadow: 0 10px 25px rgba(5, 150, 105, 0.08);
  }

  .f-banner-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid rgba(5, 150, 105, 0.15);
    padding-bottom: 16px;
    margin-bottom: 20px;
    gap: 16px;
    flex-wrap: wrap;
  }

  .f-live-indicator {
    display: inline-block;
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .f-banner-heading {
    font-size: 1.45rem;
    font-weight: 800;
    color: var(--text);
    margin: 4px 0;
  }

  .f-banner-sub {
    font-size: 0.92rem;
    color: var(--text-muted);
    margin: 0;
  }

  .f-alert-box {
    padding: 12px 18px;
    border-radius: var(--radius-sm);
    font-weight: 700;
    margin-bottom: 16px;
    font-size: 0.95rem;
  }
  .f-alert-box.error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #f87171;
  }
  .f-alert-box.success {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #86efac;
  }

  .f-catalog-fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-bottom: 22px;
  }

  .f-catalog-fields-grid .full-row {
    grid-column: 1 / -1;
  }

  .f-field label {
    display: block;
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 6px;
  }

  .f-price-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .f-price-input-wrapper .price-input {
    padding-left: 45px;
    font-weight: 800;
    font-size: 1.1rem;
    color: var(--primary);
  }
  .f-price-input-wrapper .currency-tag {
    position: absolute;
    left: 14px;
    font-size: 0.85rem;
    font-weight: 800;
    color: var(--text-muted);
  }

  .f-banner-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: var(--radius-md);
    padding: 14px 20px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .f-financial-metrics {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  }

  .metric-chip {
    display: flex;
    flex-direction: column;
    font-size: 0.82rem;
  }
  .metric-chip .m-lbl {
    color: var(--text-muted);
  }
  .metric-chip .m-val {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--text);
  }
  .metric-chip.highlight .m-val.profit {
    color: #059669;
  }

  .btn-publish-now {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    color: #fff;
    padding: 12px 26px;
    border-radius: var(--radius-full);
    font-weight: 800;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
    transition: all 0.2s;
  }
  .btn-publish-now:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);
  }

  .florist-cta-publish {
    background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
    border-color: #059669 !important;
  }

  @media (max-width: 768px) {
    .floating-chat-trigger {
      bottom: 16px;
      left: 16px;
      padding: 10px 16px;
      font-size: 0.85rem;
    }
  }
</style>
