/* =========================================================
   مسكة — Maska | سكربت مشترك مع الدارك مود، الترانزاكشن الدائري، والتفاعلات الفاخرة
   ========================================================= */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = n => `${n} د.ل`;

/* =========================================================
   1. نظام الدارك مود وترانزاكشن الدائرة المنبثقة من الزر
      (Dark Mode with Circular Reveal Transition)
   ========================================================= */
const THEME_KEY = 'maska-theme';

// تطبيق الثيم فورياً قبل اكتمال التحميل لمنع الوميض الأبيض
(function applyThemeEarly() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
})();

function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

// دالة التبديل مع الترانزاكشن الدائري المنبثق من الزر
function toggleThemeWithCircularTransition(e) {
  const current = getTheme();
  const nextTheme = current === 'dark' ? 'light' : 'dark';

  // الحصول على إحداثيات مركز زر التبديل بدقة
  const btn = (e && e.currentTarget) || $('.theme-toggle-btn');
  let x, y;
  if (btn && btn.getBoundingClientRect) {
    const rect = btn.getBoundingClientRect();
    x = e && typeof e.clientX === 'number' && e.clientX > 0 ? e.clientX : rect.left + rect.width / 2;
    y = e && typeof e.clientY === 'number' && e.clientY > 0 ? e.clientY : rect.top + rect.height / 2;
  } else if (e && typeof e.clientX === 'number') {
    x = e.clientX;
    y = e.clientY;
  } else {
    x = window.innerWidth / 2;
    y = 50;
  }

  // حساب أطول مسافة (نصف القطر الأقصى) لتغطية كامل الشاشة حتى أبعد زاوية
  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  // إذا كان المتصفح يدعم View Transitions API
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('theme-transitioning');

    const transition = document.startViewTransition(() => {
      applyTheme(nextTheme);
    });

    transition.ready.then(() => {
      const clipAnimation = document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 650,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );

      clipAnimation.finished.finally(() => {
        document.documentElement.classList.remove('theme-transitioning');
      });
    }).catch(() => {
      document.documentElement.classList.remove('theme-transitioning');
    });
  } else {
    // بديل فائق النعومة للمتصفحات التي لا تدعم View Transitions
    createCircularRippleFallback(x, y, maxRadius, nextTheme);
  }

  toast(nextTheme === 'dark' ? 'تم تفعيل الوضع الليلي' : 'تم تفعيل الوضع النهاري');
}

// البديل الدائري المتوسع للمتصفحات الأخرى
function createCircularRippleFallback(x, y, maxRadius, nextTheme) {
  const ripple = document.createElement('div');
  const bg = nextTheme === 'dark' ? '#10140b' : '#fcf8f6';
  Object.assign(ripple.style, {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    width: `${maxRadius * 2}px`,
    height: `${maxRadius * 2}px`,
    borderRadius: '50%',
    background: bg,
    transform: 'translate(-50%, -50%) scale(0)',
    zIndex: '999998',
    pointerEvents: 'none',
    transition: 'transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1)'
  });
  document.body.appendChild(ripple);

  requestAnimationFrame(() => {
    ripple.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  setTimeout(() => {
    applyTheme(nextTheme);
    ripple.style.transition = 'opacity 0.25s ease';
    ripple.style.opacity = '0';
    setTimeout(() => ripple.remove(), 260);
  }, 480);
}

// أيقونات الشمس والقمر
const themeToggleSvg = `
  <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
  <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
`;

function setupThemeButtons() {
  // إضافة الزر للهيدر تلقائياً إن لم يكن موجوداً
  const headerActions = $('.header-actions');
  if (headerActions && !$('.theme-toggle-btn', headerActions)) {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle-btn';
    btn.setAttribute('aria-label', 'تبديل الوضع الليلي');
    btn.setAttribute('title', 'تبديل الوضع الليلي');
    btn.innerHTML = themeToggleSvg;
    headerActions.prepend(btn);
  }

  // إضافة الزر للوحة تحكم المدير إن وُجدت
  const adminTools = $('.topbar .tools');
  if (adminTools && !$('.theme-toggle-btn', adminTools)) {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle-btn';
    btn.setAttribute('aria-label', 'تبديل الوضع الليلي');
    btn.setAttribute('title', 'تبديل الوضع الليلي');
    btn.innerHTML = themeToggleSvg;
    adminTools.prepend(btn);
  }

  // ربط أحداث النقر
  $$('.theme-toggle-btn').forEach(b => {
    b.onclick = (e) => toggleThemeWithCircularTransition(e);
  });
}

/* =========================================================
   2. نظام الانتقال السلس بين الصفحات (Page-to-Page Transitions)
   ========================================================= */
(function initPageTransitions() {
  let progressBar = $('#page-progress-bar');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.id = 'page-progress-bar';
    document.documentElement.appendChild(progressBar);
  }

  function enterPage() {
    document.body.classList.remove('page-exiting');
    document.body.classList.add('page-ready');
    if (progressBar) {
      progressBar.style.width = '100%';
      setTimeout(() => {
        progressBar.classList.remove('active');
        progressBar.style.width = '0%';
      }, 350);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('page-entering');
      requestAnimationFrame(() => setTimeout(enterPage, 40));
    });
  } else {
    document.body.classList.add('page-entering');
    requestAnimationFrame(() => setTimeout(enterPage, 40));
  }

  window.addEventListener('pageshow', () => {
    document.body.classList.remove('page-exiting');
    document.body.classList.add('page-ready');
    if (progressBar) {
      progressBar.classList.remove('active');
      progressBar.style.width = '0%';
    }
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    if (
      link.target === '_blank' ||
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) return;

    if (href.startsWith('#')) {
      if (href.length > 1) {
        const target = $(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      return;
    }

    const url = new URL(link.href, window.location.href);
    const isSamePageAnchor = (url.pathname === window.location.pathname && url.hash);
    if (isSamePageAnchor) return;

    e.preventDefault();
    if (progressBar) {
      progressBar.classList.add('active');
      progressBar.style.width = '25%';
      requestAnimationFrame(() => {
        progressBar.style.width = '78%';
      });
    }

    document.body.classList.add('page-exiting');

    setTimeout(() => {
      window.location.href = link.href;
    }, 220);
  });
})();

/* =========================================================
   3. ظهور العناصر عند التمرير والقائمة الجانبية للموبايل
   ========================================================= */
(function initScrollAndMobile() {
  function setup() {
    setupThemeButtons();
    initQuickViewModal();
    initProductFilters();
    initFAQ();
    initTrackTimeline();

    // إعداد القائمة الجانبية للشاشات الصغيرة (Mobile Drawer)
    setupMobileDrawer();
  }

  function setupMobileDrawer() {
    let overlay = $('.mobile-drawer-overlay');
    let drawer = $('.mobile-drawer');

    if (!drawer) {
      overlay = document.createElement('div');
      overlay.className = 'mobile-drawer-overlay';
      document.body.appendChild(overlay);

      drawer = document.createElement('div');
      drawer.className = 'mobile-drawer';
      drawer.innerHTML = `
        <div class="mobile-drawer-head">
          <a href="index.html" class="logo"><b>MASKA</b><small>مسكة</small></a>
          <button class="mobile-drawer-close" aria-label="إغلاق">&times;</button>
        </div>
        <nav class="mobile-drawer-nav">
          <a href="index.html">الرئيسية <span>←</span></a>
          <a href="index.html#bouquets">الباقات <span>←</span></a>
          <a href="studio.html">صمّم باقتك <span>←</span></a>
          <a href="designer.html">المصمم الذكي <span>←</span></a>
          <a href="track.html">تتبع الطلب <span>←</span></a>
          <a href="cart.html">السلة <span>←</span></a>
          <a href="login.html">تسجيل الدخول <span>←</span></a>
        </nav>
      `;
      document.body.appendChild(drawer);
    }

    const headerContainer = $('.header .container');
    if (headerContainer && !$('.mobile-menu-btn', headerContainer)) {
      const menuBtn = document.createElement('button');
      menuBtn.className = 'mobile-menu-btn';
      menuBtn.setAttribute('aria-label', 'فتح القائمة');
      menuBtn.innerHTML = '<span></span><span></span><span></span>';
      headerContainer.appendChild(menuBtn);

      const toggleMenu = (open) => {
        menuBtn.classList.toggle('open', open);
        overlay.classList.toggle('active', open);
        drawer.classList.toggle('active', open);
      };

      menuBtn.onclick = () => toggleMenu(!drawer.classList.contains('active'));
      overlay.onclick = () => toggleMenu(false);
      const closeBtn = $('.mobile-drawer-close', drawer);
      if (closeBtn) closeBtn.onclick = () => toggleMenu(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

/* =========================================================
   نافذة المعاينة السريعة التفاعلية للباقات (Quick View Modal)
   ========================================================= */
const bouquetDetails = {
  'ربيع وردي': {
    title: 'ربيع وردي',
    price: 64,
    tag: 'عيد ميلاد',
    desc: 'باقة مفعمة بالبهجة والحيوية تجمع بين ورود الجوري الزاهية والتوليب النضر مع لمسات الجبسوفيلا البيضاء.',
    flowers: ['8 وردات جوري وردية طبيعية', '4 زهرات توليب هولندية', 'أغصان جبسوفيلا بيضاء ناعمة', 'ورق تغليف كرافت فاخر مع شريط ساتان'],
    tips: 'قص أطراف السيقان بزاوية 45° وغيّر الماء يومياً مع تجنب أشعة الشمس المباشرة.'
  },
  'أناقة العاج': {
    title: 'أناقة العاج',
    price: 78,
    tag: 'زفاف وخطوبة',
    desc: 'تناغم ملكي يفيض بالنقاء والصفاء، مصمم خصيصاً لمناسبات الزفاف والخطوبة الفاخرة.',
    flowers: ['10 وردات جوري عاجية ملكية', '6 زهرات توليب بيضاء نقية', 'أغصان أوكالبتوس مريمية عطرة', 'غلاف حريري أبيض مع شريط مذهب'],
    tips: 'يُفضل وضع الباقة في مكان بارد وتجديد الماء البارد صباح كل يوم.'
  },
  'همسة المريمي': {
    title: 'همسة المريمي',
    price: 92,
    tag: 'شكر وامتنان',
    desc: 'مزيج هادئ وأنيق من درجات الخوخي والوردي العتيق، يعبّر عن أسمى مشاعر الامتنان والتقدير.',
    flowers: ['12 وردة جوري مريمية وخوخية', '5 أزهار كارنيشن فاخرة', 'أغصان أوكالبتوس مستوردة', 'تغليف قماشي بلون مريمي هادئ'],
    tips: 'رش البتلات برذاذ ماء خفيف صباحاً للحفاظ على نضارتها القصوى.'
  },
  'الباقة الملكية': {
    title: 'الباقة الملكية',
    price: 120,
    tag: 'تخرج ونجاح',
    desc: 'باقة ضخمة ومهيبة تليق بمناسبات التخرج والإنجازات الكبرى، مُنسقة بأسلوب ملكي استثنائي.',
    flowers: ['18 وردة جوري فاخرة منتقاة بعناية', '8 زهرات توليب مستوردة', 'تشكيلة خضار وزهور مجففة نادرة', 'تغليف ملكي مع شريط مخملي فاخر'],
    tips: 'أضف غذاء الزهور المرفق في الماء للحفاظ على تألقها لأكثر من 10 أيام.'
  }
};

function initQuickViewModal() {
  let overlay = $('.quick-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'quick-modal-overlay';
    overlay.innerHTML = `
      <div class="quick-modal">
        <button class="quick-modal-close" aria-label="إغلاق">&times;</button>
        <div class="quick-modal-art">
          <img src="assets/bouquet.svg" alt="تفاصيل الباقة">
        </div>
        <div class="quick-modal-body">
          <div>
            <span class="badge badge-pink m-tag" style="margin-bottom:10px"></span>
            <h2 class="m-title"></h2>
            <p class="desc m-desc"></p>
            <h4 style="font-size:14px; color:var(--olive); margin-bottom:8px; font-weight:800">مكونات الباقة الطبيعية:</h4>
            <ul class="meta-list m-flowers"></ul>
            <div class="note" style="margin-bottom:20px; font-size:12.5px">
              <b> نصيحة الخبير:</b> <span class="m-tips"></span>
            </div>
          </div>
          <div class="foot" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--line); padding-top:18px">
            <span class="price m-price" style="font-size:22px"></span>
            <button class="btn btn-primary m-add">أضف للسلة الآن</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.onclick = e => {
      if (e.target === overlay || e.target.closest('.quick-modal-close')) {
        overlay.classList.remove('active');
      }
    };
  }

  const bouquetImages = {
    'ربيع وردي': 'assets/bouquet-pink-spring.svg',
    'أناقة العاج': 'assets/bouquet-ivory-elegance.svg',
    'همسة المريمي': 'assets/bouquet-sage-whisper.svg',
    'الباقة الملكية': 'assets/bouquet-royal.svg'
  };

  $$('.product').forEach(card => {
    const titleEl = $('h3', card);
    if (!titleEl) return;
    const name = titleEl.textContent.trim();
    const box = $('.bouquet-box', card);
    if (box) {
      box.style.cursor = 'pointer';
      box.title = 'اضغط لمعاينة التفاصيل الكاملة';
      box.onclick = (e) => {
        if (e.target.closest('button')) return;
        openQuickView(name);
      };
    }
  });

  document.addEventListener('click', e => {
    const qBtn = e.target.closest('[data-quick]');
    if (qBtn) {
      e.preventDefault();
      e.stopPropagation();
      openQuickView(qBtn.dataset.quick);
    }
  });

  function openQuickView(name) {
    const data = bouquetDetails[name] || {
      title: name,
      price: 75,
      tag: 'باقة فاخرة',
      desc: 'باقة منتقاة من أجود الزهور الطبيعية المتناسقة والمغلفة بعناية تامة.',
      flowers: ['ورد طبيعي منتقى', 'خضار زينة فاخر', 'غلاف وشريط ساتان'],
      tips: 'غيّر الماء يومياً وتجنب وضعها في مسار هواء التكييف المباشر.'
    };

    $('.m-title', overlay).textContent = data.title;
    $('.m-tag', overlay).textContent = data.tag;
    $('.m-desc', overlay).textContent = data.desc;
    $('.m-price', overlay).textContent = money(data.price);
    $('.m-tips', overlay).textContent = data.tips;

    const imgEl = $('.quick-modal-art img', overlay);
    if (imgEl) {
      imgEl.src = bouquetImages[name] || 'assets/bouquet.svg';
      imgEl.alt = data.title;
    }

    const list = $('.m-flowers', overlay);
    list.innerHTML = data.flowers.map(f => `<li>${f}</li>`).join('');

    const addBtn = $('.m-add', overlay);
    addBtn.onclick = () => {
      addToCart({ name: data.title, price: data.price, desc: 'باقة جاهزة' });
      overlay.classList.remove('active');
    };

    overlay.classList.add('active');
  }
}

/* =========================================================
   مفرقعات واحتفال تأكيد الطلب (Floral Confetti Burst)
   ========================================================= */
function celebrateFloralConfetti() {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '999999',
    overflow: 'hidden'
  });
  document.body.appendChild(container);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { container.remove(); return; }
  const tones = ['#c9677c', '#e8b4bf', '#5b6a2e', '#a3ad6c', '#f1e4d6'];
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    const s = Math.random() * 6 + 7;
    el.style.width = `${s}px`;
    el.style.height = `${s * 1.4}px`;
    el.style.borderRadius = '60% 0 60% 0';
    el.style.background = tones[i % tones.length];
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2 + 80;
    const destX = (Math.random() - 0.5) * window.innerWidth * 0.85;
    const destY = -Math.random() * 380 - 80;
    const rot = (Math.random() - 0.5) * 720;
    const scale = Math.random() * 0.8 + 0.6;

    Object.assign(el.style, {
      position: 'absolute',
      left: `${startX}px`,
      top: `${startY}px`,
      transform: 'translate(-50%, -50%) scale(0)',
      transition: 'transform 0.85s cubic-bezier(0.12, 0.8, 0.32, 1), opacity 0.85s ease-in',
      opacity: '1'
    });
    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate(${destX}px, ${destY}px) rotate(${rot}deg) scale(${scale})`;
    });
  }

  setTimeout(() => {
    container.style.transition = 'opacity 0.4s';
    container.style.opacity = '0';
    setTimeout(() => container.remove(), 400);
  }, 950);
}

/* =========================================================
   تصفية الباقات التفاعلية (Product Category Filter)
   ========================================================= */
function initProductFilters() {
  const filterBtns = $$('.filter-btn');
  const products = $$('.products .product');
  if (!filterBtns.length || !products.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      products.forEach(p => {
        const cat = p.dataset.category;
        if (filter === 'all' || cat === filter) {
          p.classList.remove('is-filtered-out');
          p.style.animation = 'none';
          void p.offsetWidth;
          p.style.animation = 'fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
        } else {
          p.classList.add('is-filtered-out');
        }
      });
    });
  });
}

/* =========================================================
   الأسئلة الشائعة الأكورديون (FAQ Accordion Interaction)
   ========================================================= */
function initFAQ() {
  const items = $$('.faq-item');
  items.forEach(item => {
    const q = item.querySelector('.faq-question');
    if (!q) return;
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('active');
      items.forEach(other => other.classList.remove('active'));
      if (!isOpen) {
        item.classList.add('active');
      }
    });
  });
}

/* =========================================================
   محاكاة مسار تتبع الطلب التفاعلي (Interactive Track Timeline)
   ========================================================= */
function initTrackTimeline() {
  const steps = $$('.timeline li');
  if (!steps.length) return;

  const statusBadge = $('.status-head .badge');
  const statusTexts = [
    'تم تأكيد الطلب — بانتظار بدء التنسيق في الاستوديو',
    'الوصول المتوقع: اليوم خلال ساعتين',
    'المندوب في الطريق إليك — الوصول المتوقع خلال 25 دقيقة',
    'تم تسليم الطلب بالكامل بنجاح للمستلم'
  ];

  steps.forEach((step, idx) => {
    step.style.cursor = 'pointer';
    step.setAttribute('title', 'انقر لمحاكاة هذه المرحلة من الطلب');

    step.addEventListener('click', () => {
      steps.forEach((s, i) => {
        s.classList.remove('done', 'current');
        if (i < idx) {
          s.classList.add('done');
        } else if (i === idx) {
          if (idx === steps.length - 1) {
            s.classList.add('done');
            celebrateFloralConfetti();
            toast('مبارك! تم تسليم باقة الزهور بنجاح');
          } else {
            s.classList.add('current');
            const stepTitle = s.querySelector('h4')?.textContent || 'المرحلة';
            toast(`تم تحديث حالة الطلب إلى: ${stepTitle}`);
          }
        }
      });

      if (statusBadge && statusTexts[idx]) {
        statusBadge.textContent = statusTexts[idx];
      }
    });
  });
}

/* =========================================================
   4. تموج الأزرار وتأثير حركة الهيدر
   ========================================================= */
window.addEventListener('scroll', () => {
  const header = $('.header');
  if (header) {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }
}, { passive: true });


/* =========================================================
   5. إدارة السلة وإشعار التنبيه
   ========================================================= */
const CART_KEY = 'maska-cart';
const defaultCart = [
  { name: 'باقة مخصصة', desc: 'غلاف كرافت وشريط وردي', price: 86, qty: 1 },
  { name: 'ربيع وردي', desc: 'باقة جاهزة', price: 64, qty: 1 },
];

function getCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(saved) ? saved : defaultCart.map(i => ({ ...i }));
  } catch {
    return defaultCart.map(i => ({ ...i }));
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {}
  updateCartCount();
}

function addToCart(item) {
  const cart = getCart();
  const found = cart.find(i => i.name === item.name && i.price === item.price);
  if (found) found.qty += 1;
  else cart.push({ ...item, qty: 1 });
  saveCart(cart);
  toast(`تمت إضافة «${item.name}» إلى السلة بنجاح`);
}

function updateCartCount() {
  const count = getCart().reduce((s, i) => s + i.qty, 0);
  $$('[data-cart-count]').forEach(el => {
    el.textContent = count;
    el.classList.remove('cart-bump');
    void el.offsetWidth;
    el.classList.add('cart-bump');
  });
}

function toast(msg) {
  let t = $('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--lime-dark)">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
    <span>${msg}</span>
  `;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => {
    t.classList.remove('show');
  }, 2600);
}

$$('[data-add]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    addToCart(JSON.parse(btn.dataset.add));
    btn.style.transform = 'scale(0.92)';
    setTimeout(() => { btn.style.transform = ''; }, 180);
  });
});

$$('.chips').forEach(group => {
  group.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (group.dataset.group === 'single') {
      $$('.chip', group).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    } else {
      chip.classList.toggle('active');
    }
    group.dispatchEvent(new CustomEvent('chipchange', { bubbles: true }));
  });
});

$$('.swatches').forEach(g => {
  g.addEventListener('click', e => {
    const s = e.target.closest('.swatch');
    if (!s) return;
    $$('.swatch', g).forEach(x => x.classList.remove('active'));
    s.classList.add('active');
  });
});

updateCartCount();

/* =========================================================
   6. استوديو التصميم ودوران الباقة 360 التفاعلي بالسحب
   ========================================================= */
if ($('#studio')) {
  const WRAP_PRICE = 10;
  const params = new URLSearchParams(location.search);
  if (params.get('occasion')) $('#occasion').value = params.get('occasion');

  function renderStudio() {
    let flowersTotal = 0, count = 0;
    $$('.flower-row').forEach(row => {
      const q = +$('.qty span', row).textContent;
      const p = +row.dataset.price;
      $('.line-price', row).textContent = money(q * p);
      flowersTotal += q * p;
      count += q;
      row.style.background = q > 0 ? 'var(--card-hover)' : 'transparent';
    });
    const total = flowersTotal + WRAP_PRICE;
    const budget = Math.max(+$('#budget').value || 0, 0);
    $('#sum-flowers-label').textContent = `الورد (${count} زهرة)`;
    $('#sum-flowers').textContent = money(flowersTotal);
    $('#sum-total').textContent = money(total);
    $('#budget-label').textContent = money(budget);
    $('#used-label').textContent = money(total);
    $('#add-studio').textContent = `أضف إلى السلة — ${money(total)}`;

    const pct = budget ? Math.min(total / budget * 100, 100) : 100;
    const bar = $('#budget-bar');
    if (bar) {
      bar.style.width = pct + '%';
      bar.classList.toggle('over', total > budget);
    }
    $('#used-label').classList.toggle('over', total > budget);
  }

  $$('.flower-row').forEach(row => {
    $('.plus', row).onclick = () => {
      const s = $('.qty span', row);
      s.textContent = +s.textContent + 1;
      renderStudio();
    };
    $('.minus', row).onclick = () => {
      const s = $('.qty span', row);
      s.textContent = Math.max(0, +s.textContent - 1);
      renderStudio();
    };
  });
  $('#budget').addEventListener('input', renderStudio);

  $$('.view-toggle button').forEach(b => {
    b.onclick = () => {
      $$('.view-toggle button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const img = $('.preview img');
      if (img) img.classList.toggle('flat', b.dataset.view === '2d');
    };
  });

  // ميزة الدوران التفاعلي 360° بالسحب بالفأرة أو باللمس
  const preview = $('.preview');
  if (preview) {
    preview.classList.add('draggable');
    let isDragging = false;
    let startX = 0;
    let currentRotation = 0;
    const img = $('img', preview);
    const badge360 = $('.b360', preview);

    const onStart = (clientX) => {
      isDragging = true;
      startX = clientX;
      preview.classList.add('dragging');
      if (img) img.style.animation = 'none';
    };

    const onMove = (clientX) => {
      if (!isDragging || !img) return;
      const deltaX = clientX - startX;
      currentRotation += deltaX * 0.7;
      startX = clientX;
      img.style.transform = `rotateY(${currentRotation}deg) scale(1.04)`;
      if (badge360) {
        const normAngle = ((Math.round(currentRotation) % 360) + 360) % 360;
        badge360.textContent = `${normAngle}°`;
      }
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      preview.classList.remove('dragging');
    };

    preview.addEventListener('mousedown', e => onStart(e.clientX));
    window.addEventListener('mousemove', e => onMove(e.clientX));
    window.addEventListener('mouseup', onEnd);

    preview.addEventListener('touchstart', e => onStart(e.touches[0].clientX), { passive: true });
    window.addEventListener('touchmove', e => onMove(e.touches[0].clientX), { passive: true });
    window.addEventListener('touchend', onEnd);
  }

  const giftInput = $('#gift-message-input');
  const waxText = $('#wax-card-text');
  if (giftInput && waxText) {
    giftInput.addEventListener('input', () => {
      const val = giftInput.value.trim();
      waxText.textContent = val ? `"${val}"` : `"أجمل اللحظات هي التي تبدأ بوردة صادقة… كل عام وأنت بألف خير وسعادة."`;
    });
  }

  $('#add-studio').onclick = () => {
    const total = +$('#sum-total').textContent.replace(/[^\d]/g, '');
    const wrap = $('#wrap-chips .active')?.textContent.trim() || 'ورق كرافت';
    addToCart({ name: 'باقة مخصصة', desc: `غلاف ${wrap}`, price: total });
  };
  renderStudio();
}

/* =========================================================
   7. صفحة المصمم الذكي مع محاكاة خطوات التوليد الفوري
   ========================================================= */
if ($('#designer')) {
  const stock = [
    { name: 'وردة جورية وردية', price: 4, color: 'وردي', available: true },
    { name: 'توليب أبيض', price: 5, color: 'أبيض', available: true },
    { name: 'جبسوفيلا', price: 5, color: 'أبيض', available: true },
    { name: 'فاوانيا', price: 9, color: 'وردي', available: false },
    { name: 'وردة حمراء', price: 5, color: 'أحمر', available: true },
    { name: 'أوكالبتوس', price: 3, color: 'أخضر', available: true },
  ];
  const WRAP = 14;

  const quickChips = $('#quick-chips');
  if (quickChips) {
    quickChips.addEventListener('chipchange', () => {
      const occ = $('#quick-chips .active')?.dataset.value;
      if (occ && $('#d-occasion')) $('#d-occasion').value = occ;
    });
  }

  function suggest() {
    const text = $('#prompt').value;
    let budget = +$('#d-budget').value || 0;
    const m = text.match(/(\d+)\s*د/);
    if (m) {
      budget = +m[1];
      $('#d-budget').value = budget;
    }

    const wantsRed = /أحمر|حمراء/.test(text);
    const base = wantsRed
      ? [stock[4], stock[1], stock[2]]
      : [stock[0], stock[1], stock[2]];

    const left = Math.max(budget - WRAP, 0);
    const ratios = [0.45, 0.35, 0.2];
    let items = base.map((f, i) => {
      const q = Math.max(1, Math.floor(left * ratios[i] / f.price));
      return { ...f, q, total: q * f.price };
    });
    let total = items.reduce((s, i) => s + i.total, 0) + WRAP;
    while (total > budget && items.some(i => i.q > 1)) {
      const it = items.reduce((a, b) => (a.total > b.total ? a : b));
      it.q--;
      it.total = it.q * it.price;
      total -= it.price;
    }

    const list = $('#suggest-list');
    if (list) {
      list.innerHTML = items.map(i =>
        `<div class="row"><span class="k">${i.name} × ${i.q}</span><span>${money(i.total)}</span></div>`
      ).join('') + `<div class="row"><span class="k">غلاف وشريط</span><span>${money(WRAP)}</span></div>`;
    }

    $('#suggest-total').textContent = money(total);
    const within = $('#within');
    if (within) {
      within.textContent = total <= budget ? 'ضمن الميزانية' : 'أعلى من الميزانية';
      within.className = 'badge ' + (total <= budget ? 'badge-lime' : 'badge-pink');
    }

    const missing = /فاوانيا/.test(text) || !wantsRed;
    const swapNote = $('#swap-note');
    if (swapNote) swapNote.style.display = missing ? '' : 'none';

    const occ = $('#d-occasion')?.value || 'مناسبتك';
    const giftMsg = $('#gift-msg');
    if (giftMsg) {
      giftMsg.textContent = `«كل عام وأنتِ بخير… باقة صغيرة تحمل لكِ كل الحب في ${occ}.»`;
    }
    const dAdd = $('#d-add');
    if (dAdd) dAdd.dataset.price = total;
  }

  const designBtn = $('#design-btn');
  if (designBtn) {
    designBtn.onclick = e => {
      e.preventDefault();
      // محاكاة سريعة وجميلة لتفكير الذكاء الاصطناعي
      designBtn.disabled = true;
      const originalText = designBtn.textContent;
      designBtn.textContent = 'جاري تحليل الوصف وتنسيق الباقة…';
      setTimeout(() => {
        suggest();
        designBtn.disabled = false;
        designBtn.textContent = originalText;
        toast('تم تصميم واقتراح الباقة المثالية بنجاح');
      }, 650);
    };
  }

  const dAdd = $('#d-add');
  if (dAdd) {
    dAdd.onclick = () => {
      addToCart({ name: 'باقة مقترحة', desc: 'من المصمم الذكي', price: +dAdd.dataset.price || 96 });
    };
  }
  suggest();
}

/* =========================================================
   8. السلة، تتبع الطلب، وتسجيل الدخول
   ========================================================= */
if ($('#cart')) {
  const DELIVERY = 10;
  let discount = 15;

  function renderCart() {
    const cart = getCart();
    const list = $('#cart-items');
    list.innerHTML = cart.length ? cart.map((i, idx) => `
      <div class="cart-item">
        <div class="thumb"><img src="assets/bouquet.svg" alt=""></div>
        <div class="meta"><h4>${i.name}</h4><small>${i.desc || ''}</small></div>
        <span class="price">${money(i.price * i.qty)}</span>
        <div class="qty">
          <button class="plus" data-i="${idx}" data-d="1">+</button><span>${i.qty}</span><button class="minus" data-i="${idx}" data-d="-1">−</button>
        </div>
      </div>`).join('') : '<p class="empty">السلة فارغة — <a href="index.html#bouquets" class="link-pink">تصفّح الباقات</a></p>';

    const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const disc = cart.length ? discount : 0;
    $('#c-sub').textContent = money(sub);
    $('#c-disc').textContent = disc ? `−${disc} د.ل` : '0 د.ل';
    $('#c-del').textContent = money(cart.length ? DELIVERY : 0);
    $('#c-total').textContent = money(Math.max(sub - disc + (cart.length ? DELIVERY : 0), 0));
  }

  $('#cart-items').addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const cart = getCart();
    const it = cart[+b.dataset.i];
    it.qty += +b.dataset.d;
    if (it.qty <= 0) cart.splice(+b.dataset.i, 1);
    saveCart(cart);
    renderCart();
  });

  const applyCoupon = $('#apply-coupon');
  if (applyCoupon) {
    applyCoupon.onclick = () => {
      const code = $('#coupon').value.trim().toUpperCase();
      if (code === 'MASKA15') { discount = 15; toast('تم تطبيق خصم 15 د.ل بنجاح'); }
      else if (code === 'MASKA20') { discount = 20; toast('تم تطبيق خصم 20 د.ل بنجاح'); }
      else { toast('كود الخصم غير صحيح، جرّب MASKA15'); }
      renderCart();
    };
  }

  const confirmBtn = $('#confirm');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const required = $$('#delivery-form [required]');
      const empty = required.filter(f => !f.value.trim());
      required.forEach(f => f.classList.toggle('error', !f.value.trim()));
      if (empty.length) {
        toast('رجاءً أكمل بيانات التسليم المطلوبة');
        return;
      }
      if (!getCart().length) {
        toast('السلة فارغة، أضف باقة أولاً');
        return;
      }
      celebrateFloralConfetti();
      toast('تم تأكيد طلبك بنجاح! جاري تحويلك لشاشة التتبع');
      saveCart([]);
      setTimeout(() => {
        location.href = 'track.html?order=1048';
      }, 1100);
    };
  }
  renderCart();
}

if ($('#track')) {
  const params = new URLSearchParams(location.search);
  if (params.get('order') && $('#order-no')) {
    $('#order-no').value = params.get('order');
  }

  const trackForm = $('#track-form');
  if (trackForm) {
    trackForm.onsubmit = e => {
      e.preventDefault();
      const n = $('#order-no').value.replace(/[^\d]/g, '') || '1048';
      const dOrder = $('#d-order');
      if (dOrder) dOrder.textContent = '#' + n;
      toast(`عرض حالة الطلب #${n}`);
    };
  }
}

if ($('#login-form')) {
  $('#login-form').onsubmit = e => {
    e.preventDefault();
    const email = $('#email').value.trim();
    if (!email.includes('@')) {
      toast('أدخل بريداً إلكترونياً صحيحاً');
      return;
    }
    toast('تم تسجيل الدخول بنجاح! مرحباً بك');
    setTimeout(() => {
      location.href = email.startsWith('admin') ? 'admin.html' : 'index.html';
    }, 700);
  };
}
