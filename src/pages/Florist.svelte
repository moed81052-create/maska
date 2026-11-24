<script>
  import { onMount } from 'svelte';
  import { auth, isAuthenticated, isFlorist, isAdmin } from '../stores/auth.js';
  import { router } from '../stores/router.js';
  import { api } from '../lib/api.js';

  // التبويب النشط
  let activeTab = 'orders'; // 'orders' | 'new_bouquet' | 'catalog'

  // الطلبات وحالاتها
  let orders = [];
  let loadingOrders = true;
  let orderFilter = 'my_active'; // 'my_active' | 'preparing' | 'confirmed' | 'delivered' | 'all'
  let searchQuery = '';
  let expandedOrderId = null; // الطلب المفتوح تفاصيله

  // المخزون وقائمة الورود لتصميم الباقات
  let flowerInventory = [];
  let loadingInventory = false;

  // الباقات الحالية في الكتالوج
  let catalogBouquets = [];
  let loadingBouquets = false;

  // رسائل التنبيه والنجاح
  let toastMessage = '';
  let toastType = 'success'; // 'success' | 'error'

  function showToast(msg, type = 'success') {
    toastMessage = msg;
    toastType = type;
    setTimeout(() => {
      toastMessage = '';
    }, 4000);
  }

  onMount(async () => {
    await loadFloristData();
  });

  let lastLoadedFloristId = null;
  $: if ($auth?.id && lastLoadedFloristId !== $auth.id) {
    lastLoadedFloristId = $auth.id;
    loadFloristData();
  }

  async function loadFloristData() {
    const floristId = $auth?.id || null;
    if (!floristId) {
      orders = [];
      loadingOrders = false;
      return;
    }

    loadingOrders = true;
    try {
      const res = await api.getFloristOrders(floristId);
      if (res && res.data) {
        orders = res.data;
        // فتح أول طلب قيد التنسيق افتراضياً
        const firstActive = orders.find(o => o.status === 'preparing' || o.status === 'confirmed');
        if (firstActive) {
          expandedOrderId = firstActive.id || firstActive.order_number;
        }
      }
    } catch (err) {
      console.error('Failed to load florist orders:', err);
      showToast('تعذر تحميل طلبات المنسقة: ' + err.message, 'error');
    } finally {
      loadingOrders = false;
    }

    loadInventoryAndCatalog();
  }

  async function loadInventoryAndCatalog() {
    loadingInventory = true;
    try {
      const [invRes, bRes, packRes] = await Promise.allSettled([
        api.getFlowerStock(),
        api.getBouquets(),
        api.getPackaging()
      ]);
      if (invRes.status === 'fulfilled' && invRes.value.data) {
        flowerInventory = invRes.value.data;
      }
      if (bRes.status === 'fulfilled' && bRes.value.data) {
        catalogBouquets = bRes.value.data;
      }
      if (packRes.status === 'fulfilled' && packRes.value) {
        if (packRes.value.wraps && packRes.value.wraps.length > 0) {
          wrapOptions = packRes.value.wraps.map(w => w.name_ar);
        }
        if (packRes.value.ribbons && packRes.value.ribbons.length > 0) {
          ribbonOptions = packRes.value.ribbons.map(r => r.name_ar);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      loadingInventory = false;
    }
  }

  // تحديث حالة الطلب من قبل المنسقة
  let actionLoading = false;
  async function handleStatusUpdate(orderNumber, newStatus, comment = '') {
    actionLoading = true;
    try {
      const floristName = $auth?.full_name || 'فاطمة الورفلي';
      const defaultComment = newStatus === 'out_for_delivery' 
        ? `تم اكتمال التنسيق الفني للباقة وختم كرت الإهداء بواسطة المنسقة (${floristName}) وتسليمها للكابتن للتوصيل`
        : `بدأت المنسقة (${floristName}) تنسيق وتجهيز الباقة في الأتيليه`;
        
      await api.updateOrderStatus(orderNumber, newStatus, comment || defaultComment, $auth?.id);
      
      // تحديث الحالة محلياً
      orders = orders.map(o => o.order_number === orderNumber ? { ...o, status: newStatus } : o);

      if (newStatus === 'out_for_delivery') {
        showToast(`تم إنجاز تنسيق الباقة بنجاح وتحويل الطلب #${orderNumber} إلى "قيد التوصيل" 🚗!`);
      } else if (newStatus === 'preparing') {
        showToast(`بدأ تنسيق وتجهيز الطلب #${orderNumber} في الأتيليه 🌸`);
      }
    } catch (err) {
      showToast('فشل تحديث الحالة: ' + err.message, 'error');
    } finally {
      actionLoading = false;
    }
  }

  // حسابات إحصائيات المنسقة
  $: preparingCount = orders.filter(o => o.status === 'preparing').length;
  $: confirmedCount = orders.filter(o => o.status === 'confirmed').length;
  $: deliveredCount = orders.filter(o => o.status === 'out_for_delivery' || o.status === 'delivered').length;
  $: totalCount = orders.length;

  // تصفية الطلبات
  $: filteredOrders = orders.filter(o => {
    if (orderFilter === 'my_active') {
      if (o.status !== 'preparing' && o.status !== 'confirmed') return false;
    } else if (orderFilter === 'preparing') {
      if (o.status !== 'preparing') return false;
    } else if (orderFilter === 'confirmed') {
      if (o.status !== 'confirmed') return false;
    } else if (orderFilter === 'delivered') {
      if (o.status !== 'out_for_delivery' && o.status !== 'delivered') return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (o.order_number && String(o.order_number).toLowerCase().includes(q)) ||
      (o.recipient_name && o.recipient_name.toLowerCase().includes(q)) ||
      (o.recipient_phone && o.recipient_phone.toLowerCase().includes(q)) ||
      (o.delivery_city && o.delivery_city.toLowerCase().includes(q)) ||
      (o.delivery_zone && o.delivery_zone.toLowerCase().includes(q))
    );
  });

  // استخراج وتنسيق تعليمات توزيع الورود ومواقعها في الباقة
  function getFloralArrangementBlueprint(order) {
    const items = order.items || [];
    if (items.length === 0) {
      return {
        styleName: 'ملكي متدرج فاخر',
        wrapType: 'ورق كرافت إيطالي فاخر',
        ribbonColor: 'شريط ساتان وردي مذهب',
        waxSealText: order.customer_notes || '',
        sealColor: 'أحمر قرمزي ملكي',
        sections: {
          top: [{ name: 'جوري طبيعي فاخر', count: 3, color: 'أحمر', instruction: 'قص بزاوية 45° بطول 45-50 سم، تثبيت عمودي قائم 90° كقمة هرمية' }],
          center: [{ name: 'بيوني وأوركيد ملكي', count: 5, color: 'وردي', instruction: 'بطول 35-40 سم، تثبيت بزاوية ميلان 15° تشكل قلب الباقة الأكثر نضارة' }],
          bottom: [{ name: 'بيبي روز ناعم', count: 4, color: 'عاجي', instruction: 'بطول 25-30 سم، تثبيت مائل للخارج 40° لملء قاعدة التغليف وحمايتها' }],
          sides: [{ name: 'جيبسوفيلا وأوكالبتوس', count: 3, color: 'أخضر/أبيض', instruction: 'توزيع حلزوني حول الأطراف لمنح الباقة عمقاً طبيعياً شاعرياً' }]
        }
      };
    }

    const firstItem = items[0];
    const wrapType = firstItem.wrap_type || 'ورق كرافت إيطالي فاخر';
    const ribbonColor = firstItem.ribbon_color || 'شريط ساتان زيتي مسكة';
    const waxSealText = firstItem.wax_seal_text || order.customer_notes || '';
    const sealColor = firstItem.seal_color || 'أحمر قرمزي ملكي';

    let stemsList = [];

    // 1. محاولة قراءة flower_composition_json
    if (firstItem.flower_composition_json) {
      try {
        const parsed = JSON.parse(firstItem.flower_composition_json);
        if (Array.isArray(parsed)) {
          stemsList = parsed;
        } else if (parsed && Array.isArray(parsed.flowers)) {
          stemsList = parsed.flowers;
        }
      } catch (e) {}
    }

    // 2. إذا لم توجد، محاولة قراءة recipe_flowers
    if (stemsList.length === 0 && firstItem.recipe_flowers && firstItem.recipe_flowers.length > 0) {
      stemsList = firstItem.recipe_flowers.map(rf => ({
        name: rf.flower_name,
        quantity: rf.quantity_stems,
        color: rf.color,
        section: rf.notes?.includes('top') || rf.notes?.includes('قمة') ? 'top' :
                 rf.notes?.includes('center') || rf.notes?.includes('وسط') ? 'center' :
                 rf.notes?.includes('bottom') || rf.notes?.includes('قاعدة') ? 'bottom' : 'sides'
      }));
    }

    // تقسيم السيقان إلى الأقسام الأربعة
    const sections = {
      top: [],
      center: [],
      bottom: [],
      sides: []
    };

    if (stemsList.length > 0) {
      stemsList.forEach((s, idx) => {
        const stemName = s.name || s.name_ar || s.flowerName || 'ساق زهور مسكة';
        const count = s.quantity || s.qty || s.quantity_stems || s.count || 2;
        const color = s.color || 'طبيعي';

        let targetSec = s.section || 'center';
        if (targetSec === 'left' || targetSec === 'right') targetSec = 'sides';

        // توزيع تلقائي متناسق إذا لم يتحدد القسم
        if (!s.section) {
          if (idx === 0) targetSec = 'center';
          else if (idx === 1) targetSec = 'top';
          else if (idx === 2) targetSec = 'bottom';
          else targetSec = 'sides';
        }

        let instruction = '';
        if (targetSec === 'top') {
          instruction = 'أطول السيقان (45-50 سم)، تُقص بزاوية 45° وتُثبت عمودياً 90° كقمة هرمية بارزة';
        } else if (targetSec === 'center') {
          instruction = 'سيقان بطول 35-40 سم بزاوية 15°-20°، وتكون زهور القلب الأكثر تفتحاً وإشراقاً';
        } else if (targetSec === 'bottom') {
          instruction = 'سيقان بطول 25-30 سم مائلة للخارج 40° لملء قاعدة التغليف وتثبيت الهيكل';
        } else {
          instruction = 'توزيع حلزوني رقيق غير متناظر بين الفراغات لإعطاء عمق ضبابي وإخفاء أشرطة الربط';
        }

        if (sections[targetSec]) {
          sections[targetSec].push({ name: stemName, count, color, instruction });
        } else {
          sections.center.push({ name: stemName, count, color, instruction });
        }
      });
    }

    // إذا كان أي قسم فارغاً، نضع له إرشادات استرشادية
    if (sections.top.length === 0) {
      sections.top.push({ name: 'سيقان الجوري / الزنابق الطويلة', count: 2, color: 'المعتمد بالطلب', instruction: 'تثبيت في القمة والأعلى لضبط ارتفاع الباقة' });
    }
    if (sections.center.length === 0) {
      sections.center.push({ name: 'أزهار البيوني أو الأوركيد', count: 3, color: 'المعتمد بالطلب', instruction: 'تثبيت في وسط ومركز الباقة كبؤرة جذب بصرية' });
    }
    if (sections.bottom.length === 0) {
      sections.bottom.push({ name: 'بيبي روز أو زهور القاعدة', count: 3, color: 'المعتمد بالطلب', instruction: 'تثبيت في أسفل وقاعدة الباقة لتأمين التدرج' });
    }
    if (sections.sides.length === 0) {
      sections.sides.push({ name: 'فروع الجيبسوفيلا أو الكينا', count: 2, color: 'أخضر/أبيض', instruction: 'نشر على الأطراف لإعطاء امتلاء طبيعي' });
    }

    return {
      styleName: 'ملكي متدرج فاخر',
      wrapType,
      ribbonColor,
      waxSealText,
      sealColor,
      sections
    };
  }

  // =========================================================================
  // عارض الزوايا الأربع الفني للباقة للمنسقة (4-Angle Bouquet Atelier Inspector)
  // =========================================================================
  let itemActiveAngles = {};
  function getItemAngle(itemKey) {
    return itemActiveAngles[itemKey] || 'front';
  }
  function setItemAngle(itemKey, angle) {
    itemActiveAngles = { ...itemActiveAngles, [itemKey]: angle };
  }

  // تكبير ومعاينة الزوايا الأربع في نافذة فنية منبثقة
  let showAngleModal = false;
  let activeModalBouquet = null;
  function openAngleModal(itm, blueprint, order) {
    activeModalBouquet = {
      itm,
      blueprint,
      order,
      wrapColors: getWrapColor(itm.wrap_type || blueprint.wrapType),
      ribbonColor: getRibbonColor(itm.ribbon_color || blueprint.ribbonColor)
    };
    showAngleModal = true;
  }
  function closeAngleModal() {
    showAngleModal = false;
    activeModalBouquet = null;
  }

  // استخراج ألوان التغليف
  function getWrapColor(wrapName = '') {
    const w = (wrapName || '').toLowerCase();
    if (w.includes('أسود') || w.includes('فاحم') || w.includes('سهرة') || w.includes('black')) {
      return { main: '#1e1e1e', dark: '#0a0a0a', border: '#d4af37', label: 'أسود سهرة فاحم' };
    }
    if (w.includes('عنابي') || w.includes('مخملي') || w.includes('burgundy')) {
      return { main: '#541525', dark: '#2d0a12', border: '#d4af37', label: 'عنابي مخملي ملكي' };
    }
    if (w.includes('زيتي') || w.includes('مسكة') || w.includes('olive') || w.includes('sage')) {
      return { main: '#4a5723', dark: '#2b3314', border: '#c59b27', label: 'زيتي مسكة ملكي' };
    }
    if (w.includes('وردي') || w.includes('blush') || w.includes('pink')) {
      return { main: '#e8b2be', dark: '#a86576', border: '#ffffff', label: 'وردي مخملي ناعم' };
    }
    if (w.includes('أبيض') || w.includes('شفاف') || w.includes('عاجي') || w.includes('white')) {
      return { main: '#f7f3ed', dark: '#d6cbc0', border: '#c59b27', label: 'أبيض عاجي شفاف' };
    }
    if (w.includes('كرافت') || w.includes('kraft')) {
      return { main: '#c8a882', dark: '#8a6e4d', border: '#5a4228', label: 'ورق كرافت إيطالي' };
    }
    return { main: '#3a481c', dark: '#1c240d', border: '#c59b27', label: wrapName || 'زيتي مسكة ملكي' };
  }

  // استخراج لون شريط الساتان
  function getRibbonColor(ribbonName = '') {
    const r = (ribbonName || '').toLowerCase();
    if (r.includes('ذهب') || r.includes('gold')) return '#c59b27';
    if (r.includes('أحمر') || r.includes('قرمزي') || r.includes('crimson') || r.includes('red')) return '#963547';
    if (r.includes('وردي') || r.includes('rose') || r.includes('pink')) return '#d4889c';
    if (r.includes('أبيض') || r.includes('حرير') || r.includes('عاجي') || r.includes('white')) return '#fcf8f6';
    if (r.includes('زيتي') || r.includes('sage') || r.includes('olive')) return '#5e6b2c';
    return '#c59b27';
  }

  // نصيحة وإرشاد المنسقة لكل زاوية
  function getAngleTip(angle) {
    switch (angle) {
      case 'front':
        return 'المشهد الأمامي: إبراز الزهور الأكبر والأبهى فوق ياقة الكشكش وتدرج الارتفاع وتناغم ألوان البتلات مع الفيونكة.';
      case 'back':
        return 'المشهد الخلفي: طي الأجنحة الورقية بانتظام وتغطية الساق، والتأكد من إحكام ربطة شريط الساتان الخلفية وبطاقة MASKA.';
      case 'side':
        return 'المشهد الجانبي: زاوية ميلان 35° إلى 45° للسيقان الخارجية لإعطاء عمق ثلاثي الأبعاد وبروز أوراق الأوكالبتوس الخضراء.';
      case 'top':
        return 'المشهد العلوي: التوزيع الكروي الدائري المتناسق للقبة وسد الفراغات بالكامل 360° لملء محيط الغلاف.';
      default:
        return '';
    }
  }

  // =========================================================================
  // بيانات تصميم باقة جديدة للكتالوج
  // =========================================================================
  let newBouquet = {
    title: '',
    occasion_tag: 'عيد ميلاد',
    style: 'royal',
    description: '',
    wrap_type: 'ورق كرافت إيطالي فاخر',
    ribbon_color: 'شريط ساتان وردي مذهب',
    image_svg_path: '/assets/bouquet-pink-spring.svg',
    custom_price: null,
    is_featured: 1,
    is_active: 1,
    selectedFlowers: []
  };

  const occasionOptions = [
    'عيد ميلاد',
    'زفاف وخطوبة',
    'تخرج ونجاح',
    'اعتذار ومودة',
    'شكر وامتنان',
    'مولود جديد',
    'مناسبة خاصة فاخرة'
  ];

  const styleOptions = [
    { key: 'royal', label: 'ملكي متدرج فاخر', desc: 'سيقان طويلة بالقمة، ورود مفتوحة بالوسط، وقاعدة ممتلئة' },
    { key: 'dome', label: 'دائري كلاسيكي متناسق', desc: 'توزيع كروي متناظر متناسق على أساس النسبة الذهبية' },
    { key: 'heart', label: 'رومانسي مدمج فاخر', desc: 'توزيع مترابط ومدمج بألوان الباستيل والأحمر' },
    { key: 'boho', label: 'بوهيمي عصري حر', desc: 'ارتفاعات غير متناظرة وأغصان طليقة تمنح إحساس الطبيعة البرية' }
  ];

  let wrapOptions = [
    'ورق كرافت إيطالي فاخر',
    'ورق زيتي مسكة ملكي',
    'ورق أسود سهرة فاحم',
    'ورق وردي مخملي ناعم',
    'ورق أبيض عاجي ملكي',
    'ورق شامبين ذهبي'
  ];

  let ribbonOptions = [
    'شريط ساتان وردي مذهب',
    'شريط ساتان زيتي مسكة',
    'شريط ساتان أحمر قرمزي',
    'شريط حرير عاجي',
    'شريط ذهب ملكي لامع'
  ];

  const bouquetImageOptions = [
    { path: '/assets/bouquet-pink-spring.svg', label: 'ربيع وردي كلاسيكي' },
    { path: '/assets/bouquet-royal.svg', label: 'ملكي قرمزي فاخر' },
    { path: '/assets/bouquet-ivory-elegance.svg', label: 'أناقة العاج والذهب' },
    { path: '/assets/bouquet-sage-whisper.svg', label: 'زيتي مسكة الهادئ' },
    { path: '/assets/bouquet.svg', label: 'باقة الأتيليه الشاملة' }
  ];

  function addFlowerToNewBouquet(flower) {
    const existing = newBouquet.selectedFlowers.find(f => f.flower_id === flower.id);
    if (existing) {
      existing.quantity_stems += 1;
      newBouquet.selectedFlowers = [...newBouquet.selectedFlowers];
    } else {
      newBouquet.selectedFlowers = [
        ...newBouquet.selectedFlowers,
        {
          flower_id: flower.id,
          name_ar: flower.name_ar,
          color: flower.color,
          unit_price: Number(flower.unit_price),
          quantity_stems: 3,
          section: 'center',
          image_front: flower.image_front || '/assets/flowers/clean/red-rose-front.svg',
          notes: 'في وسط ومركز الباقة'
        }
      ];
    }
  }

  function removeFlowerFromNewBouquet(index) {
    newBouquet.selectedFlowers.splice(index, 1);
    newBouquet.selectedFlowers = [...newBouquet.selectedFlowers];
  }

  // حساب تكلفة الباقة وسعر البيع المقترح
  $: calculatedFlowersCost = newBouquet.selectedFlowers.reduce(
    (sum, f) => sum + (f.quantity_stems * f.unit_price), 0
  );
  $: packagingCost = 15;
  $: totalCalculatedCost = calculatedFlowersCost + packagingCost;
  $: suggestedRetailPrice = Math.round(totalCalculatedCost * 1.35);
  $: finalRetailPrice = newBouquet.custom_price !== null && newBouquet.custom_price > 0 
    ? newBouquet.custom_price 
    : suggestedRetailPrice;

  let isSubmittingBouquet = false;
  async function handleCreateAndPublishBouquet() {
    if (!newBouquet.title.trim()) {
      showToast('الرجاء إدخال اسم الباقة الشاعري', 'error');
      return;
    }
    if (newBouquet.selectedFlowers.length === 0) {
      showToast('الرجاء اختيار وردة واحدة على الأقل من المخزون', 'error');
      return;
    }
    if (finalRetailPrice <= 0) {
      showToast('الرجاء تحديد سعر بيع صحيح للباقة', 'error');
      return;
    }

    isSubmittingBouquet = true;
    try {
      const payload = {
        title: newBouquet.title.trim(),
        price: finalRetailPrice,
        occasion_tag: newBouquet.occasion_tag,
        description: newBouquet.description.trim() || `تنسيق ${newBouquet.title} الأنيق بنمط ${styleOptions.find(s=>s.key===newBouquet.style)?.label} مع ${newBouquet.wrap_type} و${newBouquet.ribbon_color}.`,
        image_svg_path: newBouquet.image_svg_path,
        is_featured: newBouquet.is_featured ? 1 : 0,
        is_active: 1,
        flowers: newBouquet.selectedFlowers.map(f => ({
          flower_id: Number(f.flower_id),
          quantity_stems: Number(f.quantity_stems),
          notes: `الموضع: ${f.section === 'top' ? 'في الأعلى والقمة' : f.section === 'center' ? 'في الوسط والمركز' : f.section === 'bottom' ? 'في قاعدة الباقة' : 'على الأطراف والجوانب'}`
        }))
      };

      const res = await api.createBouquet(payload);
      if (res && res.success) {
        showToast(`تم نشر باقة "${newBouquet.title}" بنجاح في متجر وكتالوج مسكة 🌸!`);
        
        // إعادة تهيئة النموذج
        newBouquet = {
          title: '',
          occasion_tag: 'عيد ميلاد',
          style: 'royal',
          description: '',
          wrap_type: 'ورق كرافت إيطالي فاخر',
          ribbon_color: 'شريط ساتان وردي مذهب',
          image_svg_path: '/assets/bouquet-pink-spring.svg',
          custom_price: null,
          is_featured: 1,
          is_active: 1,
          selectedFlowers: []
        };

        await loadInventoryAndCatalog();
        setTimeout(() => {
          activeTab = 'catalog';
        }, 1200);
      }
    } catch (err) {
      showToast('فشل نشر الباقة: ' + err.message, 'error');
    } finally {
      isSubmittingBouquet = false;
    }
  }

  // تتبع خطوات التحقق للمنسقة
  let orderChecklist = {};
  function toggleChecklistItem(orderId, itemKey) {
    const key = `${orderId}_${itemKey}`;
    orderChecklist[key] = !orderChecklist[key];
    orderChecklist = { ...orderChecklist };
  }

  // =========================================================================
  // تصفية وبحث في كتالوج الباقات وإدارتها للمنسقة
  // =========================================================================
  let catalogSearchQuery = '';
  let catalogFilterTag = 'all';

  $: filteredCatalogBouquets = catalogBouquets.filter(b => {
    if (catalogFilterTag !== 'all' && b.occasion_tag !== catalogFilterTag) return false;
    if (!catalogSearchQuery.trim()) return true;
    const q = catalogSearchQuery.trim().toLowerCase();
    return (
      (b.title && b.title.toLowerCase().includes(q)) ||
      (b.description && b.description.toLowerCase().includes(q)) ||
      (b.occasion_tag && b.occasion_tag.toLowerCase().includes(q))
    );
  });

  // مودل تعديل الباقة وتوليفة الورود للمنسقة
  let editBouquetModal = {
    open: false,
    id: null,
    title: '',
    price: 0,
    occasion_tag: 'عيد ميلاد',
    description: '',
    image_svg_path: '/assets/bouquet-pink-spring.svg',
    flowers: [],
    saving: false,
    errorMsg: ''
  };

  function openEditBouquetModal(bouquet) {
    const flowersCopy = (bouquet.flowers || []).map(f => ({
      flower_id: f.flower_id,
      quantity_stems: Number(f.quantity_stems || 1),
      notes: f.notes || '',
      flower_name: f.flower_name,
      color: f.color,
      stem_price: Number(f.stem_price || 0)
    }));

    editBouquetModal = {
      open: true,
      id: bouquet.id,
      title: bouquet.title,
      price: Number(bouquet.price),
      occasion_tag: bouquet.occasion_tag || 'عام',
      description: bouquet.description || '',
      image_svg_path: bouquet.image_svg_path || '/assets/bouquet-pink-spring.svg',
      flowers: flowersCopy,
      saving: false,
      errorMsg: ''
    };
  }

  function addFlowerToEditModal(flower) {
    const existing = editBouquetModal.flowers.find(f => f.flower_id === flower.id);
    if (existing) {
      existing.quantity_stems += 1;
      editBouquetModal.flowers = [...editBouquetModal.flowers];
    } else {
      editBouquetModal.flowers = [
        ...editBouquetModal.flowers,
        {
          flower_id: flower.id,
          quantity_stems: 1,
          notes: 'موقع التنسيق: وسط',
          flower_name: flower.name_ar,
          color: flower.color,
          stem_price: Number(flower.unit_price)
        }
      ];
    }
  }

  function removeFlowerFromEditModal(index) {
    editBouquetModal.flowers.splice(index, 1);
    editBouquetModal.flowers = [...editBouquetModal.flowers];
  }

  $: editModalTotalStems = (editBouquetModal.flowers || []).reduce((acc, f) => acc + (Number(f.quantity_stems) || 0), 0);
  $: editModalTotalCost = (editBouquetModal.flowers || []).reduce((acc, f) => {
    const inv = flowerInventory.find(invF => invF.id === f.flower_id);
    const price = inv ? Number(inv.unit_price) : (Number(f.stem_price) || 0);
    return acc + (price * (Number(f.quantity_stems) || 0));
  }, 0);

  async function handleSaveEditedBouquet() {
    if (!editBouquetModal.title.trim()) {
      editBouquetModal.errorMsg = 'الرجاء كتابة اسم الباقة الشاعري';
      return;
    }
    if (!editBouquetModal.price || Number(editBouquetModal.price) <= 0) {
      editBouquetModal.errorMsg = 'سعر الباقة يجب أن يكون أكبر من صفر';
      return;
    }
    if (editBouquetModal.flowers.length === 0) {
      editBouquetModal.errorMsg = 'يجب أن تحتوي الباقة على صنف واحد من الورود على الأقل';
      return;
    }

    editBouquetModal.saving = true;
    editBouquetModal.errorMsg = '';

    try {
      const payload = {
        title: editBouquetModal.title.trim(),
        price: Number(editBouquetModal.price),
        occasion_tag: editBouquetModal.occasion_tag,
        description: editBouquetModal.description.trim(),
        image_svg_path: editBouquetModal.image_svg_path,
        flowers: editBouquetModal.flowers.map(f => ({
          flower_id: f.flower_id,
          quantity_stems: Number(f.quantity_stems),
          notes: f.notes
        }))
      };

      const res = await api.updateBouquet(editBouquetModal.id, payload);
      if (res && res.success) {
        showToast(`تم تحديث باقة "${payload.title}" وتوليفة ورودها بنجاح في الكتالوج 🌸`);
        editBouquetModal.open = false;
        // تحديث الكتالوج فوراً
        const bRes = await api.getBouquets();
        if (bRes && bRes.data) {
          catalogBouquets = bRes.data;
        }
      } else {
        editBouquetModal.errorMsg = res?.message || 'تعذر تحديث الباقة';
      }
    } catch (err) {
      editBouquetModal.errorMsg = err.message || 'حدث خطأ أثناء حفظ التعديلات';
    } finally {
      editBouquetModal.saving = false;
    }
  }
</script>

<div class="florist-atelier-page fade-in">
  <div class="container">

    <!-- رسائل التنبيه الفورية -->
    {#if toastMessage}
      <div class="florist-toast fade-in" class:error={toastType === 'error'}>
        <span>{toastMessage}</span>
      </div>
    {/if}

    <!-- ترويسة أتيليه المنسقة -->
    <div class="atelier-header">
      <div class="header-main-info">
        <div class="atelier-badge-pill">
          <span class="badge-icon">🌸</span>
          <span>أتيليه التنسيق الملكي اليدوي</span>
        </div>
        <h1 class="page-title">ورشة منسقة الزهور</h1>
        <p class="page-subtitle">
          استلام الطلبات الموجهة، مراجعة تعليمات ومواقع كل وردة، والتحويل الفوري لقيد التوصيل عند إنجاز الباقة.
        </p>
      </div>

      <!-- بطاقة هوية المنسقة والتبديل السريع -->
      <div class="florist-profile-card">
        <div class="f-avatar">🌸</div>
        <div class="f-details">
          <b class="f-name">{$auth?.full_name || 'فاطمة الورفلي'}</b>
          <span class="f-role">منسقة الزهور المعتمدة للأتيليه</span>
          <small class="f-atelier-status">● الأتيليه نشط — جاهزة للتنسيق</small>
        </div>
      </div>
    </div>

    <!-- شريط التبويبات الرئيسي -->
    <div class="atelier-tabs-nav">
      <button 
        type="button" 
        class="tab-btn" 
        class:active={activeTab === 'orders'}
        on:click={() => activeTab = 'orders'}
      >
        <span>🌸 الطلبات المسندة إليّ</span>
        <span class="tab-badge">{preparingCount + confirmedCount}</span>
      </button>

      <button 
        type="button" 
        class="tab-btn studio-direct-btn" 
        on:click={() => router.navigate('/studio', { mode: 'catalog_create' })}
      >
        <span>🎨 تصميم باقة جديدة في الاستوديو</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        class:active={activeTab === 'catalog'}
        on:click={() => activeTab = 'catalog'}
      >
        <span>📖 باقات الكتالوج المعتمدة ({catalogBouquets.length})</span>
      </button>
    </div>

    <!-- =====================================================================
         1. التبويب الأول: ورشة الطلبات الموجهة للمنسقة (الرئيسية)
         ===================================================================== -->
    {#if activeTab === 'orders'}
      <!-- إحصائيات سريعة للطلبات -->
      <div class="atelier-kpis-grid">
        <div class="kpi-card prep">
          <div class="kpi-icon">🌿</div>
          <div class="kpi-text">
            <span class="kpi-label">قيد التنسيق في الأتيليه</span>
            <b class="kpi-val">{preparingCount} باقة</b>
          </div>
        </div>

        <div class="kpi-card new">
          <div class="kpi-icon">⏳</div>
          <div class="kpi-text">
            <span class="kpi-label">طلبات جديدة بانتظار البدء</span>
            <b class="kpi-val">{confirmedCount} طلب</b>
          </div>
        </div>

        <div class="kpi-card out">
          <div class="kpi-icon">🚗</div>
          <div class="kpi-text">
            <span class="kpi-label">تم تسليمها للتوصيل</span>
            <b class="kpi-val">{deliveredCount} طلب</b>
          </div>
        </div>

        <div class="kpi-card all">
          <div class="kpi-icon">📦</div>
          <div class="kpi-text">
            <span class="kpi-label">إجمالي الطلبات</span>
            <b class="kpi-val">{totalCount} طلب</b>
          </div>
        </div>
      </div>

      <!-- شريط أدوات الفلاتر والبحث -->
      <div class="orders-toolbar card">
        <div class="filter-pills-wrap">
          <button 
            type="button" 
            class="filter-pill" 
            class:active={orderFilter === 'my_active'}
            on:click={() => orderFilter = 'my_active'}
          >
            الطلبات النشطة للتجهيز ({preparingCount + confirmedCount})
          </button>
          <button 
            type="button" 
            class="filter-pill prep" 
            class:active={orderFilter === 'preparing'}
            on:click={() => orderFilter = 'preparing'}
          >
            جاري التنسيق ({preparingCount})
          </button>
          <button 
            type="button" 
            class="filter-pill new" 
            class:active={orderFilter === 'confirmed'}
            on:click={() => orderFilter = 'confirmed'}
          >
            جديدة مؤكدة ({confirmedCount})
          </button>
          <button 
            type="button" 
            class="filter-pill out" 
            class:active={orderFilter === 'delivered'}
            on:click={() => orderFilter = 'delivered'}
          >
            قيد التوصيل / مسلمة ({deliveredCount})
          </button>
          <button 
            type="button" 
            class="filter-pill" 
            class:active={orderFilter === 'all'}
            on:click={() => orderFilter = 'all'}
          >
            كل الطلبات ({totalCount})
          </button>
        </div>

        <div class="search-wrap">
          <input 
            type="text" 
            class="search-input" 
            placeholder="بحث برقم الطلب، المستلم، أو المدينة..." 
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <button type="button" class="btn-clear-search" on:click={() => searchQuery = ''}>✕</button>
          {/if}
        </div>
      </div>

      <!-- قائمة الطلبات بالتفصيل -->
      <div class="orders-feed">
        {#if loadingOrders}
          <div class="loading-state card">
            <div class="spinner"></div>
            <p>جاري استرجاع طلبات المنسقة وتوليفات الورود من الأتيليه...</p>
          </div>
        {:else if filteredOrders.length === 0}
          <div class="empty-state card">
            <span class="empty-icon">🌸</span>
            <h3>لا توجد طلبات في هذه الفئة حالياً</h3>
            <p>جميع الباقات منسقة ومسلمة للسائقين بنجاح. يمكنك استعراض الكتالوج أو تصميم باقة جديدة!</p>
          </div>
        {:else}
          {#each filteredOrders as order (order.id || order.order_number)}
            {@const blueprint = getFloralArrangementBlueprint(order)}
            {@const isExpanded = expandedOrderId === (order.id || order.order_number)}

            <div class="card order-atelier-card fade-in" class:is-expanded={isExpanded}>
              <!-- رأس بطاقة الطلب -->
              <div 
                class="card-top-bar"
                on:click={() => expandedOrderId = isExpanded ? null : (order.id || order.order_number)}
              >
                <div class="top-meta-left">
                  <span class="order-badge">#{order.order_number}</span>
                  <div class="order-timing">
                    <b>{order.recipient_name}</b>
                    <small>📞 {order.recipient_phone} • 📍 {order.delivery_city} ({order.delivery_zone || 'المركز'})</small>
                  </div>
                </div>

                <div class="top-meta-right">
                  <div class="delivery-time-tag">
                    <span>🕒 الموعد:</span>
                    <b>{order.delivery_window || 'اليوم — فوري'}</b>
                  </div>

                  <span class="status-pill status-{order.status}">
                    {#if order.status === 'preparing'}
                      🌿 جاري التنسيق في الأتيليه
                    {:else if order.status === 'confirmed'}
                      ⏳ جديد بانتظار البدء
                    {:else if order.status === 'out_for_delivery'}
                      🚗 في الطريق للتوصيل
                    {:else if order.status === 'delivered'}
                      ✨ تم التسليم بنجاح
                    {:else}
                      {order.status}
                    {/if}
                  </span>

                  <button type="button" class="btn-toggle-expand">
                    {isExpanded ? '▲ طي التفاصيل' : '▼ عرض تعليمات الورد'}
                  </button>
                </div>
              </div>

              <!-- محتوى وتفاصيل الطلب الشاملة (يظهر عند التوسيع) -->
              {#if isExpanded}
                <div class="card-expanded-body fade-in">

                  <!-- استعراض باقات الطلب وصورها وتفاصيلها الفنية -->
                  <div class="order-bouquets-showcase card">
                    <div class="obs-header">
                      <div>
                        <h4 class="obs-title-head">💐 باقات وتنسيقات هذا الطلب ({order.items?.length || 1})</h4>
                        <p class="obs-subtitle">راجعي صورة النموذج المعتمد ومواصفات الباقة ووصفة الورود بدقة</p>
                      </div>
                      <span class="obs-badge-status">
                        {order.status === 'preparing' ? '🌸 قيد التنسيق في الأتيليه' : order.status === 'out_for_delivery' ? '🚗 مسلمة للكابتن' : '⏳ بانتظار البدء'}
                      </span>
                    </div>

                    <div class="obs-items-grid">
                      {#each (order.items || []) as itm, itemIdx}
                        {@const itemKey = `${order.id || order.order_number}_${itm.id || itemIdx}`}
                        {@const curAngle = getItemAngle(itemKey)}
                        {@const wrapColors = getWrapColor(itm.wrap_type || blueprint.wrapType)}
                        {@const ribbonHex = getRibbonColor(itm.ribbon_color || blueprint.ribbonColor)}
                        <div class="obs-item-card fade-in">
                          <!-- منظار الزوايا الأربع الفني لباقة الورد للمنسقة (من أمام، من خلف، من جنب، من أعلى) -->
                          <div class="obs-multi-angle-box">
                            <!-- 1. شريط أزرار تبديل الزوايا الأربع -->
                            <div class="angle-nav-bar">
                              <button 
                                type="button" 
                                class="angle-tab-btn" 
                                class:active={curAngle === 'front'} 
                                on:click={() => setItemAngle(itemKey, 'front')}
                                title="المشهد الأمامي للواجهة"
                              >
                                🌸 أمام
                              </button>
                              <button 
                                type="button" 
                                class="angle-tab-btn" 
                                class:active={curAngle === 'back'} 
                                on:click={() => setItemAngle(itemKey, 'back')}
                                title="المشهد الخلفي للغلاف والربطة"
                              >
                                🎀 خلف
                              </button>
                              <button 
                                type="button" 
                                class="angle-tab-btn" 
                                class:active={curAngle === 'side'} 
                                on:click={() => setItemAngle(itemKey, 'side')}
                                title="المشهد الجانبي وبروز الطبقات"
                              >
                                🌿 جنب
                              </button>
                              <button 
                                type="button" 
                                class="angle-tab-btn" 
                                class:active={curAngle === 'top'} 
                                on:click={() => setItemAngle(itemKey, 'top')}
                                title="المشهد العلوي للقبة الدائرية"
                              >
                                🪷 أعلى
                              </button>
                            </div>

                            <!-- 2. نافذة عرض الزاوية المحددة -->
                            <div class="angle-stage-display">
                              {#if curAngle === 'front'}
                                <!-- المشهد الأمامي الكامل -->
                                <svg class="angle-render-svg fade-in" viewBox="0 0 240 260">
                                  <defs>
                                    <linearGradient id="flrFrontWingGrad_{itemKey}" x1="0" y1="0" x2="1" y2="1">
                                      <stop offset="0%" stop-color="{wrapColors.main}" stop-opacity="0.95" />
                                      <stop offset="100%" stop-color="{wrapColors.dark}" />
                                    </linearGradient>
                                    <radialGradient id="flrAtelierBack_{itemKey}" cx="50%" cy="40%" r="65%">
                                      <stop offset="0%" stop-color="#ffffff" />
                                      <stop offset="100%" stop-color="#f2ebe2" />
                                    </radialGradient>
                                  </defs>
                                  <rect width="240" height="260" rx="14" fill="url(#flrAtelierBack_{itemKey})" />
                                  <!-- أجنحة التغليف الخلفية -->
                                  <path d="M 120,235 L 28,110 C 18,65 35,32 58,26 L 120,68 Z" fill="url(#flrFrontWingGrad_{itemKey})" stroke="{wrapColors.border}" stroke-width="1.6" />
                                  <path d="M 120,235 L 212,110 C 222,65 205,32 182,26 L 120,68 Z" fill="url(#flrFrontWingGrad_{itemKey})" stroke="{wrapColors.border}" stroke-width="1.6" />
                                  <path d="M 120,22 C 145,26 185,42 195,85 C 200,128 175,200 120,240 C 65,200 40,128 45,85 C 55,42 95,26 120,22 Z" fill="{wrapColors.dark}" stroke="{wrapColors.border}" stroke-width="1.4" opacity="0.9" />

                                  <!-- زهور الواجهة المتراصة -->
                                  <!-- القمة: براعم وورود عالية -->
                                  <circle cx="120" cy="72" r="19" fill="#c02741" stroke="#fce4e8" stroke-width="1.2" />
                                  <circle cx="98" cy="80" r="16" fill="#f7f4ed" stroke="#c59b27" stroke-width="1" />
                                  <circle cx="142" cy="80" r="16" fill="#c02741" stroke="#fce4e8" stroke-width="1" />
                                  <!-- أوراق خضراء جانبية -->
                                  <ellipse cx="65" cy="88" rx="14" ry="7" transform="rotate(-30 65 88)" fill="#5e6b2c" />
                                  <ellipse cx="175" cy="88" rx="14" ry="7" transform="rotate(30 175 88)" fill="#5e6b2c" />
                                  <!-- الوسط: زهور مفتوحة كاملة النضارة -->
                                  <circle cx="120" cy="108" r="24" fill="#a41832" stroke="#fff" stroke-width="1.4" />
                                  <circle cx="86" cy="112" r="19" fill="#d4889c" stroke="#fff" stroke-width="1.2" />
                                  <circle cx="154" cy="112" r="19" fill="#f28da5" stroke="#fff" stroke-width="1.2" />
                                  <!-- زهور القاعدة والجبسوفيلا -->
                                  <circle cx="100" cy="138" r="14" fill="#ffffff" stroke="#ddd" stroke-width="0.8" />
                                  <circle cx="140" cy="138" r="14" fill="#ffffff" stroke="#ddd" stroke-width="0.8" />
                                  <circle cx="120" cy="144" r="15" fill="#c02741" />

                                  <!-- ياقة الكشكش الحريرية -->
                                  <path d="M 52,142 C 72,128 92,150 120,135 C 148,150 168,128 188,142 C 180,165 155,182 120,185 C 85,182 60,165 52,142 Z" fill="#ffffff" opacity="0.9" stroke="{wrapColors.border}" stroke-width="1.2" />

                                  <!-- المخروط الأمامي السفلي -->
                                  <path d="M 68,160 L 120,240 L 172,160 Z" fill="url(#flrFrontWingGrad_{itemKey})" stroke="{wrapColors.border}" stroke-width="1.4" />

                                  <!-- شريط الساتان والفيونكة -->
                                  <path d="M 96,188 Q 120,192 144,188" stroke="{ribbonHex}" stroke-width="8" stroke-linecap="round" fill="none" />
                                  <ellipse cx="110" cy="192" rx="12" ry="7" transform="rotate(-15 110 192)" fill="{ribbonHex}" />
                                  <ellipse cx="130" cy="192" rx="12" ry="7" transform="rotate(15 130 192)" fill="{ribbonHex}" />
                                  <circle cx="120" cy="192" r="4.5" fill="#ffd700" />
                                  <path d="M 116,195 Q 105,215 102,235" stroke="{ribbonHex}" stroke-width="3" fill="none" />
                                  <path d="M 124,195 Q 135,215 138,235" stroke="{ribbonHex}" stroke-width="3" fill="none" />
                                </svg>
                                <span class="angle-tag-floating front">🌸 مشهد أمامي (الواجهة)</span>

                              {:else if curAngle === 'back'}
                                <!-- المشهد الخلفي: طيات التغليف وربطة السيقان -->
                                <svg class="angle-render-svg fade-in" viewBox="0 0 240 260">
                                  <defs>
                                    <radialGradient id="flrAtelierBackB_{itemKey}" cx="50%" cy="40%" r="65%">
                                      <stop offset="0%" stop-color="#ffffff" />
                                      <stop offset="100%" stop-color="#ece4d8" />
                                    </radialGradient>
                                  </defs>
                                  <rect width="240" height="260" rx="14" fill="url(#flrAtelierBackB_{itemKey})" />

                                  <!-- أطراف الزهور البارزة قليلاً من الأعلى خلف التغليف -->
                                  <circle cx="120" cy="38" r="14" fill="#6d1222" opacity="0.6" />
                                  <circle cx="95" cy="45" r="12" fill="#5e6b2c" opacity="0.7" />
                                  <circle cx="145" cy="45" r="12" fill="#5e6b2c" opacity="0.7" />

                                  <!-- ظهر ورق التغليف الكوري: طيات متداخلة أنيقة -->
                                  <path d="M 120,24 C 150,28 190,48 200,95 C 205,150 170,225 120,235 C 70,225 35,150 40,95 C 50,48 90,28 120,24 Z" fill="{wrapColors.main}" stroke="{wrapColors.border}" stroke-width="1.8" />
                                  
                                  <!-- طية الجناح الأيسر الخلفي المتداخل -->
                                  <path d="M 40,95 L 120,235 L 75,235 L 25,120 Z" fill="{wrapColors.dark}" opacity="0.95" stroke="{wrapColors.border}" stroke-width="1.2" />
                                  <!-- طية الجناح الأيمن الخلفي المتداخل فوقه -->
                                  <path d="M 200,95 L 120,235 L 165,235 L 215,120 Z" fill="{wrapColors.dark}" opacity="0.9" stroke="{wrapColors.border}" stroke-width="1.2" />
                                  
                                  <!-- خط الطي المركزي والدرزات الخلفية -->
                                  <line x1="120" y1="24" x2="120" y2="185" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4 3" />
                                  <line x1="40" y1="95" x2="120" y2="185" stroke="{wrapColors.border}" stroke-width="1.4" opacity="0.75" />
                                  <line x1="200" y1="95" x2="120" y2="185" stroke="{wrapColors.border}" stroke-width="1.4" opacity="0.75" />

                                  <!-- حزمة السيقان السفلية المربوطة بشريط التثبيت الأخضر -->
                                  <rect x="108" y="205" width="24" height="42" rx="3" fill="#2d5a27" stroke="#1b3b17" stroke-width="1" />
                                  <line x1="108" y1="215" x2="132" y2="215" stroke="#4a8542" stroke-width="1.5" />
                                  <line x1="108" y1="228" x2="132" y2="228" stroke="#4a8542" stroke-width="1.5" />
                                  <line x1="108" y1="240" x2="132" y2="240" stroke="#4a8542" stroke-width="1.5" />

                                  <!-- ربطة شريط الساتان الخلفية المربوطة بإحكام -->
                                  <rect x="96" y="185" width="48" height="12" rx="6" fill="{ribbonHex}" stroke="rgba(0,0,0,0.2)" stroke-width="1" />
                                  <!-- عقدة الفيونكة الخلفية -->
                                  <circle cx="120" cy="191" r="5" fill="{ribbonHex}" stroke="#ffd700" stroke-width="1" />
                                  <path d="M 118,194 L 110,212" stroke="{ribbonHex}" stroke-width="3" />
                                  <path d="M 122,194 L 130,212" stroke="{ribbonHex}" stroke-width="3" />

                                  <!-- بطاقة MASKA الملكية المعلقة من الخلف -->
                                  <g transform="translate(142, 160)">
                                    <line x1="-12" y1="25" x2="0" y2="0" stroke="#d4af37" stroke-width="1" />
                                    <rect x="-2" y="0" width="36" height="22" rx="3" fill="#fff" stroke="#c59b27" stroke-width="1" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
                                    <text x="16" y="10" font-size="6" font-weight="900" fill="#4a5723" text-anchor="middle">MASKA</text>
                                    <text x="16" y="17" font-size="5" font-weight="700" fill="#c59b27" text-anchor="middle">ATELIER</text>
                                  </g>
                                </svg>
                                <span class="angle-tag-floating back">🎀 مشهد خلفي (طيات الغلاف والربطة)</span>

                              {:else if curAngle === 'side'}
                                <!-- المشهد الجانبي: بروز الطبقات وزوايا ميلان السيقان 45° -->
                                <svg class="angle-render-svg fade-in" viewBox="0 0 240 260">
                                  <defs>
                                    <radialGradient id="flrAtelierBackS_{itemKey}" cx="50%" cy="40%" r="65%">
                                      <stop offset="0%" stop-color="#ffffff" />
                                      <stop offset="100%" stop-color="#f0e7dc" />
                                    </radialGradient>
                                  </defs>
                                  <rect width="240" height="260" rx="14" fill="url(#flrAtelierBackS_{itemKey})" />

                                  <!-- خط توجيه زاوية 45° استرشادي -->
                                  <line x1="65" y1="35" x2="175" y2="145" stroke="#c59b27" stroke-width="1" stroke-dasharray="3 3" opacity="0.45" />

                                  <!-- الجدار الخلفي المرتفع للغلاف (يسار) -->
                                  <path d="M 65,30 C 58,70 65,130 95,200 L 115,245 L 128,245 L 165,160 C 180,120 185,100 178,90 L 140,110 L 110,140 Z" fill="{wrapColors.main}" stroke="{wrapColors.border}" stroke-width="1.6" />
                                  <path d="M 65,30 L 105,75 L 95,200 Z" fill="{wrapColors.dark}" opacity="0.9" />

                                  <!-- الزهرة الخلفية العالية (عمودية 90° بطول 48 سم) -->
                                  <circle cx="82" cy="52" r="18" fill="#c02741" stroke="#fff" stroke-width="1.2" />
                                  <!-- زهرة الوسط المائلة 20° للأمام -->
                                  <circle cx="115" cy="82" r="22" fill="#a41832" stroke="#fff" stroke-width="1.4" />
                                  <!-- زهرة بيوني بارزة للأمام -->
                                  <circle cx="142" cy="98" r="19" fill="#d4889c" stroke="#fff" stroke-width="1.2" />
                                  <!-- زهرة القاعدة المائلة 40° فوق حافة الياقة -->
                                  <circle cx="168" cy="118" r="15" fill="#f7f4ed" stroke="#c59b27" stroke-width="1" />

                                  <!-- غصن أوكالبتوس ممتد جانبياً لليمين -->
                                  <path d="M 125,95 Q 165,90 195,105" stroke="#5e6b2c" stroke-width="2.5" fill="none" />
                                  <ellipse cx="160" cy="92" rx="9" ry="5" transform="rotate(-20 160 92)" fill="#5e6b2c" />
                                  <ellipse cx="180" cy="98" rx="8" ry="4" transform="rotate(15 180 98)" fill="#5e6b2c" />
                                  <ellipse cx="195" cy="105" rx="7" ry="4" transform="rotate(-10 195 105)" fill="#5e6b2c" />

                                  <!-- ياقة التغليف الجانبية -->
                                  <path d="M 98,140 C 120,130 145,135 175,125 C 165,155 140,175 110,185 Z" fill="#ffffff" opacity="0.88" stroke="{wrapColors.border}" stroke-width="1" />

                                  <!-- مقطع الفيونكة الجانبي -->
                                  <g transform="translate(112, 182)">
                                    <ellipse cx="12" cy="0" rx="14" ry="7" transform="rotate(25 12 0)" fill="{ribbonHex}" stroke="#ffd700" stroke-width="0.8" />
                                    <circle cx="0" cy="0" r="5" fill="{ribbonHex}" />
                                    <path d="M 2,3 Q 15,25 22,48" stroke="{ribbonHex}" stroke-width="3" fill="none" />
                                  </g>

                                  <!-- قص السيقان المائل 45° في الأسفل -->
                                  <path d="M 108,230 L 125,230 L 128,248 L 105,252 Z" fill="#2d5a27" stroke="#1b3b17" stroke-width="1" />
                                  <line x1="105" y1="252" x2="128" y2="248" stroke="#ffd700" stroke-width="1.5" />
                                </svg>
                                <span class="angle-tag-floating side">🌿 مشهد جانبي (بروز الطبقات والميلان)</span>

                              {:else if curAngle === 'top'}
                                <!-- المشهد العلوي: القبة الدائرية وتغطية كامل القطر 360° -->
                                <svg class="angle-render-svg fade-in" viewBox="0 0 240 260">
                                  <defs>
                                    <radialGradient id="flrAtelierBackT_{itemKey}" cx="50%" cy="40%" r="65%">
                                      <stop offset="0%" stop-color="#ffffff" />
                                      <stop offset="100%" stop-color="#ece2d2" />
                                    </radialGradient>
                                    <radialGradient id="flrDomeNest_{itemKey}" cx="50%" cy="50%" r="50%">
                                      <stop offset="0%" stop-color="{wrapColors.dark}" />
                                      <stop offset="80%" stop-color="{wrapColors.main}" />
                                      <stop offset="100%" stop-color="{wrapColors.dark}" />
                                    </radialGradient>
                                  </defs>
                                  <rect width="240" height="260" rx="14" fill="url(#flrAtelierBackT_{itemKey})" />

                                  <g transform="translate(120, 130)">
                                    <!-- طوق الأوريغامي المسنن الدائري الكامل 360° -->
                                    {#each Array(16) as _, i}
                                      <g transform="rotate({i * 22.5})">
                                        <polygon points="0,-115 -22,-65 0,-65" fill="{wrapColors.main}" stroke="rgba(255,255,255,0.2)" stroke-width="0.6" />
                                        <polygon points="0,-115 0,-65 22,-65" fill="{wrapColors.dark}" stroke="rgba(255,255,255,0.15)" stroke-width="0.6" />
                                        <line x1="0" y1="-115" x2="0" y2="-65" stroke="{wrapColors.border}" stroke-width="1" opacity="0.8" />
                                      </g>
                                    {/each}

                                    <!-- قاعدة الطوق الحاضنة -->
                                    <circle r="72" fill="url(#flrDomeNest_{itemKey})" stroke="{wrapColors.border}" stroke-width="2" />
                                    <circle r="68" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="3" />

                                    <!-- حلقة الزهور الخارجية الملاصقة للطوق (8 ورود) -->
                                    {#each Array(8) as _, i}
                                      <circle 
                                        cx="{Math.cos(i * 45 * Math.PI / 180) * 48}" 
                                        cy="{Math.sin(i * 45 * Math.PI / 180) * 48}" 
                                        r="15" 
                                        fill="{i % 2 === 0 ? '#c02741' : (i % 3 === 0 ? '#f7f4ed' : '#d4889c')}" 
                                        stroke="#ffffff" 
                                        stroke-width="1" 
                                      />
                                    {/each}

                                    <!-- حلقة الزهور الوسطى (6 ورود) -->
                                    {#each Array(6) as _, i}
                                      <circle 
                                        cx="{Math.cos((i * 60 + 30) * Math.PI / 180) * 26}" 
                                        cy="{Math.sin((i * 60 + 30) * Math.PI / 180) * 26}" 
                                        r="16" 
                                        fill="{i % 2 === 0 ? '#a41832' : '#f28da5'}" 
                                        stroke="#ffffff" 
                                        stroke-width="1.2" 
                                      />
                                    {/each}

                                    <!-- الوردة المركزية في قلب القبة الدائرية -->
                                    <circle cx="0" cy="0" r="18" fill="#880e24" stroke="#ffffff" stroke-width="1.4" />
                                    <circle cx="0" cy="0" r="8" fill="#c02741" />

                                    <!-- شارة MASKA DOME 360° على حافة الطوق -->
                                    <g transform="translate(0, -96)">
                                      <rect x="-30" y="-7" width="60" height="14" rx="7" fill="rgba(20,20,20,0.85)" stroke="{wrapColors.border}" stroke-width="1" />
                                      <text x="0" y="3" fill="#d4af37" font-size="6.5" font-weight="900" text-anchor="middle" letter-spacing="0.5">MASKA 360°</text>
                                    </g>
                                  </g>
                                </svg>
                                <span class="angle-tag-floating top">🪷 مشهد علوي (القبة وسد الفراغات 360°)</span>
                              {/if}

                              <!-- زر تكبير ومعاينة الزوايا الأربع بدقة عالية -->
                              <button 
                                type="button" 
                                class="btn-zoom-angles-floating" 
                                on:click={() => openAngleModal(itm, blueprint, order)}
                                title="تكبير ومعاينة الزوايا الأربع معاً بدقة عالية"
                              >
                                🔍 تكبير الزوايا 4
                              </button>
                            </div>

                            <!-- 3. شريط المصغرات الأربعة بنقرة واحدة -->
                            <div class="angle-thumbs-row">
                              <button 
                                type="button" 
                                class="angle-mini-thumb" 
                                class:active={curAngle === 'front'} 
                                on:click={() => setItemAngle(itemKey, 'front')}
                                title="من أمام 🌸"
                              >
                                <span>🌸 أمام</span>
                              </button>
                              <button 
                                type="button" 
                                class="angle-mini-thumb" 
                                class:active={curAngle === 'back'} 
                                on:click={() => setItemAngle(itemKey, 'back')}
                                title="من خلف 🎀"
                              >
                                <span>🎀 خلف</span>
                              </button>
                              <button 
                                type="button" 
                                class="angle-mini-thumb" 
                                class:active={curAngle === 'side'} 
                                on:click={() => setItemAngle(itemKey, 'side')}
                                title="من جنب 🌿"
                              >
                                <span>🌿 جنب</span>
                              </button>
                              <button 
                                type="button" 
                                class="angle-mini-thumb" 
                                class:active={curAngle === 'top'} 
                                on:click={() => setItemAngle(itemKey, 'top')}
                                title="من أعلى 🪷"
                              >
                                <span>🪷 أعلى</span>
                              </button>
                            </div>

                            <!-- 4. شريط إرشادي للزاوية النشطة -->
                            <div class="angle-tip-strip">
                              <small>{getAngleTip(curAngle)}</small>
                            </div>
                          </div>

                          <div class="obs-item-details">
                            <div class="obs-title-row">
                              <h4 class="obs-title">{itm.item_title}</h4>
                              <span class="obs-qty-badge">{itm.quantity || 1} باقة • {itm.unit_price} د.ل</span>
                            </div>

                            {#if itm.bouquet_description}
                              <p class="obs-desc">{itm.bouquet_description}</p>
                            {/if}

                            <!-- مواصفات التغليف والشريط المختار -->
                            <div class="obs-spec-pills">
                              <span class="spec-pill">
                                <b>ورق التغليف:</b> {itm.wrap_type || blueprint.wrapType}
                              </span>
                              <span class="spec-pill">
                                <b>شريط الساتان:</b> {itm.ribbon_color || blueprint.ribbonColor}
                              </span>
                              {#if itm.seal_color}
                                <span class="spec-pill">
                                  <b>الختم الشمعي:</b> {itm.seal_color}
                                </span>
                              {/if}
                            </div>

                            <!-- قائمة ورود الباقة بالصور والكميات -->
                            {#if itm.recipe_flowers && itm.recipe_flowers.length > 0}
                              <div class="obs-recipe-box">
                                <span class="recipe-heading">توليفة ومخزون الورود المطلوبة ({itm.recipe_flowers.reduce((s, f) => s + (Number(f.quantity_stems) || 0), 0)} ساق):</span>
                                <div class="recipe-stems-grid">
                                  {#each itm.recipe_flowers as f}
                                    <div class="recipe-stem-item">
                                      <img src={f.image_top || f.image_front || f.image_url || '/assets/flowers/clean/red-rose-top.svg'} alt={f.flower_name} class="stem-thumb" />
                                      <div class="stem-meta">
                                        <b>{f.flower_name}</b>
                                        <small>{f.quantity_stems} سيقان • {f.color}</small>
                                      </div>
                                    </div>
                                  {/each}
                                </div>
                              </div>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>

                  <!-- السائق المخصص للتوصيل -->
                  <div class="driver-handoff-banner">
                    <div class="dh-info">
                      <span class="dh-icon">🚗</span>
                      <div>
                        <strong>كابتن التوصيل المكلف باستلام الباقة:</strong>
                        <p>{order.driver_name || 'بانتظار إسناد كابتن التوصيل'} {order.driver_phone ? `(${order.driver_phone})` : ''} • {order.vehicle_type || 'سيارة مسكة المبردة'}</p>
                      </div>
                    </div>
                    {#if order.driver_phone}
                      <a href="tel:{order.driver_phone}" class="btn-call-driver-sm">
                        اتصال بالسائق 📞
                      </a>
                    {/if}
                  </div>

                  <!-- كرت الإهداء والختم الملكي -->
                  {#if blueprint.waxSealText}
                    <div class="gift-card-royal-preview">
                      <div class="card-wax-stamp">
                        <span class="stamp-seal">{blueprint.sealColor === 'أحمر قرمزي ملكي' ? '🔴' : '🪷'} MASKA</span>
                      </div>
                      <div class="card-message-text">
                        <span class="card-hint">نص كرت الإهداء المطبوع للزبون:</span>
                        <blockquote class="customer-quote">
                          "{blueprint.waxSealText}"
                        </blockquote>
                      </div>
                    </div>
                  {/if}

                  {#if order.customer_notes}
                    <div class="customer-notes-pill">
                      <b>ملاحظة إضافية من الزبون:</b> "{order.customer_notes}"
                    </div>
                  {/if}

                  <!-- =========================================================
                       تعليمات التنسيق الفني ومواقع كل وردة (Stem Placement Map)
                       ========================================================= -->
                  <div class="stems-blueprint-section">
                    <div class="blueprint-header">
                      <div>
                        <h4 class="bp-title">خريطة وتعليمات تثبيت وتوزيع كل وردة</h4>
                        <p class="bp-sub">التزمي بالهندسة الفنية لتخرج الباقة مطابقة تماماً للمواصفات الملكية</p>
                      </div>
                      <div class="bp-spec-tags">
                        <span class="spec-tag">النمط: {blueprint.styleName}</span>
                        <span class="spec-tag">التغليف: {blueprint.wrapType}</span>
                        <span class="spec-tag">الشريط: {blueprint.ribbonColor}</span>
                      </div>
                    </div>

                    <!-- شبكة المواقع الأربعة للورود -->
                    <div class="stems-zones-grid">

                      <!-- 1. في الأعلى والقمة -->
                      <div class="zone-card zone-top">
                        <div class="zone-head">
                          <span class="zone-badge">🔝 1. في الأعلى والقمة</span>
                          <span class="zone-level">القمة الهرمية</span>
                        </div>
                        <div class="zone-flowers-list">
                          {#each blueprint.sections.top as stem}
                            <div class="stem-row">
                              <div class="stem-info">
                                <b class="stem-name">{stem.name}</b>
                                <span class="stem-color">اللون: {stem.color}</span>
                              </div>
                              <b class="stem-count">{stem.count} سيقان</b>
                            </div>
                            <p class="stem-instruction">📌 {stem.instruction}</p>
                          {/each}
                        </div>
                      </div>

                      <!-- 2. في الوسط والمركز -->
                      <div class="zone-card zone-center">
                        <div class="zone-head">
                          <span class="zone-badge">🎯 2. في الوسط والمركز</span>
                          <span class="zone-level">قلب الباقة النابض</span>
                        </div>
                        <div class="zone-flowers-list">
                          {#each blueprint.sections.center as stem}
                            <div class="stem-row">
                              <div class="stem-info">
                                <b class="stem-name">{stem.name}</b>
                                <span class="stem-color">اللون: {stem.color}</span>
                              </div>
                              <b class="stem-count">{stem.count} سيقان</b>
                            </div>
                            <p class="stem-instruction">📌 {stem.instruction}</p>
                          {/each}
                        </div>
                      </div>

                      <!-- 3. في قاعدة وأسفل الباقة -->
                      <div class="zone-card zone-bottom">
                        <div class="zone-head">
                          <span class="zone-badge">🌿 3. في قاعدة وأسفل الباقة</span>
                          <span class="zone-level">حزام الارتكاز والحماية</span>
                        </div>
                        <div class="zone-flowers-list">
                          {#each blueprint.sections.bottom as stem}
                            <div class="stem-row">
                              <div class="stem-info">
                                <b class="stem-name">{stem.name}</b>
                                <span class="stem-color">اللون: {stem.color}</span>
                              </div>
                              <b class="stem-count">{stem.count} سيقان</b>
                            </div>
                            <p class="stem-instruction">📌 {stem.instruction}</p>
                          {/each}
                        </div>
                      </div>

                      <!-- 4. على الأطراف والجوانب -->
                      <div class="zone-card zone-sides">
                        <div class="zone-head">
                          <span class="zone-badge">🌾 4. على الأطراف والجوانب</span>
                          <span class="zone-level">الفروع والعمق الشاعري</span>
                        </div>
                        <div class="zone-flowers-list">
                          {#each blueprint.sections.sides as stem}
                            <div class="stem-row">
                              <div class="stem-info">
                                <b class="stem-name">{stem.name}</b>
                                <span class="stem-color">اللون: {stem.color}</span>
                              </div>
                              <b class="stem-count">{stem.count} سيقان</b>
                            </div>
                            <p class="stem-instruction">📌 {stem.instruction}</p>
                          {/each}
                        </div>
                      </div>

                    </div>
                  </div>

                  <!-- قائمة فحص المنسقة التفاعلية -->
                  <div class="florist-checklist-box">
                    <span class="cl-title">قائمة التدقيق والجودة قبل التسليم:</span>
                    <div class="cl-items">
                      <label class="cl-item">
                        <input 
                          type="checkbox" 
                          checked={orderChecklist[`${order.id}_stems`]} 
                          on:change={() => toggleChecklistItem(order.id, 'stems')}
                        />
                        <span>قص السيقان بزاوية 45° تحت الماء ووضع المغذي الزهري</span>
                      </label>
                      <label class="cl-item">
                        <input 
                          type="checkbox" 
                          checked={orderChecklist[`${order.id}_placement`]} 
                          on:change={() => toggleChecklistItem(order.id, 'placement')}
                        />
                        <span>مطابقة مواقع الورود (القمة، المركز، القاعدة، الأطراف)</span>
                      </label>
                      <label class="cl-item">
                        <input 
                          type="checkbox" 
                          checked={orderChecklist[`${order.id}_wrap`]} 
                          on:change={() => toggleChecklistItem(order.id, 'wrap')}
                        />
                        <span>لف ورق التغليف المعتمد وربط شريط الساتان بإحكام</span>
                      </label>
                      <label class="cl-item">
                        <input 
                          type="checkbox" 
                          checked={orderChecklist[`${order.id}_card`]} 
                          on:change={() => toggleChecklistItem(order.id, 'card')}
                        />
                        <span>تثبيت كرت الإهداء وختمه بالشمع الملكي</span>
                      </label>
                    </div>
                  </div>

                  <!-- شريط إجراءات المنسقة وتحويل الحالة -->
                  <div class="order-action-footer">
                    {#if order.status === 'confirmed'}
                      <button 
                        type="button" 
                        class="btn btn-primary btn-start-prep"
                        disabled={actionLoading}
                        on:click={() => handleStatusUpdate(order.order_number, 'preparing')}
                      >
                        🌿 بدء التنسيق في الأتيليه الآن
                      </button>
                    {:else if order.status === 'preparing'}
                      <!-- الزر المطلوب عند الانتهاء: تحويلها إلى قيد التوصيل -->
                      <button 
                        type="button" 
                        class="btn btn-success btn-finish-ready"
                        disabled={actionLoading}
                        on:click={() => handleStatusUpdate(order.order_number, 'out_for_delivery')}
                      >
                        🚗 اكتمل التنسيق: تسليم للكابتن وتحويل إلى "قيد التوصيل"
                      </button>
                    {:else if order.status === 'out_for_delivery'}
                      <div class="delivered-notice">
                        <span class="check-icon">✓</span>
                        <span>تم تسليم الباقة لسيارة الكابتن وهي في طريقها للمستلم</span>
                      </div>
                    {/if}

                    <div class="action-footer-meta">
                      <span class="price-pill">{order.total_amount} د.ل</span>
                    </div>
                  </div>

                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

    <!-- =====================================================================
         2. التبويب الثاني: تصميم باقة جديدة ونشرها في الكتالوج
         ===================================================================== -->
    {:else if activeTab === 'new_bouquet'}
      <div class="new-bouquet-studio-hero card fade-in">
        <div class="studio-hero-content">
          <div class="hero-badge">🎨 ستوديو تصميم الباقات الكبير</div>
          <h2>تصميم واعتماد باقة جديدة عبر الاستوديو التفاعلي</h2>
          <p class="hero-desc">
            وفقاً لنظام الأتيليه الملكي، يتم تنسيق واعتماد الباقات الجديدة بالكامل داخل <b>صفحة الاستوديو الكبيرة</b>، حيث يمكنكِ توزيع الزهور ثلاثية الأبعاد وردة بوردة وتحديد ألوان ورق الكرافت وشريط الساتان والختم الشمعي والسعر، ثم اعتمادها وإضافتها فوراً لكتالوج المتجر.
          </p>

          <div class="hero-studio-perks">
            <div class="perk-card">
              <span class="perk-icon">🌸</span>
              <b>توزيع الزهور وردة بوردة</b>
              <p>تحديد موقع كل ساق (قمة، وسط، أطراف، قاعدة) ومعاينتها حياً</p>
            </div>
            <div class="perk-card">
              <span class="perk-icon">👁️</span>
              <b>رؤية 360° وزوايا الكاميرا</b>
              <p>رؤية الباقة من الأمام، الجوانب، والأعلى بتنسيق متناغم</p>
            </div>
            <div class="perk-card">
              <span class="perk-icon">🎀</span>
              <b>أوراق التغليف وأشرطة الساتان</b>
              <p>تخصيص كامل للتغليف الإيطالي، ورق الكرافت والشريط الشمعي</p>
            </div>
            <div class="perk-card">
              <span class="perk-icon">✨</span>
              <b>اعتماد فوري بالكتالوج</b>
              <p>ضغطة زر واحدة تنشر الباقة مباشرة في متجر مسكة للزبائن</p>
            </div>
          </div>

          <div class="hero-actions-bar">
            <button 
              type="button" 
              class="btn btn-primary btn-lg btn-launch-studio"
              on:click={() => router.navigate('/studio', { mode: 'catalog_create' })}
            >
              فتح استوديو التصميم الكبير واعتماد الباقة 🌸
            </button>
            <button 
              type="button" 
              class="btn btn-outline btn-lg"
              on:click={() => activeTab = 'orders'}
            >
              العودة للطلبات المسندة
            </button>
          </div>
        </div>
      </div>





    <!-- =====================================================================
         3. التبويب الثالث: استعراض وتعديل باقات الكتالوج للمنسقة
         ===================================================================== -->
    {:else if activeTab === 'catalog'}
      <div class="catalog-grid-section">
        <div class="catalog-head-bar card">
          <div class="head-info">
            <h3>كتالوج الباقات المعتمدة ({filteredCatalogBouquets.length})</h3>
            <p>جميع الباقات المعروضة لزبائن مسكة — يمكنكِ مراجعة وصفات الورود، وتعديل بيانات أو تركيبة أي باقة فوراً</p>
          </div>
          <div class="head-actions">
            <button 
              type="button" 
              class="btn btn-primary"
              on:click={() => router.navigate('/studio', { mode: 'catalog_create' })}
            >
              + تصميم باقة جديدة في الاستوديو 🎨
            </button>
          </div>
        </div>

        <!-- شريط البحث وفلاتر المناسبات في الكتالوج -->
        <div class="catalog-filter-bar card">
          <div class="catalog-search-wrap">
            <input 
              type="text" 
              class="input-field" 
              placeholder="ابحثي عن باقة بالاسم، المناسبة، أو الورود المكونة..." 
              bind:value={catalogSearchQuery}
            />
            {#if catalogSearchQuery}
              <button type="button" class="btn-clear-search" on:click={() => catalogSearchQuery = ''}>✕</button>
            {/if}
          </div>
          <div class="catalog-tags-chips">
            <button 
              type="button" 
              class="tag-chip" 
              class:active={catalogFilterTag === 'all'}
              on:click={() => catalogFilterTag = 'all'}
            >
              الكل ({catalogBouquets.length})
            </button>
            {#each occasionOptions as occ}
              <button 
                type="button" 
                class="tag-chip" 
                class:active={catalogFilterTag === occ}
                on:click={() => catalogFilterTag = occ}
              >
                {occ} ({catalogBouquets.filter(b => b.occasion_tag === occ).length})
              </button>
            {/each}
          </div>
        </div>

        <!-- شبكة بطاقات الباقات مع إمكانية التعديل -->
        <div class="catalog-cards-grid">
          {#each filteredCatalogBouquets as bouquet (bouquet.id)}
            <div class="card catalog-b-card fade-in">
              <div class="b-card-img">
                <img src={bouquet.image_svg_path || '/assets/bouquet-pink-spring.svg'} alt={bouquet.title} />
                <span class="b-occasion-tag">{bouquet.occasion_tag}</span>
              </div>
              <div class="b-card-body">
                <h4 class="b-title">{bouquet.title}</h4>
                <p class="b-desc">{bouquet.description || 'باقة أزهار طبيعية نضرة منتقاة بعناية'}</p>
                <div class="b-recipe-tags">
                  <small>الورود المكونة ({bouquet.total_stems || bouquet.flowers?.length || 0} سيقان):</small>
                  <div class="chips-mini">
                    {#if bouquet.flowers && bouquet.flowers.length > 0}
                      {#each bouquet.flowers as f}
                        <span class="chip-item">{f.quantity_stems}x {f.flower_name}</span>
                      {/each}
                    {:else}
                      <span class="chip-item">توليفة مسكة الخاصة</span>
                    {/if}
                  </div>
                </div>

                <div class="b-card-footer">
                  <div class="b-price-box">
                    <b class="b-price">{bouquet.price} د.ل</b>
                    {#if bouquet.total_cost}
                      <small class="b-cost-hint">تكلفة الورود: {bouquet.total_cost} د.ل</small>
                    {/if}
                  </div>
                  <span class="b-active-badge">● معروضة بالمتجر</span>
                </div>

                <!-- شريط أزرار التعديل للمنسقة -->
                <div class="b-actions-row">
                  <button 
                    type="button" 
                    class="btn btn-primary btn-edit-bouquet"
                    on:click={() => openEditBouquetModal(bouquet)}
                  >
                    تعديل الباقة ✏️
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-outline btn-studio-preview"
                    on:click={() => router.navigate('/studio', { mode: 'catalog_create', bouquetId: bouquet.id })}
                    title="فتح التعديل في الاستوديو ثلاثي الأبعاد"
                  >
                    الاستوديو 🎨
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- =====================================================================
         مودل تعديل الباقة والوصفة للمنسقة (Florist Bouquet Edit Modal)
         ===================================================================== -->
    {#if editBouquetModal.open}
      <div class="modal-backdrop fade-in" on:click|self={() => editBouquetModal.open = false}>
        <div class="modal-card edit-bouquet-modal-content fade-in">
          <div class="modal-header">
            <div>
              <h3>تعديل الباقة وتوليفة الورود: {editBouquetModal.title}</h3>
              <p class="modal-sub">عدّلي الاسم، السعر، المناسبة، وكمية كل وردة لتحديثها في الكتالوج فوراً</p>
            </div>
            <button type="button" class="btn-close-modal" on:click={() => editBouquetModal.open = false}>✕</button>
          </div>

          {#if editBouquetModal.errorMsg}
            <div class="modal-alert error fade-in">{editBouquetModal.errorMsg}</div>
          {/if}

          <div class="modal-body-scroll">
            <div class="edit-fields-grid">
              <div class="form-group">
                <label>اسم الباقة الشاعري: *</label>
                <input type="text" class="input-field" bind:value={editBouquetModal.title} />
              </div>

              <div class="form-group">
                <label>المناسبة: *</label>
                <select class="input-field styled-select" bind:value={editBouquetModal.occasion_tag}>
                  {#each occasionOptions as occ}
                    <option value={occ}>{occ}</option>
                  {/each}
                </select>
              </div>

              <div class="form-group">
                <label>سعر البيع بالكتالوج (د.ل): *</label>
                <input type="number" min="5" step="1" class="input-field" bind:value={editBouquetModal.price} />
              </div>

              <div class="form-group">
                <label>النموذج الفني / الصورة:</label>
                <select class="input-field styled-select" bind:value={editBouquetModal.image_svg_path}>
                  {#each bouquetImageOptions as opt}
                    <option value={opt.path}>{opt.label}</option>
                  {/each}
                </select>
              </div>

              <div class="form-group full-width">
                <label>الوصف الفني والتسويقي:</label>
                <textarea rows="2" class="input-field" bind:value={editBouquetModal.description}></textarea>
              </div>
            </div>

            <!-- محرر توليفة الورود المكونة -->
            <div class="modal-recipe-section">
              <div class="recipe-section-head">
                <h4>تركيبة وتوليفة الورود ({editModalTotalStems} ساق)</h4>
                <span class="cost-note">تكلفة الورود: <b>{editModalTotalCost.toFixed(1)} د.ل</b> | هامش الربح: <b class="profit-val">{(editBouquetModal.price - editModalTotalCost).toFixed(1)} د.ل</b></span>
              </div>

              <!-- أزرار إضافة وردة من المخزون -->
              <div class="add-inventory-stems-bar">
                <span class="add-lbl">+ إضافة وردة من المخزون:</span>
                <div class="inv-scroll-chips">
                  {#each flowerInventory as flower}
                    <button 
                      type="button" 
                      class="chip-add-flower" 
                      on:click={() => addFlowerToEditModal(flower)}
                    >
                      <span class="dot" style="background-color: {flower.color || '#e11d48'};"></span>
                      <span>{flower.name_ar}</span>
                      <small>({flower.unit_price} د.ل)</small>
                    </button>
                  {/each}
                </div>
              </div>

              <!-- جدول الورود الحالية في الباقة -->
              <div class="recipe-edit-table">
                {#if editBouquetModal.flowers.length === 0}
                  <div class="empty-table-hint">لا توجد ورود محددة في هذه الباقة. اضغطي على الورود أعلاه لإضافتها.</div>
                {:else}
                  {#each editBouquetModal.flowers as f, idx}
                    <div class="recipe-edit-row">
                      <div class="f-info">
                        <b>{f.flower_name}</b>
                        <small>{f.stem_price || 0} د.ل / ساق • {f.color || ''}</small>
                      </div>

                      <div class="f-qty-controls">
                        <button type="button" class="btn-qty" on:click={() => {
                          if (f.quantity_stems > 1) {
                            f.quantity_stems -= 1;
                            editBouquetModal.flowers = [...editBouquetModal.flowers];
                          }
                        }}>-</button>
                        <span class="qty-display">{f.quantity_stems}</span>
                        <button type="button" class="btn-qty" on:click={() => {
                          f.quantity_stems += 1;
                          editBouquetModal.flowers = [...editBouquetModal.flowers];
                        }}>+</button>
                      </div>

                      <div class="f-notes-field">
                        <input type="text" class="input-mini" placeholder="موقع التنسيق (قمة، وسط...)" bind:value={f.notes} />
                      </div>

                      <span class="f-subtotal">{(f.quantity_stems * (f.stem_price || 0)).toFixed(1)} د.ل</span>

                      <button type="button" class="btn-del-row" on:click={() => removeFlowerFromEditModal(idx)}>✕</button>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button 
              type="button" 
              class="btn btn-primary btn-lg" 
              disabled={editBouquetModal.saving}
              on:click={handleSaveEditedBouquet}
            >
              {editBouquetModal.saving ? 'جاري حفظ التعديلات...' : 'حفظ وتحديث الباقة في الكتالوج 🌸'}
            </button>
            <button type="button" class="btn btn-outline btn-lg" on:click={() => editBouquetModal.open = false}>
              إلغاء
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- =====================================================================
         مودل تكبير ومعاينة الزوايا الأربع معاً للمنسقة (4-Angle Atelier Lightbox Modal)
         ===================================================================== -->
    {#if showAngleModal && activeModalBouquet}
      <div class="modal-backdrop fade-in" on:click|self={closeAngleModal}>
        <div class="modal-card angle-lightbox-modal-card fade-in">
          <div class="modal-header">
            <div>
              <h3>معاينة الزوايا الأربع للباقة الفاخرة (360° Atelier Inspector)</h3>
              <p class="modal-sub">
                تفاصيل التنسيق الشامل للمنسقة • طلب رقم #{activeModalBouquet.order.id} • {activeModalBouquet.itm.name}
              </p>
            </div>
            <button type="button" class="btn-close-modal" on:click={closeAngleModal}>✕</button>
          </div>

          <!-- شريط المواصفات التقنية السريعة -->
          <div class="angle-modal-specs-strip">
            <span class="spec-pill"><b>نوع الغلاف:</b> {activeModalBouquet.itm.wrap_type || activeModalBouquet.blueprint.wrapType} ({activeModalBouquet.wrapColors.label})</span>
            <span class="spec-pill"><b>شريط الساتان:</b> {activeModalBouquet.itm.ribbon_color || activeModalBouquet.blueprint.ribbonColor}</span>
            <span class="spec-pill"><b>الختم الشمعي:</b> {activeModalBouquet.itm.wax_seal_text || activeModalBouquet.blueprint.sealText || 'MASKA'}</span>
            <span class="spec-pill"><b>إجمالي السيقان:</b> {activeModalBouquet.blueprint.totalStems} ساق</span>
          </div>

          <div class="modal-body-scroll">
            <div class="modal-4angles-grid">
              <!-- 1. الزاوية الأمامية -->
              <div class="angle-modal-card">
                <div class="am-header">
                  <span class="am-badge front">🌸 1. المشهد الأمامي (Front View)</span>
                  <small>الواجهة الأساسية للزبون</small>
                </div>
                <div class="am-visual">
                  <svg class="am-svg" viewBox="0 0 240 260">
                    <defs>
                      <linearGradient id="modalFrontWing" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="{activeModalBouquet.wrapColors.main}" stop-opacity="0.95" />
                        <stop offset="100%" stop-color="{activeModalBouquet.wrapColors.dark}" />
                      </linearGradient>
                      <radialGradient id="modalAtelierBack" cx="50%" cy="40%" r="65%">
                        <stop offset="0%" stop-color="#ffffff" />
                        <stop offset="100%" stop-color="#f2ebe2" />
                      </radialGradient>
                    </defs>
                    <rect width="240" height="260" rx="14" fill="url(#modalAtelierBack)" />
                    <!-- أجنحة التغليف الخلفية -->
                    <path d="M 120,235 L 28,110 C 18,65 35,32 58,26 L 120,68 Z" fill="url(#modalFrontWing)" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.6" />
                    <path d="M 120,235 L 212,110 C 222,65 205,32 182,26 L 120,68 Z" fill="url(#modalFrontWing)" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.6" />
                    <path d="M 120,22 C 145,26 185,42 195,85 C 200,128 175,200 120,240 C 65,200 40,128 45,85 C 55,42 95,26 120,22 Z" fill="{activeModalBouquet.wrapColors.dark}" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.4" opacity="0.9" />

                    <!-- زهور الواجهة المتراصة -->
                    <circle cx="120" cy="72" r="19" fill="#c02741" stroke="#fce4e8" stroke-width="1.2" />
                    <circle cx="98" cy="80" r="16" fill="#f7f4ed" stroke="#c59b27" stroke-width="1" />
                    <circle cx="142" cy="80" r="16" fill="#c02741" stroke="#fce4e8" stroke-width="1" />
                    <ellipse cx="65" cy="88" rx="14" ry="7" transform="rotate(-30 65 88)" fill="#5e6b2c" />
                    <ellipse cx="175" cy="88" rx="14" ry="7" transform="rotate(30 175 88)" fill="#5e6b2c" />
                    <circle cx="120" cy="108" r="24" fill="#a41832" stroke="#fff" stroke-width="1.4" />
                    <circle cx="86" cy="112" r="19" fill="#d4889c" stroke="#fff" stroke-width="1.2" />
                    <circle cx="154" cy="112" r="19" fill="#f28da5" stroke="#fff" stroke-width="1.2" />
                    <circle cx="100" cy="138" r="14" fill="#ffffff" stroke="#ddd" stroke-width="0.8" />
                    <circle cx="140" cy="138" r="14" fill="#ffffff" stroke="#ddd" stroke-width="0.8" />
                    <circle cx="120" cy="144" r="15" fill="#c02741" />

                    <!-- ياقة الكشكش الحريرية -->
                    <path d="M 52,142 C 72,128 92,150 120,135 C 148,150 168,128 188,142 C 180,165 155,182 120,185 C 85,182 60,165 52,142 Z" fill="#ffffff" opacity="0.9" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.2" />

                    <!-- المخروط الأمامي السفلي -->
                    <path d="M 68,160 L 120,240 L 172,160 Z" fill="url(#modalFrontWing)" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.4" />

                    <!-- فيونكة الساتان -->
                    <path d="M 96,188 Q 120,192 144,188" stroke="{activeModalBouquet.ribbonColor}" stroke-width="8" stroke-linecap="round" fill="none" />
                    <ellipse cx="110" cy="192" rx="12" ry="7" transform="rotate(-15 110 192)" fill="{activeModalBouquet.ribbonColor}" />
                    <ellipse cx="130" cy="192" rx="12" ry="7" transform="rotate(15 130 192)" fill="{activeModalBouquet.ribbonColor}" />
                    <circle cx="120" cy="192" r="4.5" fill="#ffd700" />
                    <path d="M 116,195 Q 105,215 102,235" stroke="{activeModalBouquet.ribbonColor}" stroke-width="3" fill="none" />
                    <path d="M 124,195 Q 135,215 138,235" stroke="{activeModalBouquet.ribbonColor}" stroke-width="3" fill="none" />
                  </svg>
                </div>
                <div class="am-checklist">
                  <b>معايير التنسيق الأمامي:</b>
                  <ul>
                    <li>إبراز الزهور الأكبر والأبهى فوق ياقة الكشكش الشاش البيضاء.</li>
                    <li>تدرج ارتفاع السيقان في المنتصف لملء قلب الباقة بدون فراغات.</li>
                    <li>تثبيت فيونكة الساتان الملكية أسفل الياقة مباشرة.</li>
                  </ul>
                </div>
              </div>

              <!-- 2. الزاوية الخلفية -->
              <div class="angle-modal-card">
                <div class="am-header">
                  <span class="am-badge back">🎀 2. المشهد الخلفي (Back View)</span>
                  <small>هندسة طي الورق وتثبيت الساق</small>
                </div>
                <div class="am-visual">
                  <svg class="am-svg" viewBox="0 0 240 260">
                    <defs>
                      <linearGradient id="modalBackWing" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="{activeModalBouquet.wrapColors.dark}" />
                        <stop offset="100%" stop-color="{activeModalBouquet.wrapColors.main}" />
                      </linearGradient>
                    </defs>
                    <rect width="240" height="260" rx="14" fill="#f8f6f0" />
                    <!-- أوراق التغليف الكورية المتراكبة من الخلف -->
                    <path d="M 120,240 L 35,90 L 60,35 L 120,70 Z" fill="url(#modalBackWing)" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.6" />
                    <path d="M 120,240 L 205,90 L 180,35 L 120,70 Z" fill="url(#modalBackWing)" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.6" />
                    <path d="M 120,240 L 50,60 L 120,30 L 190,60 Z" fill="{activeModalBouquet.wrapColors.main}" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.4" />

                    <!-- حواف الأوراق الذهبية -->
                    <line x1="60" y1="35" x2="120" y2="70" stroke="#d4af37" stroke-width="2" />
                    <line x1="180" y1="35" x2="120" y2="70" stroke="#d4af37" stroke-width="2" />

                    <!-- ظهور قمم السيقان الخضراء من الخلف -->
                    <path d="M 110,65 L 105,45" stroke="#3d6b2c" stroke-width="4" stroke-linecap="round" />
                    <path d="M 120,62 L 120,40" stroke="#3d6b2c" stroke-width="4" stroke-linecap="round" />
                    <path d="M 130,65 L 135,45" stroke="#3d6b2c" stroke-width="4" stroke-linecap="round" />

                    <!-- مقبض السيقان المربوط بشريط الفلورست الأخضر -->
                    <rect x="106" y="160" width="28" height="75" rx="5" fill="#2d521d" stroke="#1d3813" stroke-width="1.2" />
                    <line x1="106" y1="175" x2="134" y2="175" stroke="#487832" stroke-width="2" />
                    <line x1="106" y1="195" x2="134" y2="195" stroke="#487832" stroke-width="2" />
                    <line x1="106" y1="215" x2="134" y2="215" stroke="#487832" stroke-width="2" />

                    <!-- عقدة شريط الساتان الخلفية وبطاقة MASKA -->
                    <circle cx="120" cy="165" r="9" fill="{activeModalBouquet.ribbonColor}" stroke="#ffffff" stroke-width="1.2" />
                    <rect x="95" y="198" width="50" height="26" rx="4" fill="#ffffff" stroke="#c59b27" stroke-width="1" />
                    <text x="120" y="211" fill="#1e1e1e" font-size="7.5" font-weight="900" text-anchor="middle">MASKA</text>
                    <text x="120" y="219" fill="#888888" font-size="5.5" font-weight="600" text-anchor="middle">ORIGINAL ATELIER</text>
                  </svg>
                </div>
                <div class="am-checklist">
                  <b>معايير التنسيق الخلفي:</b>
                  <ul>
                    <li>طي أجنحة الورق الكوري ذات الحواف الذهبية بانتظام وتراكب متناسق.</li>
                    <li>لف عنق السيقان بإحكام بشريط الفلورست الأخضر لإخفاء جميع الأسلاك.</li>
                    <li>عقدة شريط الساتان الخلفية وبطاقة أصالة MASKA الفاخرة.</li>
                  </ul>
                </div>
              </div>

              <!-- 3. الزاوية الجانبية -->
              <div class="angle-modal-card">
                <div class="am-header">
                  <span class="am-badge side">🌿 3. المشهد الجانبي (Side 3D Profile)</span>
                  <small>العمق وميلان السيقان 45°</small>
                </div>
                <div class="am-visual">
                  <svg class="am-svg" viewBox="0 0 240 260">
                    <defs>
                      <linearGradient id="modalSideCone" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="{activeModalBouquet.wrapColors.main}" />
                        <stop offset="100%" stop-color="{activeModalBouquet.wrapColors.dark}" />
                      </linearGradient>
                    </defs>
                    <rect width="240" height="260" rx="14" fill="#f8f6f0" />
                    <!-- مخروط التغليف المائل 45° -->
                    <path d="M 140,240 L 70,120 C 60,85 75,40 110,30 L 175,100 Z" fill="url(#modalSideCone)" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.6" />
                    <path d="M 140,240 L 165,115 C 180,95 190,60 175,45 L 135,35 Z" fill="{activeModalBouquet.wrapColors.dark}" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.2" opacity="0.8" />

                    <!-- سيقان متدرجة الارتفاع ومائلة نحو الأمام -->
                    <line x1="125" y1="210" x2="115" y2="70" stroke="#3d6b2c" stroke-width="5" stroke-linecap="round" />
                    <line x1="130" y1="210" x2="140" y2="90" stroke="#4a8035" stroke-width="4.5" stroke-linecap="round" />
                    <line x1="135" y1="210" x2="160" y2="115" stroke="#55913c" stroke-width="4" stroke-linecap="round" />

                    <!-- زهور جانبية متدرجة المستويات -->
                    <circle cx="112" cy="65" r="18" fill="#a41832" stroke="#fff" stroke-width="1.2" />
                    <circle cx="138" cy="85" r="17" fill="#c02741" stroke="#fff" stroke-width="1.2" />
                    <circle cx="162" cy="110" r="15" fill="#f28da5" stroke="#fff" stroke-width="1" />
                    <circle cx="95" cy="95" r="13" fill="#ffffff" stroke="#ddd" stroke-width="0.8" />

                    <!-- أوراق الأوكالبتوس الممتدة جانبياً -->
                    <ellipse cx="80" cy="80" rx="15" ry="6" transform="rotate(-40 80 80)" fill="#5e6b2c" />
                    <ellipse cx="68" cy="105" rx="13" ry="5" transform="rotate(-25 68 105)" fill="#5e6b2c" />

                    <!-- ياقة الكشكش من الجنب -->
                    <path d="M 85,130 C 110,145 140,140 170,125" stroke="#ffffff" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.9" />

                    <!-- فيونكة الساتان الجانبية -->
                    <ellipse cx="148" cy="165" rx="10" ry="14" transform="rotate(25 148 165)" fill="{activeModalBouquet.ribbonColor}" />
                    <circle cx="140" cy="162" r="5" fill="#ffd700" />
                    <path d="M 142,166 Q 155,190 152,225" stroke="{activeModalBouquet.ribbonColor}" stroke-width="3" fill="none" />
                  </svg>
                </div>
                <div class="am-checklist">
                  <b>معايير التنسيق الجانبي:</b>
                  <ul>
                    <li>ميلان السيقان بزاوية 35° إلى 45° لإعطاء عمق وتجسيم ثلاثي الأبعاد.</li>
                    <li>مستويات تدريجية: السيقان الخلفية مرتفعة والأمامية متقدمة.</li>
                    <li>امتداد خضرة الأوكالبتوس جانبياً لتأطير الباقة بانسيابية طبيعية.</li>
                  </ul>
                </div>
              </div>

              <!-- 4. الزاوية العلوية -->
              <div class="angle-modal-card">
                <div class="am-header">
                  <span class="am-badge top">🪷 4. المشهد العلوي (Top View 360°)</span>
                  <small>القبة الدائرية وسد الفراغات</small>
                </div>
                <div class="am-visual">
                  <svg class="am-svg" viewBox="0 0 240 260">
                    <defs>
                      <radialGradient id="modalTopGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="{activeModalBouquet.wrapColors.main}" />
                        <stop offset="100%" stop-color="{activeModalBouquet.wrapColors.dark}" />
                      </radialGradient>
                    </defs>
                    <rect width="240" height="260" rx="14" fill="#f8f6f0" />
                    <g transform="translate(120, 130)">
                      <!-- طوق الأوريغامي النجمي الخارجي المسنن (12 زاوية) -->
                      <polygon 
                        points="
                          0,-105 27,-96 52,-88 74,-74 88,-52 96,-27 
                          105,0 96,27 88,52 74,74 52,88 27,96 
                          0,105 -27,96 -52,88 -74,74 -88,52 -96,27 
                          -105,0 -96,-27 -88,-52 -74,-74 -52,-88 -27,-96
                        " 
                        fill="url(#modalTopGrad)" 
                        stroke="{activeModalBouquet.wrapColors.border}" 
                        stroke-width="2" 
                      />

                      <!-- حلقة بتلات التغليف الداخلية -->
                      <circle cx="0" cy="0" r="82" fill="{activeModalBouquet.wrapColors.dark}" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1.2" opacity="0.8" />

                      <!-- الحلقة الخارجية من زهور القبة (12 وردة متراصة) -->
                      {#each Array(12) as _, i}
                        <circle 
                          cx="{Math.cos(i * 30 * Math.PI / 180) * 58}" 
                          cy="{Math.sin(i * 30 * Math.PI / 180) * 58}" 
                          r="15" 
                          fill="{i % 3 === 0 ? '#c02741' : (i % 3 === 1 ? '#e88da2' : '#ffffff')}" 
                          stroke="#ffffff" 
                          stroke-width="1" 
                        />
                      {/each}

                      <!-- الحلقة المتوسطة من زهور القبة (6 ورود) -->
                      {#each Array(6) as _, i}
                        <circle 
                          cx="{Math.cos((i * 60 + 30) * Math.PI / 180) * 26}" 
                          cy="{Math.sin((i * 60 + 30) * Math.PI / 180) * 26}" 
                          r="16" 
                          fill="{i % 2 === 0 ? '#a41832' : '#f28da5'}" 
                          stroke="#ffffff" 
                          stroke-width="1.2" 
                        />
                      {/each}

                      <!-- الوردة المركزية -->
                      <circle cx="0" cy="0" r="18" fill="#880e24" stroke="#ffffff" stroke-width="1.4" />
                      <circle cx="0" cy="0" r="8" fill="#c02741" />

                      <!-- شارة MASKA 360° -->
                      <g transform="translate(0, -96)">
                        <rect x="-30" y="-7" width="60" height="14" rx="7" fill="rgba(20,20,20,0.85)" stroke="{activeModalBouquet.wrapColors.border}" stroke-width="1" />
                        <text x="0" y="3" fill="#d4af37" font-size="6.5" font-weight="900" text-anchor="middle" letter-spacing="0.5">MASKA 360°</text>
                      </g>
                    </g>
                  </svg>
                </div>
                <div class="am-checklist">
                  <b>معايير التنسيق العلوي:</b>
                  <ul>
                    <li>التوزيع الكروي المتناغم 360° لملء محيط الغلاف بالكامل.</li>
                    <li>سد الفراغات بزهور الحشو (بيبي روز، نَفَس الطفل، أقحوان).</li>
                    <li>ثبات الوردة المركزية في قلب القبة وتناغم الدوائر المحيطة.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-primary btn-lg" on:click={closeAngleModal}>
              تمت المعاينة والاعتماد ✓
            </button>
          </div>
        </div>
      </div>
    {/if}

  </div>
</div>

<style>
  .florist-atelier-page {
    padding: 30px 0 80px;
    min-height: 85vh;
  }

  /* رسائل التنبيه */
  .florist-toast {
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #065f46;
    color: #fff;
    padding: 12px 24px;
    border-radius: var(--radius-full);
    font-size: 0.95rem;
    font-weight: 700;
    box-shadow: 0 8px 24px rgba(6, 95, 70, 0.35);
    z-index: 9999;
    border: 1px solid #34d399;
  }
  .florist-toast.error {
    background: #991b1b;
    border-color: #f87171;
  }

  /* الترويسة */
  .atelier-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
    margin-bottom: 24px;
  }
  .atelier-badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
    padding: 4px 14px;
    border-radius: var(--radius-full);
    font-size: 0.8rem;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .page-title {
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--text);
    margin: 0 0 6px;
  }
  .page-subtitle {
    font-size: 0.9rem;
    color: var(--muted);
    margin: 0;
    max-width: 600px;
  }

  .florist-profile-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    padding: 12px 18px;
    border-radius: var(--radius);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
  }
  .f-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #ecfdf5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    border: 1px solid #a7f3d0;
  }
  .f-details {
    display: flex;
    flex-direction: column;
  }
  .f-name {
    font-size: 0.98rem;
    font-weight: 800;
    color: var(--text);
  }
  .f-role {
    font-size: 0.76rem;
    color: var(--muted);
  }
  .f-atelier-status {
    font-size: 0.72rem;
    color: #059669;
    font-weight: 700;
    margin-top: 2px;
  }

  /* أزرار التبويبات */
  .atelier-tabs-nav {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 12px;
    flex-wrap: wrap;
  }
  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    color: var(--text);
    padding: 10px 20px;
    border-radius: var(--radius-full);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .tab-btn:hover {
    border-color: #059669;
  }
  .tab-btn.active {
    background: #059669;
    color: #fff;
    border-color: #059669;
    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
  }
  .tab-badge {
    background: rgba(255, 255, 255, 0.25);
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
  }

  /* إحصائيات KPIs */
  .atelier-kpis-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  @media (max-width: 900px) {
    .atelier-kpis-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 500px) {
    .atelier-kpis-grid {
      grid-template-columns: 1fr;
    }
  }
  .kpi-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  }
  .kpi-icon {
    font-size: 1.6rem;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    flex-shrink: 0;
  }
  .kpi-card.prep .kpi-icon { background: #d1fae5; color: #065f46; }
  .kpi-card.new .kpi-icon { background: #fef3c7; color: #b45309; }
  .kpi-card.out .kpi-icon { background: #dbeafe; color: #1d4ed8; }
  .kpi-text {
    display: flex;
    flex-direction: column;
  }
  .kpi-label {
    font-size: 0.78rem;
    color: var(--muted);
    font-weight: 600;
  }
  .kpi-val {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--text);
  }

  /* شريط الفلاتر والبحث */
  .orders-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    padding: 14px 18px;
    margin-bottom: 20px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
  }
  .filter-pills-wrap {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-pill {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    color: var(--text);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .filter-pill:hover {
    border-color: #059669;
  }
  .filter-pill.active {
    background: #059669;
    color: #fff;
    border-color: #059669;
  }
  .filter-pill.prep.active { background: #059669; }
  .filter-pill.new.active { background: #d97706; border-color: #d97706; }
  .filter-pill.out.active { background: #2563eb; border-color: #2563eb; }

  .search-wrap {
    position: relative;
    min-width: 260px;
    flex: 1;
    max-width: 360px;
  }
  .search-input {
    width: 100%;
    padding: 8px 16px 8px 30px;
    border-radius: var(--radius-full);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    color: var(--text);
    font-size: 0.84rem;
    outline: none;
  }
  .btn-clear-search {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
  }

  /* بطاقات الطلبات */
  .orders-feed {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .order-atelier-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    overflow: hidden;
    transition: box-shadow 0.2s ease;
  }
  .order-atelier-card:hover {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
  }
  .order-atelier-card.is-expanded {
    border-color: #059669;
    box-shadow: 0 8px 24px rgba(5, 150, 105, 0.1);
  }

  /* شريط رأس الطلب */
  .card-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    cursor: pointer;
    background: var(--card-solid);
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
    gap: 14px;
  }
  .top-meta-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .order-badge {
    background: #d1fae5;
    color: #065f46;
    font-weight: 800;
    font-size: 0.95rem;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
  }
  .order-timing {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .order-timing b {
    font-size: 1rem;
    color: var(--text);
  }
  .order-timing small {
    font-size: 0.78rem;
    color: var(--muted);
  }

  .top-meta-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .delivery-time-tag {
    font-size: 0.78rem;
    color: var(--muted);
    background: var(--bg);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
  }
  .delivery-time-tag b {
    color: var(--text);
  }

  .status-pill {
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    font-weight: 700;
  }
  .status-pill.status-preparing { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
  .status-pill.status-confirmed { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
  .status-pill.status-out_for_delivery { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
  .status-pill.status-delivered { background: #ecfdf5; color: #047857; }

  .btn-toggle-expand {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    color: var(--text);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
  }

  /* تفاصيل الطلب الموسعة */
  .card-expanded-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    background: var(--bg);
  }

  /* شريط كابتن التوصيل */
  .driver-handoff-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: var(--radius-sm);
    padding: 12px 16px;
    gap: 12px;
  }
  .dh-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dh-icon {
    font-size: 1.4rem;
  }
  .dh-info strong {
    font-size: 0.85rem;
    color: #1e3a8a;
  }
  .dh-info p {
    margin: 2px 0 0;
    font-size: 0.78rem;
    color: #3b82f6;
  }
  .btn-call-driver-sm {
    background: #2563eb;
    color: #fff;
    padding: 6px 12px;
    border-radius: var(--radius-full);
    font-size: 0.76rem;
    font-weight: 700;
    text-decoration: none;
  }

  /* كرت الإهداء الملكي والختم */
  .gift-card-royal-preview {
    background: var(--card-solid);
    border: 1px solid #fbcfe8;
    border-radius: var(--radius-sm);
    padding: 14px 18px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .card-wax-stamp {
    background: #ffe4e6;
    color: #9f1239;
    border: 1px solid #fecdd3;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-weight: 800;
    font-size: 0.8rem;
    white-space: nowrap;
  }
  .card-message-text {
    flex: 1;
  }
  .card-hint {
    font-size: 0.75rem;
    color: var(--muted);
    display: block;
    margin-bottom: 4px;
  }
  .customer-quote {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text);
    font-family: inherit;
    font-style: italic;
  }

  .customer-notes-pill {
    background: rgba(0, 0, 0, 0.04);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    color: var(--text);
  }

  /* =========================================================================
     المخطط الهندسي لتعليمات توزيع كل وردة
     ========================================================================= */
  .stems-blueprint-section {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 18px;
  }
  .blueprint-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--line);
    padding-bottom: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 10px;
  }
  .bp-title {
    font-size: 1.05rem;
    font-weight: 800;
    color: #065f46;
    margin: 0 0 2px;
  }
  .bp-sub {
    font-size: 0.78rem;
    color: var(--muted);
    margin: 0;
  }
  .bp-spec-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .spec-tag {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.74rem;
    color: var(--text);
    font-weight: 600;
  }

  /* شبكة مناطق توزيع الورود الأربعة */
  .stems-zones-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  @media (max-width: 768px) {
    .stems-zones-grid {
      grid-template-columns: 1fr;
    }
  }

  .zone-card {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .zone-card.zone-top { border-top: 3px solid #e11d48; }
  .zone-card.zone-center { border-top: 3px solid #059669; }
  .zone-card.zone-bottom { border-top: 3px solid #d97706; }
  .zone-card.zone-sides { border-top: 3px solid #2563eb; }

  .zone-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--line);
    padding-bottom: 8px;
  }
  .zone-badge {
    font-size: 0.86rem;
    font-weight: 800;
    color: var(--text);
  }
  .zone-level {
    font-size: 0.72rem;
    color: var(--muted);
  }

  .zone-flowers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .stem-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 4px;
    border-bottom: 1px dashed var(--line);
  }
  .stem-info {
    display: flex;
    flex-direction: column;
  }
  .stem-name {
    font-size: 0.88rem;
    color: var(--text);
  }
  .stem-color {
    font-size: 0.72rem;
    color: var(--muted);
  }
  .stem-count {
    background: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
  }
  .stem-instruction {
    margin: 2px 0 0;
    font-size: 0.75rem;
    color: #047857;
    background: rgba(5, 150, 105, 0.05);
    padding: 4px 8px;
    border-radius: 4px;
    line-height: 1.4;
  }

  /* قائمة الفحص */
  .florist-checklist-box {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 14px 18px;
  }
  .cl-title {
    font-size: 0.84rem;
    font-weight: 800;
    color: var(--text);
    display: block;
    margin-bottom: 10px;
  }
  .cl-items {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  @media (max-width: 650px) {
    .cl-items {
      grid-template-columns: 1fr;
    }
  }
  .cl-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.78rem;
    color: var(--text);
    cursor: pointer;
  }
  .cl-item input {
    accent-color: #059669;
    width: 16px;
    height: 16px;
  }

  /* شريط الإجراءات والتحويل للتوصيل */
  .order-action-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 10px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .btn-start-prep {
    background: #059669;
    color: #fff;
    padding: 10px 24px;
    border-radius: var(--radius-sm);
    font-weight: 700;
    font-size: 0.92rem;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-start-prep:hover {
    background: #047857;
  }

  .btn-finish-ready {
    background: #2563eb;
    color: #fff;
    padding: 12px 28px;
    border-radius: var(--radius-sm);
    font-weight: 800;
    font-size: 0.95rem;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
    transition: all 0.2s;
  }
  .btn-finish-ready:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
  }

  .delivered-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #065f46;
    background: #d1fae5;
    padding: 8px 16px;
    border-radius: var(--radius-full);
    font-size: 0.84rem;
    font-weight: 700;
  }
  .check-icon {
    font-weight: 900;
  }
  .price-pill {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--text);
  }

  /* =========================================================================
     تبويب استوديو تصميم باقة جديدة للكتالوج
     ========================================================================= */
  .studio-direct-btn {
    background: rgba(5, 150, 105, 0.08);
    border-color: rgba(5, 150, 105, 0.35);
    color: #059669;
    font-weight: 800;
  }
  .studio-direct-btn:hover {
    background: #059669;
    color: #fff;
  }

  .new-bouquet-studio-hero {
    background: linear-gradient(135deg, #ffffff 0%, #fdf8f6 100%);
    border: 2px solid #059669;
    border-radius: var(--radius-lg);
    padding: 40px 32px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(5, 150, 105, 0.08);
  }
  .studio-hero-content {
    max-width: 820px;
    margin: 0 auto;
  }
  .hero-badge {
    display: inline-block;
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
    padding: 6px 18px;
    border-radius: var(--radius-full);
    font-weight: 800;
    font-size: 0.88rem;
    margin-bottom: 14px;
  }
  .new-bouquet-studio-hero h2 {
    font-size: 1.8rem;
    font-weight: 900;
    color: var(--text);
    margin-bottom: 12px;
  }
  .new-bouquet-studio-hero .hero-desc {
    font-size: 1.05rem;
    color: var(--text-muted);
    line-height: 1.7;
    margin-bottom: 30px;
  }
  .hero-studio-perks {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 36px;
    text-align: right;
  }
  .perk-card {
    background: #ffffff;
    border: 1px solid rgba(5, 150, 105, 0.2);
    border-radius: var(--radius-md);
    padding: 18px;
    box-shadow: var(--shadow-sm);
  }
  .perk-icon {
    font-size: 1.6rem;
    display: block;
    margin-bottom: 8px;
  }
  .perk-card b {
    display: block;
    font-size: 0.95rem;
    color: var(--text);
    margin-bottom: 4px;
  }
  .perk-card p {
    font-size: 0.82rem;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 0;
  }
  .hero-actions-bar {
    display: flex;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .btn-launch-studio {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    color: #fff;
    padding: 14px 32px;
    font-size: 1.05rem;
    font-weight: 800;
    border-radius: var(--radius-full);
    box-shadow: 0 4px 16px rgba(5, 150, 105, 0.35);
    transition: all 0.2s;
  }
  .btn-launch-studio:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(5, 150, 105, 0.45);
  }
  .new-bouquet-designer-wrap {
    padding: 24px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
  }
  .designer-intro-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--line);
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .designer-intro-bar h3 {
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--text);
    margin: 0 0 4px;
  }
  .designer-intro-bar p {
    font-size: 0.85rem;
    color: var(--muted);
    margin: 0;
  }
  .florist-badge-indicator {
    background: #d1fae5;
    color: #065f46;
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 800;
  }

  .form-cols-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
  }
  @media (max-width: 950px) {
    .form-cols-grid {
      grid-template-columns: 1fr;
    }
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }
  .form-group label {
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--text);
  }
  .form-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .textarea-field {
    resize: vertical;
    font-family: inherit;
  }

  /* اختيار صور الباقة */
  .images-selector-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .img-choice-box {
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    background: var(--bg);
    transition: all 0.2s;
  }
  .img-choice-box img {
    width: 60px;
    height: 60px;
    object-fit: contain;
  }
  .img-choice-box span {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text);
    text-align: center;
  }
  .img-choice-box.selected {
    border-color: #059669;
    background: #ecfdf5;
    box-shadow: 0 0 0 2px #059669;
  }

  /* اختيار الورود */
  .recipe-selector-header h4 {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--text);
    margin: 0;
  }
  .recipe-selector-header small {
    font-size: 0.78rem;
    color: var(--muted);
    display: block;
    margin-bottom: 12px;
  }

  .inventory-quick-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .flower-chip-btn {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    color: var(--text);
    padding: 6px 12px;
    border-radius: var(--radius-full);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }
  .flower-chip-btn:hover {
    border-color: #059669;
    background: #ecfdf5;
    color: #065f46;
  }
  .flower-chip-btn small {
    color: var(--muted);
  }

  .selected-stems-table-box {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 12px;
    margin-bottom: 16px;
    min-height: 180px;
  }
  .empty-stems-notice {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 150px;
    color: var(--muted);
    font-size: 0.84rem;
    text-align: center;
  }
  .selected-stems-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .selected-stem-card {
    background: var(--card-solid);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .st-main {
    display: flex;
    flex-direction: column;
  }
  .st-main b {
    font-size: 0.88rem;
    color: var(--text);
  }
  .st-main small {
    font-size: 0.72rem;
    color: var(--muted);
  }
  .st-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .qty-stepper {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--bg);
  }
  .qty-stepper button {
    background: none;
    border: none;
    padding: 4px 10px;
    font-weight: 800;
    cursor: pointer;
    color: var(--text);
  }
  .qty-num {
    padding: 0 6px;
    font-size: 0.78rem;
    font-weight: 700;
  }
  .section-select-mini {
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    color: var(--text);
    font-size: 0.76rem;
    font-weight: 600;
  }
  .btn-remove-stem {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-weight: 800;
    padding: 4px;
  }

  /* بطاقة التسعير */
  .pricing-summary-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }
  .price-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
    color: #475569;
  }
  .price-row.highlight {
    color: #065f46;
    font-weight: 800;
    border-top: 1px solid #cbd5e1;
    padding-top: 6px;
    font-size: 0.9rem;
  }
  .custom-price-input-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 6px;
  }
  .custom-price-input-row label {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text);
  }
  .price-input {
    max-width: 140px;
    padding: 6px 12px;
    font-weight: 800;
    font-size: 1rem;
    color: #065f46;
  }

  .btn-publish {
    background: #059669;
    color: #fff;
    padding: 14px;
    border-radius: var(--radius-sm);
    font-size: 1rem;
    font-weight: 800;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-publish:hover {
    background: #047857;
  }

  /* =========================================================================
     تبويب الكتالوج
     ========================================================================= */
  .catalog-head-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 24px;
    margin-bottom: 24px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
  }
  .catalog-cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  @media (max-width: 1000px) {
    .catalog-cards-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 600px) {
    .catalog-cards-grid {
      grid-template-columns: 1fr;
    }
  }

  .catalog-b-card {
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .b-card-img {
    position: relative;
    height: 180px;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .b-card-img img {
    height: 140px;
    object-fit: contain;
  }
  .b-occasion-tag {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(255, 255, 255, 0.95);
    color: #065f46;
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: 0.72rem;
    font-weight: 700;
  }
  .b-card-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }
  .b-title {
    font-size: 1rem;
    font-weight: 800;
    color: var(--text);
    margin: 0;
  }
  .b-desc {
    font-size: 0.78rem;
    color: var(--muted);
    margin: 0;
    line-height: 1.4;
  }
  .b-recipe-tags small {
    font-size: 0.72rem;
    color: var(--muted);
    display: block;
    margin-bottom: 4px;
  }
  .chips-mini {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .chip-item {
    font-size: 0.7rem;
    background: var(--bg);
    border: 1px solid var(--line);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--text);
  }
  .b-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .b-price {
    font-size: 1.1rem;
    font-weight: 800;
    color: #065f46;
  }
  .b-active-badge {
    font-size: 0.72rem;
    color: #059669;
    font-weight: 700;
  }

  /* =========================================================================
     استعراض باقات الطلب مع الصور والتفاصيل الفنية للمنسقة
     ========================================================================= */
  .order-bouquets-showcase {
    background: #ffffff;
    border: 1.5px solid rgba(5, 150, 105, 0.25);
    border-radius: var(--radius-md);
    padding: 20px;
    margin-bottom: 24px;
    box-shadow: 0 4px 14px rgba(5, 150, 105, 0.05);
  }
  .obs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(5, 150, 105, 0.15);
    padding-bottom: 12px;
    margin-bottom: 18px;
    flex-wrap: wrap;
    gap: 10px;
  }
  .obs-title-head {
    font-size: 1.15rem;
    font-weight: 800;
    color: #065f46;
    margin: 0 0 4px 0;
  }
  .obs-subtitle {
    font-size: 0.82rem;
    color: var(--muted);
  }
  .obs-badge-status {
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    font-weight: 800;
  }
  .obs-items-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .obs-item-card {
    display: flex;
    gap: 20px;
    background: #fdfbf7;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 16px;
  }
  @media (max-width: 768px) {
    .obs-item-card {
      flex-direction: column;
    }
  }
  /* =========================================================================
     نظام استعراض زوايا الباقة الأربع للمنسقة (4-Angle Bouquet Inspector Styles)
     ========================================================================= */
  .obs-multi-angle-box {
    width: 270px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }
  @media (max-width: 860px) {
    .obs-multi-angle-box {
      width: 100%;
    }
  }

  /* 1. شريط أزرار الزوايا العلوي */
  .angle-nav-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: #f8fafc;
    padding: 4px;
    gap: 4px;
    border-bottom: 1px solid var(--line-strong);
  }
  .angle-tab-btn {
    border: none;
    background: transparent;
    padding: 7px 4px;
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--muted);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
    white-space: nowrap;
    text-align: center;
  }
  .angle-tab-btn:hover {
    color: var(--text);
    background: rgba(0,0,0,0.03);
  }
  .angle-tab-btn.active {
    background: #ffffff;
    color: #065f46;
    font-weight: 800;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(6, 95, 70, 0.15);
  }

  /* 2. مسرح عرض الزاوية */
  .angle-stage-display {
    position: relative;
    width: 100%;
    height: 220px;
    background: radial-gradient(circle at 50% 40%, #ffffff 0%, #faf8f5 80%, #f0ede5 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .angle-render-svg {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 14px rgba(0,0,0,0.08));
  }
  .angle-tag-floating {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(4px);
    color: #ffffff;
    font-size: 0.65rem;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    pointer-events: none;
  }
  .btn-zoom-angles-floating {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(4px);
    border: 1px solid var(--line-strong);
    color: #0f172a;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 5px 9px;
    border-radius: 14px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: all 0.2s ease;
  }
  .btn-zoom-angles-floating:hover {
    background: #065f46;
    color: #ffffff;
    border-color: #065f46;
  }

  /* 3. شريط المصغرات السريعة */
  .angle-thumbs-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 6px 8px;
    background: #fdfbf7;
    border-top: 1px solid var(--line-strong);
  }
  .angle-mini-thumb {
    padding: 4px 2px;
    font-size: 0.7rem;
    font-weight: 700;
    border: 1px solid var(--line-strong);
    background: #ffffff;
    border-radius: 4px;
    cursor: pointer;
    color: var(--muted);
    transition: all 0.15s ease;
    text-align: center;
  }
  .angle-mini-thumb:hover {
    border-color: #065f46;
    color: var(--text);
  }
  .angle-mini-thumb.active {
    border-color: #065f46;
    background: #ecfdf5;
    color: #065f46;
    font-weight: 800;
  }

  /* 4. شريط النصيحة الإرشادية الفنية */
  .angle-tip-strip {
    padding: 7px 10px;
    background: #f8fafc;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    font-size: 0.68rem;
    color: #475569;
    line-height: 1.35;
  }

  /* =========================================================================
     نافذة تكبير ومعاينة الزوايا الأربع (4-Angle Atelier Modal Styles)
     ========================================================================= */
  .angle-lightbox-modal-card {
    width: 95%;
    max-width: 1250px;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
  }
  .angle-modal-specs-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 12px 24px;
    background: #f8fafc;
    border-bottom: 1px solid var(--line-strong);
  }
  .spec-pill {
    background: #ffffff;
    border: 1px solid var(--line-strong);
    padding: 5px 12px;
    border-radius: 14px;
    font-size: 0.8rem;
    color: #334155;
  }
  .spec-pill b {
    color: #065f46;
  }
  .modal-4angles-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 18px;
    padding: 22px 24px;
  }
  @media (max-width: 1080px) {
    .modal-4angles-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 620px) {
    .modal-4angles-grid {
      grid-template-columns: 1fr;
    }
  }
  .angle-modal-card {
    background: #ffffff;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: 0 4px 14px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
  }
  .am-header {
    padding: 12px 14px;
    background: #fdfbf7;
    border-bottom: 1px solid var(--line-strong);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .am-badge {
    font-weight: 800;
    font-size: 0.88rem;
    color: #0f172a;
  }
  .am-header small {
    color: var(--muted);
    font-size: 0.72rem;
  }
  .am-visual {
    height: 250px;
    background: radial-gradient(circle at 50% 45%, #ffffff 0%, #faf8f5 75%, #efebe2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }
  .am-svg {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 14px rgba(0,0,0,0.1));
  }
  .am-checklist {
    padding: 14px;
    background: #ffffff;
    border-top: 1px solid var(--line-strong);
    font-size: 0.74rem;
    flex: 1;
  }
  .am-checklist b {
    display: block;
    margin-bottom: 6px;
    color: #065f46;
    font-size: 0.78rem;
  }
  .am-checklist ul {
    margin: 0;
    padding-right: 18px;
    color: #475569;
    line-height: 1.5;
  }
  .am-checklist li {
    margin-bottom: 4px;
  }
  .obs-item-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .obs-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .obs-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--text);
    margin: 0;
  }
  .obs-qty-badge {
    background: rgba(5, 150, 105, 0.1);
    color: #065f46;
    border: 1px solid rgba(5, 150, 105, 0.25);
    padding: 3px 10px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 800;
  }
  .obs-desc {
    font-size: 0.86rem;
    color: var(--muted);
    line-height: 1.5;
    margin: 0;
  }
  .obs-spec-pills {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .spec-pill {
    background: #fff;
    border: 1px solid var(--line-strong);
    padding: 3px 9px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    color: var(--text);
  }
  .spec-pill b {
    color: #065f46;
  }
  .obs-recipe-box {
    background: #fff;
    border: 1px dashed rgba(5, 150, 105, 0.3);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    margin-top: 4px;
  }
  .recipe-heading {
    display: block;
    font-size: 0.78rem;
    font-weight: 800;
    color: #065f46;
    margin-bottom: 8px;
  }
  .recipe-stems-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 8px;
  }
  .recipe-stem-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #fcfbf9;
    border: 1px solid var(--line);
    padding: 5px 8px;
    border-radius: 6px;
  }
  .stem-thumb {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    background: #fff;
    border: 1px solid var(--line);
  }
  .stem-meta {
    display: flex;
    flex-direction: column;
    font-size: 0.75rem;
  }
  .stem-meta b {
    color: var(--text);
  }
  .stem-meta small {
    color: var(--muted);
  }

  /* =========================================================================
     شريط البحث والفلاتر في الكتالوج وأزرار الإجراءات
     ========================================================================= */
  .catalog-filter-bar {
    padding: 16px 20px;
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .catalog-search-wrap {
    position: relative;
    max-width: 500px;
  }
  .btn-clear-search {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 0.88rem;
  }
  .catalog-tags-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tag-chip {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
    transition: all 0.15s;
  }
  .tag-chip:hover {
    border-color: #059669;
  }
  .tag-chip.active {
    background: #059669;
    color: #fff;
    border-color: #059669;
  }
  .b-actions-row {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .btn-edit-bouquet {
    flex: 1;
    background: #059669;
    color: #fff;
    font-weight: 800;
    padding: 8px 12px;
    font-size: 0.86rem;
    border-radius: var(--radius-sm);
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-edit-bouquet:hover {
    background: #047857;
  }
  .btn-studio-preview {
    background: #fff;
    border: 1.5px solid #059669;
    color: #059669;
    font-weight: 800;
    padding: 8px 14px;
    font-size: 0.84rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .btn-studio-preview:hover {
    background: rgba(5, 150, 105, 0.08);
  }

  /* =========================================================================
     مودل تعديل الباقة للمنسقة
     ========================================================================= */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }
  .edit-bouquet-modal-content {
    background: #ffffff;
    width: 100%;
    max-width: 780px;
    max-height: 90vh;
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    border: 2px solid #059669;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 24px;
    background: #fdfbf7;
    border-bottom: 1px solid var(--line-strong);
  }
  .modal-header h3 {
    margin: 0 0 4px 0;
    font-size: 1.3rem;
    font-weight: 900;
    color: #065f46;
  }
  .modal-sub {
    margin: 0;
    font-size: 0.84rem;
    color: var(--muted);
  }
  .btn-close-modal {
    background: none;
    border: none;
    font-size: 1.3rem;
    color: var(--muted);
    cursor: pointer;
    padding: 4px 8px;
  }
  .modal-body-scroll {
    padding: 20px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .modal-alert.error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #f87171;
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    font-weight: 700;
    font-size: 0.88rem;
    margin: 16px 24px 0;
  }
  .edit-fields-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  .edit-fields-grid .full-width {
    grid-column: 1 / -1;
  }
  .modal-recipe-section {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: var(--radius-md);
    padding: 16px;
  }
  .recipe-section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .recipe-section-head h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
    color: var(--text);
  }
  .cost-note {
    font-size: 0.82rem;
    color: #475569;
  }
  .profit-val {
    color: #059669;
  }
  .add-inventory-stems-bar {
    margin-bottom: 14px;
  }
  .add-lbl {
    display: block;
    font-size: 0.78rem;
    font-weight: 800;
    color: #475569;
    margin-bottom: 6px;
  }
  .inv-scroll-chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 6px;
  }
  .chip-add-flower {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #fff;
    border: 1px solid var(--line-strong);
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .chip-add-flower:hover {
    border-color: #059669;
    background: rgba(5, 150, 105, 0.05);
  }
  .chip-add-flower .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .recipe-edit-table {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 240px;
    overflow-y: auto;
  }
  .empty-table-hint {
    padding: 20px;
    text-align: center;
    font-size: 0.84rem;
    color: var(--muted);
  }
  .recipe-edit-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #fff;
    border: 1px solid var(--line-strong);
    padding: 8px 12px;
    border-radius: 8px;
  }
  .f-info {
    flex: 2;
    display: flex;
    flex-direction: column;
    font-size: 0.82rem;
  }
  .f-qty-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .btn-qty {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    background: #f8fafc;
    cursor: pointer;
    font-weight: 800;
  }
  .qty-display {
    font-weight: 800;
    min-width: 24px;
    text-align: center;
    font-size: 0.88rem;
  }
  .f-notes-field {
    flex: 2;
  }
  .input-mini {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    font-size: 0.76rem;
  }
  .f-subtotal {
    font-weight: 800;
    font-size: 0.84rem;
    min-width: 65px;
    text-align: left;
    color: #065f46;
  }
  .btn-del-row {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-weight: 800;
    padding: 4px;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    background: #fdfbf7;
    border-top: 1px solid var(--line-strong);
  }

  .loading-state, .empty-state {
    padding: 60px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
  }
  .empty-icon {
    font-size: 2.5rem;
  }
</style>
