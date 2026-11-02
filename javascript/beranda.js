import {
    $,
    $$,
    MUNCUL,
    fmt,
    gsap,
    motionOK,
    prefersReducedMotion,
    regions,
    setNavCurrent,
    totals,
    watchSections,
} from './script.js';
import { chipWilayah, initIslandMap, resetMapPanel } from './peta.js';
import { initRail, kartuWilayah } from './wilayah.js';

export function initHeroVideo() {
    const video = $('#hero-video');

    video.addEventListener('loadeddata', () => video.classList.add('ready'), { once: true });
    video.src = video.dataset.src;

    const observer = new IntersectionObserver(
        ([entry]) => {
            if (!entry.isIntersecting) video.pause();
            else if (!prefersReducedMotion) video.play().catch(() => {});
        },
        { threshold: 0.15 },
    );
    observer.observe($('#beranda'));
}

export function renderHomeStatic() {
    $('#regions-lede').textContent =
        `Sembilan kabupaten dan kota Provinsi Bali, dengan ${totals.kec} kecamatan, ` +
        `${fmt(totals.desa)} desa, dan ${totals.kel} kelurahan di dalamnya.`;
    $('#rail-track').replaceChildren(...regions.map(kartuWilayah));
    $('#map-chips').replaceChildren(...regions.map(chipWilayah));
}

function animateHome(heroDelay) {
    return gsap.context(() => {
        gsap
            .timeline({ defaults: { ease: 'expo.out' }, delay: heroDelay })
            .fromTo(
                '.hero_frame',
                { clipPath: 'inset(6% 5% 6% 5% round 36px)' },
                { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.6, clearProps: 'clipPath' },
                0,
            )
            .fromTo(
                ['.hero_title', '.hero_intro', '.hero_text .button-dark'],
                { y: 26, opacity: 0.001 },
                { y: 0, opacity: 1, duration: 1.2, stagger: 0.09 },
                0.25,
            )
            .fromTo('.hero_scroll', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 1 }, 0.9);

        const muncul = (targets, y, duration, stagger, trigger) =>
            gsap.fromTo(
                targets,
                { y, opacity: 0.001 },
                {
                    ...MUNCUL,
                    duration,
                    stagger,
                    scrollTrigger: { trigger, start: 'top 72%', once: true },
                },
            );
        muncul('#wilayah .region-card', 90, 1.2, 0.07, '#wilayah');
        muncul(['#peta .chapter_header', '#map-chips', '#peta .island_grid'], 60, 1.1, 0.1, '#peta');
    });
}

export function initHome(heroDelay) {
    const controller = new AbortController();
    const { signal } = controller;
    const on = (el, type, fn) => el.addEventListener(type, fn, { signal });

    resetMapPanel();
    const railMedia = initRail(on);
    const animation = motionOK ? animateHome(heroDelay) : null;
    const sectionObserver = watchSections($$('#beranda, #wilayah, #peta'), (el) =>
        setNavCurrent($(`.pill-menu a[href="#${el.id}"]`)),
    );
    const destroyMap = initIslandMap(on, signal);

    return () => {
        controller.abort();
        sectionObserver.disconnect();
        railMedia?.revert();
        animation?.revert();
        destroyMap();
    };
}
