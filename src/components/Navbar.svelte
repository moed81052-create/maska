<script>
  import { router } from '../stores/router.js';
  import { auth, isAuthenticated, isStaff, isDriver } from '../stores/auth.js';
  import { cartCount } from '../stores/cart.js';
  import { openGlobalChat } from '../stores/aiChatStore.js';
  import ThemeToggle from './ThemeToggle.svelte';

  let mobileMenuOpen = false;

  function go(path) {
    router.navigate(path);
    mobileMenuOpen = false;
  }

  function handleLogout() {
    auth.logout();
    router.navigate('/login');
    mobileMenuOpen = false;
  }
</script>

<header class="navbar-header">
  <div class="nav-container">
    <!-- شعار مسكة الفاخر -->
    {#if $isDriver}
      <a href="/driver" class="brand-logo" on:click|preventDefault={() => go('/driver')}>
        <span class="logo-symbol">🚗</span>
        <div class="logo-text">
          <span class="logo-ar">مَـسْـكَة | كابتن التوصيل</span>
          <span class="logo-en">MASKA FLEET & LOGISTICS</span>
        </div>
      </a>
    {:else}
      <a href="/" class="brand-logo" on:click|preventDefault={() => go('/')}>
        <span class="logo-symbol">🌸</span>
        <div class="logo-text">
          <span class="logo-ar">مَـسْـكَة</span>
          <span class="logo-en">MASKA ATELIER</span>
        </div>
      </a>
    {/if}

    <!-- روابط التنقل الرئيسية (سطح المكتب) -->
    {#if $isDriver}
      <nav class="nav-links desktop-only">
        <div class="driver-nav-badge">
          <span class="pulse-dot"></span>
          <span>بوابة مهام التوصيل والملاحة</span>
        </div>
      </nav>
    {:else}
      <nav class="nav-links desktop-only">
        <button 
          type="button" 
          class="nav-link" 
          class:active={$router.path === '/'} 
          on:click={() => go('/')}
        >
          الرئيسية
        </button>

        <button 
          type="button" 
          class="nav-link" 
          class:active={$router.path === '/studio'} 
          on:click={() => go('/studio')}
        >
          استوديو مسكة 💐
        </button>

        <button 
          type="button" 
          class="nav-link" 
          class:active={$router.path === '/designer'} 
          on:click={() => go('/designer')}
        >
          المصمم التفاعلي ✨
        </button>

        <button 
          type="button" 
          class="nav-link" 
          class:active={$router.path === '/track'} 
          on:click={() => go('/track')}
        >
          تتبع الطلب 📍
        </button>

        <!-- زر شات الذكاء الاصطناعي المميز -->
        <button 
          type="button" 
          class="nav-link ai-chat-nav-pill" 
          on:click={openGlobalChat}
          title="افتح شات خبير مسكة للذكاء الاصطناعي"
        >
          <span class="sparkle-icon">🌸💬</span>
          <span>شات الذكاء الاصطناعي</span>
          <span class="pulse-dot-ai"></span>
        </button>

        {#if $isStaff}
          <button 
            type="button" 
            class="nav-link admin-pill" 
            class:active={$router.path === '/admin'} 
            on:click={() => go('/admin')}
          >
            لوحة الإدارة 👑
          </button>
        {/if}
      </nav>
    {/if}

    <!-- الإجراءات السريعة (سلة، حساب، ثيم) -->
    <div class="nav-actions">
      {#if !$isDriver}
        <!-- زر السلة مع عداد العناصر -->
        <button 
          type="button" 
          class="cart-btn" 
          class:active={$router.path === '/cart'}
          on:click={() => go('/cart')} 
          title="سلة المشتريات"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          {#if $cartCount > 0}
            <span class="cart-badge">{$cartCount}</span>
          {/if}
        </button>
      {/if}

      <!-- زر تبديل الثيم الليلي/النهاري -->
      <ThemeToggle />

      <!-- حالة تسجيل الدخول / المستخدم -->
      {#if $isAuthenticated && $auth}
        <div class="user-pill desktop-only">
          <span class="user-avatar">{#if $isDriver}🚗{:else}👤{/if}</span>
          <span class="user-name">{$auth.full_name}</span>
          <button type="button" class="logout-btn" on:click={handleLogout} title="تسجيل الخروج">
            خروج
          </button>
        </div>
      {:else}
        <button type="button" class="login-nav-btn desktop-only" on:click={() => go('/login')}>
          تسجيل الدخول
        </button>
      {/if}

      <!-- زر القائمة للأجهزة المحمولة -->
      <button 
        type="button" 
        class="mobile-toggle mobile-only" 
        on:click={() => mobileMenuOpen = !mobileMenuOpen}
        aria-label="القائمة"
      >
        {#if mobileMenuOpen}
          ✕
        {:else}
          ☰
        {/if}
      </button>
    </div>
  </div>

  <!-- القائمة المنسدلة للموبايل -->
  {#if mobileMenuOpen}
    <div class="mobile-drawer mobile-only fade-in">
      {#if $isDriver}
        <div class="driver-mobile-status">
          <span class="pulse-dot"></span>
          <span>بوابة كابتن التوصيل 🚗</span>
        </div>
        <button type="button" class="m-link driver active" on:click={() => go('/driver')}>قائمة مهام التوصيل والمواقع 📍</button>
      {:else}
        <button type="button" class="m-link" on:click={() => go('/')}>الرئيسية</button>
        <button type="button" class="m-link" on:click={() => go('/studio')}>استوديو مسكة 💐</button>
        <button type="button" class="m-link" on:click={() => go('/designer')}>المصمم التفاعلي ✨</button>
        <button type="button" class="m-link" on:click={() => go('/track')}>تتبع الطلب 📍</button>
        <button type="button" class="m-link ai-chat" on:click={() => { openGlobalChat(); mobileMenuOpen = false; }}>
          🌸💬 شات الذكاء الاصطناعي للزهور ✦
        </button>
        
        {#if $isStaff}
          <button type="button" class="m-link admin" on:click={() => go('/admin')}>لوحة الإدارة 👑</button>
        {/if}
      {/if}

      <div class="m-divider"></div>

      {#if $isAuthenticated && $auth}
        <div class="m-user-info">
          <span>مرحباً، {$auth.full_name} ({$auth.role_display || $auth.role_name})</span>
          <button type="button" class="m-logout-btn" on:click={handleLogout}>تسجيل خروج</button>
        </div>
      {:else}
        <button type="button" class="m-link login" on:click={() => go('/login')}>تسجيل الدخول / إنشاء حساب</button>
      {/if}
    </div>
  {/if}
</header>

<style>
  .navbar-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--card);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--line);
    transition: all 0.3s ease;
  }
  .nav-container {
    max-width: 1240px;
    margin: 0 auto;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .brand-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: var(--text);
  }
  .logo-symbol {
    font-size: 2rem;
    filter: drop-shadow(0 2px 8px var(--olive-glow));
  }
  .logo-text {
    display: flex;
    flex-direction: column;
  }
  .logo-ar {
    font-size: 1.4rem;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: var(--olive);
    font-family: 'Cairo', sans-serif;
  }
  .logo-en {
    font-size: 0.65rem;
    letter-spacing: 2px;
    color: var(--text-muted);
    font-weight: 600;
  }
  .nav-links {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .nav-link {
    background: none;
    border: none;
    padding: 8px 16px;
    border-radius: var(--radius-full);
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .nav-link:hover {
    color: var(--olive);
    background: var(--line);
  }
  .nav-link.active {
    color: var(--card-solid);
    background: var(--olive);
  }
  .nav-link.admin-pill {
    color: #963547;
    background: var(--pink);
    border: 1px solid var(--pink-2);
  }
  .nav-link.admin-pill.active {
    background: #963547;
    color: #ffffff;
  }
  .nav-link.ai-chat-nav-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, rgba(94, 107, 44, 0.12) 0%, rgba(212, 175, 55, 0.18) 100%);
    color: #465020;
    border: 1.5px solid rgba(94, 107, 44, 0.35);
    font-weight: 700;
    padding: 7px 16px;
  }
  .nav-link.ai-chat-nav-pill:hover {
    background: #5e6b2c;
    color: #ffffff;
    border-color: #5e6b2c;
    box-shadow: 0 4px 14px rgba(94, 107, 44, 0.25);
  }
  .pulse-dot-ai {
    width: 8px;
    height: 8px;
    background: #16a34a;
    border-radius: 50%;
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
    animation: navPulse 1.8s infinite;
  }
  .m-link.ai-chat {
    background: linear-gradient(135deg, rgba(94, 107, 44, 0.1) 0%, rgba(212, 175, 55, 0.15) 100%);
    color: #5e6b2c;
    border: 1px solid rgba(94, 107, 44, 0.3);
    font-weight: 800;
  }
  .nav-link.driver-pill {
    color: #1565c0;
    background: #e3f2fd;
    border: 1px solid #bbdefb;
  }
  .nav-link.driver-pill.active {
    background: #1976d2;
    color: #ffffff;
  }
  .driver-nav-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: #e3f2fd;
    color: #1565c0;
    padding: 7px 18px;
    border-radius: var(--radius-full);
    font-size: 0.92rem;
    font-weight: 700;
    border: 1px solid #90caf9;
  }
  .pulse-dot {
    width: 9px;
    height: 9px;
    background: #2e7d32;
    border-radius: 50%;
    box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.7);
    animation: navPulse 1.8s infinite;
  }
  @keyframes navPulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(46, 125, 50, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(46, 125, 50, 0); }
  }
  .driver-mobile-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    font-weight: 700;
    font-size: 0.95rem;
    color: #1565c0;
    background: #e3f2fd;
    border-radius: var(--radius-sm);
    border: 1px solid #90caf9;
  }
  .m-link.driver {
    color: #1976d2;
    background: #e3f2fd;
  }
  .nav-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .cart-btn {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--card);
    border: 1px solid var(--line-strong);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .cart-btn:hover, .cart-btn.active {
    color: var(--olive);
    border-color: var(--olive);
    transform: translateY(-2px);
  }
  .cart-badge {
    position: absolute;
    top: -4px;
    left: -4px;
    background: var(--rose-text);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 999px;
    min-width: 18px;
    text-align: center;
    border: 2px solid var(--card-solid);
  }
  .user-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: var(--card);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    font-size: 0.88rem;
    font-weight: 600;
  }
  .logout-btn {
    background: none;
    border: none;
    color: var(--price);
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: underline;
    margin-right: 4px;
  }
  .login-nav-btn {
    background: var(--olive);
    color: #ffffff;
    border: none;
    padding: 9px 20px;
    border-radius: var(--radius-full);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .login-nav-btn:hover {
    background: var(--olive-dark);
    transform: translateY(-1px);
  }
  .mobile-toggle {
    display: none;
    background: none;
    border: 1px solid var(--line-strong);
    width: 42px;
    height: 42px;
    border-radius: var(--radius-sm);
    font-size: 1.3rem;
    color: var(--text);
    cursor: pointer;
  }
  .mobile-drawer {
    display: flex;
    flex-direction: column;
    padding: 16px 24px 24px;
    background: var(--card);
    border-bottom: 1px solid var(--line);
    gap: 8px;
  }
  .m-link {
    text-align: right;
    background: none;
    border: none;
    padding: 12px 16px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .m-link:hover {
    background: var(--line);
    color: var(--olive);
  }
  .m-link.admin {
    color: #963547;
    background: var(--pink);
  }
  .m-link.login {
    background: var(--olive);
    color: #fff;
    text-align: center;
    margin-top: 8px;
  }
  .m-divider {
    height: 1px;
    background: var(--line);
    margin: 8px 0;
  }
  .m-user-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    font-size: 0.9rem;
  }
  .m-logout-btn {
    background: var(--pink);
    border: 1px solid var(--pink-2);
    color: var(--price);
    padding: 6px 12px;
    border-radius: var(--radius-full);
    cursor: pointer;
    font-weight: bold;
  }

  @media (max-width: 900px) {
    .desktop-only {
      display: none !important;
    }
    .mobile-only {
      display: block !important;
    }
    .mobile-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
</style>

