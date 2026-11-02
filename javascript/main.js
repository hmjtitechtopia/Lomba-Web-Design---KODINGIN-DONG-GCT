import {
    $,
    SITE_NAME,
    ScrollTrigger,
    gsap,
    lenis,
    motionOK,
    nav,
    refreshIcons,
    regionById,
    scrollToEl,
    scrollToY,
} from './script.js';
import { initHeroVideo, initHome, renderHomeStatic } from './beranda.js';
import { initDetail } from './wilayah.js';

let current = {};
let curtainBusy = false;
let entranceDelay = 0.05;
let heroDelay = 0;
const curtain = $('#curtain');
function idFromHash(hash) {
    try {
        return decodeURIComponent(hash.slice(1));
    } catch {
        return '';
    }
}

async function muatTemplate() {
    const res = await fetch('template.html');
    if (!res.ok) throw new Error(`Gagal memuat template.html (${res.status})`);
    document.body.insertAdjacentHTML('beforeend', await res.text());
}

function updateNav() {
    const onHome = current.name === 'home';
    nav.classList.toggle('is-hidden', onHome && window.scrollY < 80);
    nav.classList.toggle('over-hero', onHome && window.scrollY < $('#beranda').offsetHeight - 120);
}
window.addEventListener('scroll', updateNav, { passive: true });

document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;

    const id = idFromHash(link.getAttribute('href'));
    const target = document.getElementById(id);
    if (regionById.has(id) || target?.closest('[hidden]')) {
        e.preventDefault();
        goTo(id);
    } else if (target) {
        e.preventDefault();
        scrollToEl(target);
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
    }
});

function show(name, init) {
    current.cleanup?.();
    $('#view-home').hidden = name !== 'home';
    $('#view-detail').hidden = name !== 'detail';
    document.documentElement.classList.toggle('region-mode', name === 'detail');
    current = { name, cleanup: init() };
    updateNav();
    if (motionOK) ScrollTrigger.refresh();
}

function route() {
    const id = idFromHash(location.hash).toLowerCase();
    if (regionById.has(id)) {
        show('detail', () => initDetail(regionById.get(id), { goTo, entranceDelay }));
        scrollToY(0, true);
        $('#d-title').focus({ preventScroll: true });
        return;
    }

    if (current.name !== 'home') {
        document.title = SITE_NAME;
        show('home', () => initHome(heroDelay));
        heroDelay = 0;
    }
    const target = id && id !== 'beranda' ? document.getElementById(id) : null;
    if (target && !target.closest('[hidden]')) {
        requestAnimationFrame(() => scrollToEl(target, true));
    } else {
        scrollToY(0, true);
    }
}

function selesaiTirai() {
    curtain.classList.remove('active');
    curtainBusy = false;
    entranceDelay = 0.05;
}

function goTo(id) {
    const swap = () => {
        history.pushState(null, '', `#${id}`);
        route();
    };
    if (!motionOK) {
        swap();
        return;
    }
    if (curtainBusy) return;

    curtainBusy = true;
    entranceDelay = 0.55;
    $('#curtain-name').textContent = regionById.get(id)?.namaPendek ?? SITE_NAME;
    curtain.classList.add('active');

    gsap
        .timeline({ onComplete: selesaiTirai })
        .fromTo(
            curtain,
            { clipPath: 'inset(100% 0% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: 'expo.inOut' },
        )
        .fromTo(
            '.curtain_name',
            { yPercent: 70, opacity: 0.001 },
            { yPercent: 0, opacity: 1, duration: 0.75, ease: 'expo.out' },
            0.32,
        )
        .fromTo('.curtain_line', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'expo.inOut' }, 0.42)
        .add(swap, 1.12)
        .to(curtain, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.85, ease: 'expo.inOut' }, 1.3);
}

function playIntro() {
    const root = document.documentElement;

    function finish() {
        root.classList.remove('intro-mode', 'intro-ready');
        selesaiTirai();
        lenis?.start();
    }

    if (!motionOK) {
        finish();
        return;
    }

    const line = $('.curtain_line');
    const lineStyle = getComputedStyle(line);
    const fromScale = lineStyle.transform === 'none' ? 1 : new DOMMatrix(lineStyle.transform).a;
    const fromOrigin = lineStyle.transformOrigin;
    const wait = Math.max(0, 1.2 - performance.now() / 1000);

    root.classList.add('intro-ready');
    heroDelay = wait + 0.55;
    entranceDelay = heroDelay;
    curtainBusy = true;
    lenis?.stop();

    gsap
        .timeline({
            delay: wait,
            onComplete: () => {
                finish();
                gsap.set(line, { clearProps: 'all' });
            },
        })
        .fromTo(
            line,
            { scaleX: fromScale, transformOrigin: fromOrigin },
            { scaleX: 1, duration: 0.5, ease: 'expo.out' },
        )
        .to(curtain, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, 0.35);
}

function mulai() {
    renderHomeStatic();
    window.addEventListener('hashchange', route);
    playIntro();
    route();
    refreshIcons();
}

function gagalMuatTemplate(err) {
    console.error(err);
    document.documentElement.classList.remove('intro-mode');
    curtain.classList.add('active');
    curtain.removeAttribute('aria-hidden');
    $('#curtain-name').textContent = 'Halaman gagal dimuat. Muat ulang untuk mencoba lagi.';
}

history.scrollRestoration = 'manual';
if (performance.getEntriesByType('navigation')[0]?.type === 'reload' && location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
}

initHeroVideo();
muatTemplate().then(mulai, gagalMuatTemplate);