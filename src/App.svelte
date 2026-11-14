<script>
  import { router } from './stores/router.js';
  import { isDriver } from './stores/auth.js';
  import Navbar from './components/Navbar.svelte';
  import Footer from './components/Footer.svelte';

  // استيراد الصفحات
  import Home from './pages/Home.svelte';
  import Studio from './pages/Studio.svelte';
  import Designer from './pages/Designer.svelte';
  import Cart from './pages/Cart.svelte';
  import Track from './pages/Track.svelte';
  import Login from './pages/Login.svelte';
  import Admin from './pages/Admin.svelte';
  import Driver from './pages/Driver.svelte';

  // حماية مسار السائق: إذا كان المستخدم سائقاً، يتم حصره فقط في واجهة السائق
  $: if ($isDriver && $router.path !== '/driver') {
    router.navigate('/driver');
  }
</script>

<div class="app-root">
  <Navbar />

  <main class="main-content">
    {#if $isDriver}
      <Driver />
    {:else if $router.path === '/' || $router.path === ''}
      <Home />
    {:else if $router.path === '/studio'}
      <Studio />
    {:else if $router.path === '/designer'}
      <Designer />
    {:else if $router.path === '/cart'}
      <Cart />
    {:else if $router.path === '/track'}
      <Track />
    {:else if $router.path === '/login'}
      <Login />
    {:else if $router.path === '/admin'}
      <Admin />
    {:else if $router.path === '/driver'}
      <Driver />
    {:else}
      <Home />
    {/if}
  </main>

  <Footer />
</div>

<style>
  .app-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  .main-content {
    flex: 1;
  }
</style>

