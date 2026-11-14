<script>
  import { onMount } from 'svelte';
  import { router } from '../stores/router.js';
  import { cart } from '../stores/cart.js';
  import { api } from '../lib/api.js';

  let activeFilter = 'all';
  let trackInput = '';
  let faqOpenIndex = 0;
  let toastMessage = '';
  let toastTimer = null;

  // الباقات الجاهزة
  let readyBouquets = [
    {
      id: 'b-1',
      bouquetId: 1,
      title: 'ربيع وردي',
      price: 64,
      category: 'عيد ميلاد',
      tag: 'عيد ميلاد',
      badge: 'الأكثر طلباً',
      badgeClass: 'badge-pink',
      image: '/assets/bouquet-pink-spring.svg',
      desc: 'توليفة بديعة من الجوري الوردي وأغصان الجيبسوفيلا الهادئة ملفوفة بورق كرافت ملكي',
      flowers: [
        { flower_name: 'وردة جورية وردية', quantity_stems: 10 },
        { flower_name: 'توليب أبيض نقي', quantity_stems: 5 },
        { flower_name: 'جبسوفيلا ناعمة', quantity_stems: 3 }
      ],
      total_stems: 18
    },
    {
      id: 'b-2',
      bouquetId: 2,
      title: 'أناقة العاج',
      price: 78,
      category: 'زفاف',
      tag: 'زفاف وخطوبة',
      badge: 'فاخرة',
      badgeClass: 'badge-lime',
      image: '/assets/bouquet-ivory-elegance.svg',
      desc: 'ورود الأوركيد البيضاء مع زنابق الليلي العاجية وشريط ساتان عاجي مذهب',
      flowers: [
        { flower_name: 'توليب أبيض نقي', quantity_stems: 12 },
        { flower_name: 'فاوانيا ملكية فاخرة', quantity_stems: 6 },
        { flower_name: 'أغصان أوكالبتوس مريمية', quantity_stems: 4 }
      ],
      total_stems: 22
    },
    {
      id: 'b-3',
      bouquetId: 3,
      title: 'همسة المريمي',
      price: 92,
      category: 'شكر',
      tag: 'شكر وامتنان',
      badge: 'مميزة',
      badgeClass: 'badge-lime',
      image: '/assets/bouquet-sage-whisper.svg',
      desc: 'تناغم فريد بين خضار المريمية وزهور التوليب الناعمة مع بطاقة شمعية أنيقة',
      flowers: [
        { flower_name: 'وردة جورية وردية', quantity_stems: 8 },
        { flower_name: 'توليب أبيض نقي', quantity_stems: 6 },
        { flower_name: 'أغصان أوكالبتوس مريمية', quantity_stems: 6 }
      ],
      total_stems: 20
    },
    {
      id: 'b-4',
      bouquetId: 4,
      title: 'الباقة الملكية',
      price: 120,
      category: 'تخرج',
      tag: 'تخرج ونجاح',
      badge: 'ملكية',
      badgeClass: 'badge-pink',
      image: '/assets/bouquet-royal.svg',
      desc: 'باقة ملكية مهيبة مفعمة بالجوري الهولندي الأحمر المخملي مع ختم شمعي قرمزي',
      flowers: [
        { flower_name: 'وردة جورية حمراء', quantity_stems: 18 },
        { flower_name: 'فاوانيا ملكية فاخرة', quantity_stems: 8 },
        { flower_name: 'جبسوفيلا ناعمة', quantity_stems: 5 }
      ],
      total_stems: 31
    }
  ];

  // التقييمات
  let reviews = [];
  let loadingReviews = true;

  // تقييم جديد
  let showReviewModal = false;
  let newReview = {
    customerName: '',
    rating: 5,
    comment: '',
    bouquetType: 'باقة جاهزة'
  };
  let reviewSubmitting = false;

  // المقترحات
  let feedback = {
    name: '',
    phone: '',
    subject: '',
    message: ''
  };
  let feedbackSubmitting = false;
  let feedbackSent = false;

  onMount(async () => {
    try {
      const res = await api.getReviews(true);
      if (res && res.data && res.data.length > 0) {
        reviews = res.data;
      } else {
        // Fallback reviews
        reviews = [
          {
            id: 'r1',
            customer_name: 'سارة الورفلي',
            city_name: 'طرابلس',
            rating: 5,
            comment: 'طلبت باقة ربيع وردي لعيد ميلاد أختي، التغليف اليدوي والكرت المكتوب بخط أنيق مع الختم الشمعي خلى المفاجأة استثنائية! والورد قعد نضر ومفتح أكثر من 12 يوم.',
            bouquet_type: 'ربيع وردي',
            admin_reply: 'ألف صحة وعافية يا سارة! سعداء جداً بمشاركتكم هذه اللحظة الدافئة 🌸'
          },
          {
            id: 'r2',
            customer_name: 'م. أسامة التاجوري',
            city_name: 'بنغازي',
            rating: 5,
            comment: 'فكرة المصمم الذكي اختصرت عليّ ساعات من التفكير. حددت ميزانيتي والمناسبة واقترحلي توليفة زهور وتنسيق أفخم مما تخيلت، والتوصيل كان في الموعد بالدقيقة.',
            bouquet_type: 'تصميم ذكي مخصص',
            admin_reply: 'شهادة نعتز بها أستاذ أسامة، ونسعد دائماً بخدمتكم في بنغازي الحبيبة.'
          },
          {
            id: 'r3',
            customer_name: 'نور الهدى القماطي',
            city_name: 'مصراتة',
            rating: 5,
            comment: 'باقة أناقة العاج في يوم عقد قراني كانت حديث كل الحاضرين في الصالة! لمسة زهور التوليب البيضاء مع شريط الساتان راقية جداً وذوق لا يوصف.',
            bouquet_type: 'أناقة العاج',
            admin_reply: null
          }
        ];
      }
    } catch (e) {
      console.log('Using default reviews');
    } finally {
      loadingReviews = false;
    }

    try {
      const bRes = await api.getBouquets();
      if (bRes && bRes.data && bRes.data.length > 0) {
        readyBouquets = bRes.data.map(b => ({
          id: `b-${b.id}`,
          bouquetId: b.id,
          title: b.title,
          price: Number(b.price),
          category: b.occasion_tag,
          tag: b.occasion_tag,
          badge: b.is_featured ? 'الأكثر طلباً' : null,
          badgeClass: 'badge-pink',
          image: b.image_svg_path || '/assets/bouquet-pink-spring.svg',
          desc: b.description || 'باقة فاخرة من ورود مسكة المنتقاة بعناية',
          flowers: b.flowers || [],
          total_stems: b.total_stems || 0
        }));
      }
    } catch (err) {
      console.log('Using default bouquets');
    }
  });

  function showToast(msg) {
    toastMessage = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastMessage = '';
    }, 3500);
  }

  function addToCart(b) {
    cart.addItem({
      id: b.id,
      bouquetId: b.bouquetId,
      title: b.title,
      price: b.price,
      quantity: 1,
      image: b.image,
      desc: b.desc
    });
    showToast(`تمت إضافة "${b.title}" إلى السلة بنجاح 🌸`);
  }

  function handleTrackSubmit(e) {
    e.preventDefault();
    if (!trackInput.trim()) return;
    router.navigate('/track', { order: trackInput.trim() });
  }

  async function handleReviewSubmit() {
    if (!newReview.customerName || !newReview.comment) {
      alert('الرجاء كتابة اسمك ونص التقييم');
      return;
    }
    reviewSubmitting = true;
    try {
      await api.addReview(newReview);
      showToast('شكراً لتقييمك وملاحظاتك القيمة 🌸 تم الحفظ بنجاح!');
      showReviewModal = false;
      newReview = { customerName: '', rating: 5, comment: '', bouquetType: 'باقة جاهزة' };
      // refresh reviews
      const r = await api.getReviews(true);
      if (r && r.data) reviews = r.data;
    } catch (err) {
      alert('تعذر إرسال التقييم: ' + err.message);
    } finally {
      reviewSubmitting = false;
    }
  }

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    if (!feedback.name || !feedback.subject || !feedback.message) {
      alert('الرجاء ملء الاسم والموضوع والرسالة');
      return;
    }
    feedbackSubmitting = true;
    try {
      await api.submitFeedback(feedback);
      feedbackSent = true;
      feedback = { name: '', phone: '', subject: '', message: '' };
      showToast('تم إرسال اقتراحك وملاحظتك لإدارة مسكة بنجاح 🌸');
    } catch (err) {
      alert('تعذر إرسال الملاحظة: ' + err.message);
    } finally {
      feedbackSubmitting = false;
    }
  }

  $: filteredBouquets = activeFilter === 'all' 
    ? readyBouquets 
    : readyBouquets.filter(b => b.category === activeFilter);
</script>

<div class="home-page fade-in">
  <!-- Toast Notification -->
  {#if toastMessage}
    <div class="toast-popup fade-in">
      <span>{toastMessage}</span>
      <button type="button" on:click={() => router.navigate('/cart')}>عرض السلة ←</button>
    </div>
  {/if}

  <!-- 1. Hero Section -->
  <section class="hero-section">
    <div class="hero-container">
      <div class="hero-content">
        <span class="hero-badge">✨ أتيليه الزهور الطبيعية الأول في ليبيا</span>
        <h1 class="hero-title">
          زهورٌ طبيعية طازجة،<br />
          <span class="title-highlight">تُنسج بمشاعر وتُختم بالشمع</span>
        </h1>
        <p class="hero-subtitle">
          في مسكة، نبتكر باقات زهور طبيعية استثنائية مع بطاقات إهداء مكتوبة بخط اليد ومختومة بالشمع الأحمر الملكي، مع توصيل مبرد وسريع في طرابلس وبنغازي ومصراتة وكافة المدن الليبية.
        </p>

        <div class="hero-buttons">
          <button type="button" class="btn btn-primary" on:click={() => router.navigate('/studio')}>
            صمم باقتك في الاستوديو 💐
          </button>
          <button type="button" class="btn btn-outline" on:click={() => router.navigate('/designer')}>
            المصمم التفاعلي 3D ✨
          </button>
        </div>

        <dl class="hero-stats">
          <div class="stat-item">
            <dt>100%</dt>
            <dd>زهور طبيعية هولندية</dd>
          </div>
          <div class="stat-item">
            <dt>ختم شمعي</dt>
            <dd>مجاني مع كل باقة</dd>
          </div>
          <div class="stat-item">
            <dt>ساعتان</dt>
            <dd>توصيل نفس اليوم</dd>
          </div>
        </dl>
      </div>

      <div class="hero-image-wrapper">
        <div class="hero-card-arch">
          <img src="/assets/flowers.svg" alt="باقة ورد فاخرة من مسكة" class="hero-main-img" />
          <div class="floating-price-tag">
            <small>الباقات تبدأ من</small>
            <b>64 د.ل</b>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 2. Occasions Section -->
  <section class="section occasions-section">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">تسوّق حسب المناسبة</h2>
        <p class="section-sub">اختر مناسبتك وسيقترح عليك استوديو مسكة أجمل التوليفات المتناسقة</p>
      </div>

      <div class="occasions-grid">
        <div class="card occasion-card" on:click={() => router.navigate('/studio', { occasion: 'عيد ميلاد' })}>
          <div class="occasion-img-box">
            <img src="/assets/occasion-birthday.svg" alt="عيد ميلاد" loading="lazy" />
            <span class="occasion-badge badge-pink">عيد ميلاد</span>
          </div>
          <div class="occasion-body">
            <h3>أعياد الميلاد</h3>
            <p>باقات مبهجة بألوان تنبض بالحياة تزرع الفرح في يوم ميلاد من تحب</p>
            <span class="occasion-link">صمم الباقة ←</span>
          </div>
        </div>

        <div class="card occasion-card" on:click={() => router.navigate('/studio', { occasion: 'زفاف' })}>
          <div class="occasion-img-box">
            <img src="/assets/occasion-wedding.svg" alt="زفاف وخطوبة" loading="lazy" />
            <span class="occasion-badge badge-lime">زفاف وخطوبة</span>
          </div>
          <div class="occasion-body">
            <h3>زفاف وخطوبة</h3>
            <p>أناقة عاجية وتصاميم ملكية كلاسيكية تليق بأجمل ليالي العمر</p>
            <span class="occasion-link">صمم الباقة ←</span>
          </div>
        </div>

        <div class="card occasion-card" on:click={() => router.navigate('/studio', { occasion: 'تخرج' })}>
          <div class="occasion-img-box">
            <img src="/assets/occasion-graduation.svg" alt="تخرج ونجاح" loading="lazy" />
            <span class="occasion-badge badge-lime">تخرج ونجاح</span>
          </div>
          <div class="occasion-body">
            <h3>تخرج ونجاح</h3>
            <p>باقات احتفالية مهيبة بألوان الفخر تتوج سنوات الجهد والإنجاز</p>
            <span class="occasion-link">صمم الباقة ←</span>
          </div>
        </div>

        <div class="card occasion-card" on:click={() => router.navigate('/studio', { occasion: 'اعتذار' })}>
          <div class="occasion-img-box">
            <img src="/assets/occasion-apology.svg" alt="اعتذار ومودة" loading="lazy" />
            <span class="occasion-badge badge-pink">اعتذار ومودة</span>
          </div>
          <div class="occasion-body">
            <h3>اعتذار ومودة</h3>
            <p>ورود رقيقة مفعمة بالدفء تحمل أصدق المشاعر وتصلح كل خاطر</p>
            <span class="occasion-link">صمم الباقة ←</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 3. Ready Bouquets Showcase -->
  <section class="section bouquets-section" id="bouquets">
    <div class="container">
      <div class="section-header-flex">
        <div>
          <h2 class="section-title">باقات مسكة الجاهزة</h2>
          <p class="section-sub">منسقة يدوياً بعناية فائقة وجاهزة للتوصيل الفوري</p>
        </div>
        <div class="filter-pills">
          <button 
            type="button" 
            class="filter-pill" 
            class:active={activeFilter === 'all'} 
            on:click={() => activeFilter = 'all'}
          >
            الكل ({readyBouquets.length})
          </button>
          <button 
            type="button" 
            class="filter-pill" 
            class:active={activeFilter === 'عيد ميلاد'} 
            on:click={() => activeFilter = 'عيد ميلاد'}
          >
            أعياد ميلاد
          </button>
          <button 
            type="button" 
            class="filter-pill" 
            class:active={activeFilter === 'زفاف'} 
            on:click={() => activeFilter = 'زفاف'}
          >
            زفاف
          </button>
          <button 
            type="button" 
            class="filter-pill" 
            class:active={activeFilter === 'شكر'} 
            on:click={() => activeFilter = 'شكر'}
          >
            شكر وامتنان
          </button>
          <button 
            type="button" 
            class="filter-pill" 
            class:active={activeFilter === 'تخرج'} 
            on:click={() => activeFilter = 'تخرج'}
          >
            تخرج
          </button>
        </div>
      </div>

      <div class="products-grid">
        {#each filteredBouquets as b (b.id)}
          <article class="card product-card">
            <div class="product-img-box">
              {#if b.badge}
                <span class="product-badge {b.badgeClass}">{b.badge}</span>
              {/if}
              <img src={b.image} alt={b.title} loading="lazy" />
            </div>
            <div class="product-info">
              <span class="product-tag">{b.tag}</span>
              <h3 class="product-title">{b.title}</h3>
              <p class="product-desc">{b.desc}</p>

              {#if b.flowers && b.flowers.length > 0}
                <div class="card-recipe-box">
                  <div class="card-recipe-title">🌸 تركيبة الورود ({b.total_stems || b.flowers.reduce((acc, f) => acc + (f.quantity_stems || 0), 0)} زهرة):</div>
                  <div class="card-recipe-pills">
                    {#each b.flowers as f}
                      <span class="recipe-pill"><b>{f.quantity_stems}×</b> {f.flower_name}</span>
                    {/each}
                  </div>
                </div>
              {/if}

              <div class="product-footer">
                <span class="product-price">{b.price} د.ل</span>
                <button 
                  type="button" 
                  class="btn btn-sm btn-cart" 
                  on:click={() => addToCart(b)}
                >
                  أضف للسلة 🛍️
                </button>
              </div>
            </div>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <!-- 4. Delivery & Live Tracking Teaser -->
  <section class="section delivery-section">
    <div class="container">
      <div class="delivery-grid">
        <div class="delivery-features">
          <h2 class="section-title">توصيل مبرد وتتبع لحظي</h2>
          <p class="section-sub">نضمن وصول كل وردة بكامل رونقها وعبيرها الطازج</p>
          
          <div class="feature-item">
            <div class="feature-icon">⏱️</div>
            <div>
              <h4>دقة متناهية في المواعيد</h4>
              <p>اختر اليوم والوقت المناسب لتسليم الباقة، مع توفر خيار التوصيل المستعجل خلال ساعتين.</p>
            </div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">🚗</div>
            <div>
              <h4>سائقون مدربون وتتبع GPS</h4>
              <p>سيارات مجهزة ومكيفة تحافظ على الزهور، مع إمكانية متابعة خط سير السائق على الخريطة.</p>
            </div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">💌</div>
            <div>
              <h4>كرت إهداء بختم الشمع مجاناً</h4>
              <p>كل طلب يتضمن بطاقة إهداء مخصصة ومختومة يدوياً بالشمع الأحمر الملكي.</p>
            </div>
          </div>
        </div>

        <div class="card track-box-card">
          <div class="track-box-header">
            <h3>تتبّع طلبك الآن 📍</h3>
            <p>أدخل رقم الطلب المكون من 4 أرقام لمعرفة حالته وموقعه لحظة بلحظة</p>
          </div>
          <form on:submit={handleTrackSubmit} class="track-form">
            <input 
              type="text" 
              class="input-field" 
              placeholder="مثال: 1048 أو 1049" 
              bind:value={trackInput} 
              required
            />
            <button type="submit" class="btn btn-primary btn-block">
              تتبّع مسار السائق ←
            </button>
          </form>
          <div class="sample-orders-hint">
            <span>طلبات تجريبية سريعة: </span>
            <button type="button" on:click={() => { trackInput = '1048'; router.navigate('/track', { order: '1048' }); }}>#1048</button>
            <button type="button" on:click={() => { trackInput = '1049'; router.navigate('/track', { order: '1049' }); }}>#1049</button>
            <button type="button" on:click={() => { trackInput = '1050'; router.navigate('/track', { order: '1050' }); }}>#1050</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 5. Customer Reviews & Ratings -->
  <section class="section reviews-section">
    <div class="container">
      <div class="section-header-flex">
        <div>
          <h2 class="section-title">تجارب وأصدقاء مسكة</h2>
          <p class="section-sub">أكثر من 1,400 باقة تم تسليمها بزرع الابتسامة في أرجاء ليبيا</p>
        </div>
        <button 
          type="button" 
          class="btn btn-outline" 
          on:click={() => showReviewModal = true}
        >
          + أضف تقييمك وملاحظتك ✍️
        </button>
      </div>

      <div class="reviews-grid">
        {#each reviews as r (r.id || r.customer_name)}
          <div class="card review-card">
            <div class="review-top">
              <span class="stars">{'★'.repeat(r.rating || 5)}</span>
              <span class="verified-badge">طلب موثق ✓</span>
            </div>
            <p class="review-text">"{r.comment}"</p>
            
            <div class="reviewer-meta">
              <div class="avatar">{r.customer_name ? r.customer_name[0] : 'ز'}</div>
              <div>
                <h4 class="name">{r.customer_name}</h4>
                <span class="sub">{r.city_name || 'ليبيا'} — {r.bouquet_type || 'باقة مسكة'}</span>
              </div>
            </div>

            {#if r.admin_reply}
              <div class="admin-reply-box">
                <span class="reply-tag">رد إدارة مسكة 🌸:</span>
                <p>{r.admin_reply}</p>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- 6. Review Modal -->
  {#if showReviewModal}
    <div class="modal-backdrop fade-in" on:click|self={() => showReviewModal = false}>
      <div class="modal-card">
        <div class="modal-header">
          <h3>شاركنا رأيك وملاحظتك 🌸</h3>
          <button type="button" class="close-btn" on:click={() => showReviewModal = false}>✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>اسمك الكريم:</label>
            <input type="text" class="input-field" bind:value={newReview.customerName} placeholder="مثال: مريم الورفلي" />
          </div>
          <div class="form-group">
            <label>التقييم:</label>
            <div class="star-picker">
              {#each [1, 2, 3, 4, 5] as star}
                <button 
                  type="button" 
                  class="star-btn" 
                  class:selected={newReview.rating >= star}
                  on:click={() => newReview.rating = star}
                >
                  ★
                </button>
              {/each}
              <span class="rating-label">({newReview.rating} من 5 نجوم)</span>
            </div>
          </div>
          <div class="form-group">
            <label>نوع الباقة أو المناسبة:</label>
            <input type="text" class="input-field" bind:value={newReview.bouquetType} placeholder="مثال: باقة ربيع وردي / تصميم مخصص" />
          </div>
          <div class="form-group">
            <label>ملاحظتك وتقييمك لتجربة التوصيل والزهور:</label>
            <textarea class="textarea-field" rows="4" bind:value={newReview.comment} placeholder="كيف كانت نضارة الورد وسرعة التوصيل ولمسة الختم الشمعي؟"></textarea>
          </div>
          <button 
            type="button" 
            class="btn btn-primary btn-block" 
            disabled={reviewSubmitting}
            on:click={handleReviewSubmit}
          >
            {reviewSubmitting ? 'جاري الإرسال...' : 'إرسال التقييم 🌸'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- 7. Customer Feedback Box -->
  <section class="section feedback-section">
    <div class="container">
      <div class="card feedback-card">
        <div class="feedback-info">
          <span class="badge badge-pink">صندوق الاقتراحات</span>
          <h2>رأيك وملاحظاتك تصنع تميّزنا ✨</h2>
          <p>
            نهتم في مسكة بكل ملاحظة يشاركها عملاؤنا، سواء كان اقتراحاً لنوع زهور جديد، فكرة لتغليف إضافي، أو ملاحظة لتطوير خدمات التوصيل في مدينتك.
          </p>
        </div>
        <form class="feedback-form" on:submit={handleFeedbackSubmit}>
          {#if feedbackSent}
            <div class="success-banner">
              ✅ شكراً لك! تم استلام اقتراحك وسيقوم فريق مسكة بدراسته بعناية.
            </div>
          {/if}
          <div class="form-row">
            <input type="text" class="input-field" placeholder="اسمك الكريم" bind:value={feedback.name} required />
            <input type="tel" class="input-field" placeholder="رقم هاتفك (اختياري)" bind:value={feedback.phone} />
          </div>
          <input type="text" class="input-field" placeholder="موضوع الملاحظة أو الاقتراح" bind:value={feedback.subject} required />
          <textarea class="textarea-field" rows="3" placeholder="اكتب ملاحظتك بكل تفصيل..." bind:value={feedback.message} required></textarea>
          <button type="submit" class="btn btn-primary" disabled={feedbackSubmitting}>
            {feedbackSubmitting ? 'جاري الإرسال...' : 'إرسال الملاحظة للإدارة 📨'}
          </button>
        </form>
      </div>
    </div>
  </section>

  <!-- 8. FAQ Accordion -->
  <section class="section faq-section">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">الأسئلة الشائعة والعناية بالزهور</h2>
        <p class="section-sub">كل ما تحتاج معرفته عن جودة الورد، سرعة التوصيل، وكيفية الحفاظ على نضارته</p>
      </div>

      <div class="faq-list">
        <div class="faq-item" class:open={faqOpenIndex === 0}>
          <button type="button" class="faq-question" on:click={() => faqOpenIndex = (faqOpenIndex === 0 ? -1 : 0)}>
            <span>هل زهور مسكة طبيعية وطازجة يومياً؟</span>
            <span class="arrow">{faqOpenIndex === 0 ? '▲' : '▼'}</span>
          </button>
          {#if faqOpenIndex === 0}
            <div class="faq-answer fade-in">
              نعم، نحرص في مسكة على استيراد وانتقاء أفضل أنواع الزهور الطبيعية يومياً (زهور هولندية وإكوادورية فائقة الجودة)، وتُحفظ في غرف تبريد بدرجة حرارة ورطوبة مدروسة لضمان وصولها بأعلى درجات النضارة والحيوية.
            </div>
          {/if}
        </div>

        <div class="faq-item" class:open={faqOpenIndex === 1}>
          <button type="button" class="faq-question" on:click={() => faqOpenIndex = (faqOpenIndex === 1 ? -1 : 1)}>
            <span>كم يستغرق التوصيل داخل طرابلس والمدن الأخرى؟</span>
            <span class="arrow">{faqOpenIndex === 1 ? '▲' : '▼'}</span>
          </button>
          {#if faqOpenIndex === 1}
            <div class="faq-answer fade-in">
              يتوفر لدينا توصيل سريع في نفس اليوم خلال ساعتين إلى 3 ساعات داخل نطاق المدينة. كما يمكنك جدولة تاريخ وساعة التوصيل بدقة مسبقاً لضمان وصول هديتك في اللحظة المناسبة تماماً.
            </div>
          {/if}
        </div>

        <div class="faq-item" class:open={faqOpenIndex === 2}>
          <button type="button" class="faq-question" on:click={() => faqOpenIndex = (faqOpenIndex === 2 ? -1 : 2)}>
            <span>هل كرت الإهداء والختم الشمعي مجانيان؟</span>
            <span class="arrow">{faqOpenIndex === 2 ? '▲' : '▼'}</span>
          </button>
          {#if faqOpenIndex === 2}
            <div class="faq-answer fade-in">
              نعم بالكامل! مع كل طلب نقدّم بطاقة إهداء فاخرة مجاناً تُكتب بخط اليد بحبر أنيق ومغلفة بختم شمعي أحمر يضفي طابعاً ملكياً خاصاً لهديتك.
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .hero-section {
    padding: 60px 0 80px;
    background: var(--bg-gradient);
    position: relative;
    overflow: hidden;
  }
  .hero-container {
    max-width: 1240px;
    margin: 0 auto;
    padding: 0 24px;
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 48px;
    align-items: center;
  }
  .hero-badge {
    display: inline-block;
    background: var(--pink);
    color: var(--rose-text);
    padding: 6px 16px;
    border-radius: var(--radius-full);
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 20px;
  }
  .hero-title {
    font-size: 2.8rem;
    font-weight: 800;
    line-height: 1.25;
    color: var(--text);
    margin-bottom: 20px;
    font-family: 'Cairo', sans-serif;
  }
  .title-highlight {
    color: var(--olive);
    background: linear-gradient(120deg, var(--olive), var(--olive-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .hero-subtitle {
    font-size: 1.12rem;
    line-height: 1.8;
    color: var(--text-muted);
    margin-bottom: 32px;
    max-width: 580px;
  }
  .hero-buttons {
    display: flex;
    gap: 16px;
    margin-bottom: 40px;
    flex-wrap: wrap;
  }
  .hero-stats {
    display: flex;
    gap: 32px;
    border-top: 1px solid var(--line);
    padding-top: 24px;
  }
  .stat-item dt {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--olive);
  }
  .stat-item dd {
    font-size: 0.88rem;
    color: var(--text-muted);
    margin: 0;
  }
  .hero-image-wrapper {
    display: flex;
    justify-content: center;
  }
  .hero-card-arch {
    position: relative;
    background: var(--card);
    border: 1px solid var(--line-strong);
    border-radius: 200px 200px 32px 32px;
    padding: 24px 24px 40px;
    box-shadow: var(--shadow-xl);
    max-width: 380px;
    width: 100%;
    text-align: center;
  }
  .hero-main-img {
    width: 100%;
    height: auto;
    max-height: 420px;
    object-fit: contain;
    filter: drop-shadow(0 14px 28px rgba(94, 107, 44, 0.15));
    transition: transform 0.4s ease;
  }
  .hero-main-img:hover {
    transform: scale(1.03);
  }
  .floating-price-tag {
    position: absolute;
    bottom: -15px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    padding: 8px 24px;
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .floating-price-tag small {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .floating-price-tag b {
    font-size: 1.25rem;
    color: var(--price);
  }

  /* Section Styles */
  .section {
    padding: 70px 0;
  }
  .container {
    max-width: 1240px;
    margin: 0 auto;
    padding: 0 24px;
  }
  .section-header {
    text-align: center;
    max-width: 640px;
    margin: 0 auto 44px;
  }
  .section-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 40px;
    flex-wrap: wrap;
    gap: 20px;
  }
  .section-title {
    font-size: 2.2rem;
    font-weight: 800;
    color: var(--olive);
    margin-bottom: 8px;
    font-family: 'Cairo', sans-serif;
  }
  .section-sub {
    font-size: 1.05rem;
    color: var(--text-muted);
    line-height: 1.6;
  }

  /* Occasions */
  .occasions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 24px;
  }
  .occasion-card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .occasion-card:hover {
    transform: translateY(-6px);
    box-shadow: var(--shadow-lg);
    border-color: var(--olive);
  }
  .occasion-img-box {
    position: relative;
    background: var(--bg);
    padding: 24px;
    text-align: center;
    border-bottom: 1px solid var(--line);
  }
  .occasion-img-box img {
    height: 120px;
    object-fit: contain;
  }
  .occasion-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: var(--radius-full);
  }
  .occasion-body {
    padding: 20px;
  }
  .occasion-body h3 {
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--text);
  }
  .occasion-body p {
    font-size: 0.88rem;
    color: var(--text-muted);
    line-height: 1.5;
    margin-bottom: 16px;
  }
  .occasion-link {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--olive);
  }

  /* Products */
  .filter-pills {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-pill {
    background: var(--card);
    border: 1px solid var(--line);
    padding: 8px 18px;
    border-radius: var(--radius-full);
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .filter-pill:hover, .filter-pill.active {
    background: var(--olive);
    color: #fff;
    border-color: var(--olive);
  }
  .products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
    gap: 28px;
  }
  .product-card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
  }
  .product-card:hover {
    transform: translateY(-6px);
    box-shadow: var(--shadow-lg);
  }
  .product-img-box {
    position: relative;
    background: var(--bg);
    padding: 28px;
    text-align: center;
    border-bottom: 1px solid var(--line);
  }
  .product-img-box img {
    height: 190px;
    object-fit: contain;
    transition: transform 0.3s ease;
  }
  .product-card:hover .product-img-box img {
    transform: scale(1.06);
  }
  .product-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 700;
  }
  .badge-pink { background: var(--pink); color: var(--rose-text); }
  .badge-lime { background: var(--lime); color: var(--olive); }
  .product-info {
    padding: 22px;
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .product-tag {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .product-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 8px;
  }
  .product-desc {
    font-size: 0.88rem;
    color: var(--text-muted);
    line-height: 1.5;
    margin-bottom: 12px;
  }
  .card-recipe-box {
    background: #faf6f0;
    border: 1px solid #efe8da;
    border-radius: 10px;
    padding: 8px 10px;
    margin-bottom: 16px;
  }
  .card-recipe-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--olive);
    margin-bottom: 6px;
  }
  .card-recipe-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .recipe-pill {
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 0.72rem;
    padding: 2px 7px;
    color: #4b4840;
  }
  .recipe-pill b {
    color: var(--olive);
  }
  .product-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .product-price {
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--price);
  }
  .btn-cart {
    background: var(--pink);
    color: var(--rose-text);
    border: 1px solid var(--pink-2);
    padding: 8px 16px;
    border-radius: var(--radius-full);
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .btn-cart:hover {
    background: var(--rose-text);
    color: #fff;
  }

  /* Delivery Section */
  .delivery-grid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 48px;
    align-items: center;
  }
  .feature-item {
    display: flex;
    gap: 16px;
    margin-top: 24px;
  }
  .feature-icon {
    font-size: 1.8rem;
    background: var(--card);
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    flex-shrink: 0;
  }
  .feature-item h4 {
    font-size: 1.1rem;
    color: var(--olive);
    margin-bottom: 4px;
  }
  .feature-item p {
    font-size: 0.9rem;
    color: var(--text-muted);
    line-height: 1.5;
  }
  .track-box-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 36px;
    box-shadow: var(--shadow-lg);
  }
  .track-box-header h3 {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text);
    margin-bottom: 8px;
  }
  .track-box-header p {
    font-size: 0.92rem;
    color: var(--text-muted);
    margin-bottom: 24px;
  }
  .track-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .sample-orders-hint {
    margin-top: 20px;
    font-size: 0.85rem;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sample-orders-hint button {
    background: var(--line);
    border: none;
    color: var(--olive);
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
  }

  /* Reviews */
  .reviews-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 28px;
  }
  .review-card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .review-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .stars {
    color: #e6a100;
    font-size: 1.2rem;
    letter-spacing: 2px;
  }
  .verified-badge {
    background: var(--lime);
    color: var(--olive);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: var(--radius-full);
  }
  .review-text {
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--text);
    font-style: italic;
  }
  .reviewer-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    border-top: 1px solid var(--line);
    padding-top: 14px;
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--olive);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
  }
  .name {
    font-size: 0.98rem;
    font-weight: 700;
    color: var(--text);
  }
  .sub {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .admin-reply-box {
    background: var(--bg);
    border-right: 3px solid var(--olive);
    padding: 10px 14px;
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-size: 0.86rem;
    color: var(--text-muted);
  }
  .reply-tag {
    font-weight: 700;
    color: var(--olive);
    display: block;
    margin-bottom: 2px;
  }

  /* Feedback */
  .feedback-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 44px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    box-shadow: var(--shadow-md);
  }
  .feedback-info h2 {
    font-size: 1.8rem;
    color: var(--olive);
    margin: 14px 0 12px;
  }
  .feedback-info p {
    font-size: 0.95rem;
    color: var(--text-muted);
    line-height: 1.7;
  }
  .feedback-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* FAQ */
  .faq-list {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .faq-item {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .faq-question {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: none;
    border: none;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text);
    text-align: right;
    cursor: pointer;
  }
  .faq-answer {
    padding: 0 24px 22px;
    font-size: 0.92rem;
    color: var(--text-muted);
    line-height: 1.7;
    border-top: 1px solid var(--line);
  }

  /* Generic Form Elements */
  .input-field, .textarea-field {
    width: 100%;
    padding: 12px 18px;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-family: inherit;
    font-size: 0.95rem;
    box-sizing: border-box;
  }
  .input-field:focus, .textarea-field:focus {
    outline: none;
    border-color: var(--olive);
    box-shadow: 0 0 0 3px var(--olive-glow);
  }
  .btn {
    padding: 12px 28px;
    border-radius: var(--radius-full);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .btn-primary {
    background: var(--olive);
    color: #fff;
  }
  .btn-primary:hover {
    background: var(--olive-dark);
    transform: translateY(-2px);
  }
  .btn-outline {
    background: transparent;
    border: 1.5px solid var(--olive);
    color: var(--olive);
  }
  .btn-outline:hover {
    background: var(--olive);
    color: #fff;
  }
  .btn-block {
    width: 100%;
  }
  .success-banner {
    background: var(--lime);
    color: var(--olive-dark);
    padding: 12px 18px;
    border-radius: var(--radius-sm);
    font-size: 0.92rem;
    font-weight: 700;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }
  .modal-card {
    background: var(--card-solid);
    border-radius: var(--radius-lg);
    max-width: 500px;
    width: 100%;
    padding: 32px;
    box-shadow: var(--shadow-xl);
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .modal-header h3 {
    margin: 0;
    color: var(--olive);
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.4rem;
    cursor: pointer;
    color: var(--text-muted);
  }
  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .star-picker {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .star-btn {
    background: none;
    border: none;
    font-size: 1.6rem;
    color: #ccc;
    cursor: pointer;
    padding: 0;
  }
  .star-btn.selected {
    color: #f39c12;
  }
  .rating-label {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-right: 8px;
  }

  /* Toast Notification */
  .toast-popup {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--olive-darker);
    color: #fff;
    padding: 14px 28px;
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-xl);
    z-index: 999;
    display: flex;
    align-items: center;
    gap: 16px;
    font-weight: 600;
    font-size: 0.95rem;
    border: 1px solid var(--olive-light);
  }
  .toast-popup button {
    background: var(--olive-light);
    color: var(--olive-darker);
    border: none;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 800;
    cursor: pointer;
  }

  @media (max-width: 900px) {
    .hero-container, .delivery-grid, .feedback-card {
      grid-template-columns: 1fr;
    }
    .hero-title {
      font-size: 2.1rem;
    }
  }
</style>

