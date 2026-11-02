export const { heroPoster, regions, villages, geo, istilah } = window.ATLAS_KULTURAL_BALI;
export const { gsap, ScrollTrigger } = window;
const { Lenis } = window;
export const regionById = new Map(regions.map((r) => [r.id, r]));
export const SITE_NAME = document.title;
export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const motionOK = !prefersReducedMotion && Boolean(gsap && ScrollTrigger);
export const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
export const MUNCUL = { y: 0, opacity: 1, ease: 'expo.out', clearProps: 'transform,opacity' };

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const fmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format;

const sumOf = (key) => regions.reduce((total, r) => total + r[key], 0);
export const totals = {
    kec: sumOf('jumlahKecamatan'),
    desa: sumOf('jumlahDesa'),
    kel: sumOf('jumlahKelurahan'),
};

export const cetak = (id) => document.getElementById(id).content.firstElementChild.cloneNode(true);
export const mapsURL = (query) =>
    `https://www.google.com/maps/search/?${new URLSearchParams({ api: 1, query })}`;
export function kreditFoto(foto) {
    if (!foto.credit) return '';
    const { author, license, page, sumber } = foto.credit;
    const penulis = license ? `${author}, ${license}, Wikimedia Commons` : author;
    const text = sumber ? `Sumber: ${sumber}` : `Foto: ${penulis}`;
    const link = cetak('tpl-credit');
    if (page) link.href = page;
    link.title = text;
    link.textContent = text;
    return link;
}

export function fotoBulat(foto, kelas) {
    const fig = cetak('tpl-photo');
    if (kelas) fig.classList.add(kelas);

    Object.assign($('img', fig), { src: foto.src, alt: foto.alt });
    fig.append(kreditFoto(foto));
    if (foto.keterangan) {
        const note = cetak('tpl-photo-note');
        note.textContent = foto.keterangan;
        fig.append(note);
    }
    return fig;
}

export const refreshIcons = () => window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } });
export const lenis = motionOK && Lenis ? new Lenis({ duration: 1.1 }) : null;
if (motionOK) gsap.registerPlugin(ScrollTrigger);
if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
}

export const nav = $('#nav');
export const stickyH = () =>
    ($('#view-detail').hidden ? nav : $('#d-tabs')).getBoundingClientRect().bottom + 12;

export function scrollToY(y, immediate = false) {
    lenis?.resize();
    if (immediate) window.scrollTo(0, y);
    if (lenis) lenis.scrollTo(y, { duration: 1.3, immediate, force: true });
    else if (!immediate) window.scrollTo({ top: y, behavior: scrollBehavior });
}

export function scrollToEl(el, immediate = false) {
    const offset = el.matches('#beranda, .region-list-pinned') ? 0 : -stickyH();
    scrollToY(el.getBoundingClientRect().top + window.scrollY + offset, immediate);
}

function initPill(pill) {
    const blob = $('.pill_indicator', pill);
    const ul = $('ul', pill);
    const scroller = $('.pill_scroll', pill) || pill;
    const links = $$('ul a', pill);
    let pointed = null;
    let lockUntil = 0;
    const activeLink = () => links.find((a) => a.hasAttribute('aria-current')) || null;
    function place(link, instant = false) {
        links.forEach((a) => a.classList.toggle('current', a === link));
        if (!link) {
            pill.classList.remove('ready');
            return;
        }
        if (instant || !pill.classList.contains('ready')) pill.classList.add('no-animation');
        blob.style.setProperty('--x', `${ul.offsetLeft + link.offsetLeft}px`);
        blob.style.setProperty('--w', `${link.offsetWidth}px`);
        pill.classList.add('ready');
        void blob.offsetWidth;
        pill.classList.remove('no-animation');
    }

    const point = (link) => {
        pointed = link;
        place(link || activeLink());
    };
    const reposition = () => place(pointed || activeLink(), true);

    function setCurrent(link, force = false) {
        if (!force && performance.now() < lockUntil) return;
        links.forEach((a) => {
            if (a === link) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
        });
        if (!pointed) place(link);
        if (link && scroller.scrollWidth > scroller.clientWidth) {
            const left = ul.offsetLeft + link.offsetLeft - (scroller.clientWidth - link.offsetWidth) / 2;
            scroller.scrollTo({ left, behavior: scrollBehavior });
        }
    }

    pill.addEventListener('pointerover', (e) => {
        const link = e.target.closest('ul a');
        if (link && e.pointerType === 'mouse') point(link);
    });
    pill.addEventListener('pointerleave', () => point(null));
    pill.addEventListener('click', (e) => {
        const link = e.target.closest('ul a');
        if (!link) return;
        pointed = null;
        setCurrent(link, true);
        lockUntil = performance.now() + 1500;
    });
    pill.addEventListener('focusin', (e) => {
        const link = e.target.closest('ul a');
        if (link?.matches(':focus-visible')) point(link);
    });
    pill.addEventListener('focusout', (e) => {
        if (!pill.contains(e.relatedTarget)) point(null);
    });
    window.addEventListener('resize', reposition);
    document.fonts.ready.then(reposition);
    return setCurrent;
}

export const setNavCurrent = initPill($('.pill-menu'));
export const setTabCurrent = initPill($('.pill-section'));
export function watchSections(sections, onChange) {
    const visible = new Map(sections.map((el) => [el, 0]));
    let last = null;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                visible.set(entry.target, entry.isIntersecting ? entry.intersectionRect.height : 0);
            });
            const best = sections.reduce((a, b) => (visible.get(b) > visible.get(a) + 1 ? b : a));
            if (visible.get(best) > 1 && best !== last) {
                last = best;
                onChange(best);
            }
        },
        { threshold: Array.from({ length: 51 }, (_, i) => i / 50) },
    );
    sections.forEach((el) => observer.observe(el));
    return observer;
}
