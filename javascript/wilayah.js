import {
    $,
    $$,
    MUNCUL,
    SITE_NAME,
    ScrollTrigger,
    cetak,
    clamp,
    fmt,
    fotoBulat,
    gsap,
    istilah,
    kreditFoto,
    lenis,
    mapsURL,
    motionOK,
    refreshIcons,
    scrollBehavior,
    scrollToY,
    setTabCurrent,
    stickyH,
    villages,
    watchSections,
} from './script.js';
import { initMiniMap, pesanPeta } from './peta.js';

export function kartuWilayah(r) {
    const card = cetak('tpl-region-card');
    const foto = r.hero;
    const link = $('.region-card_link', card);

    $('.region-card_name', card).textContent = r.namaPendek;
    $('.region-card_nickname', card).textContent = r.julukan.teks;
    Object.assign($('img', card), { src: foto.src, alt: foto.alt });
    $('.region-card_media', card).append(kreditFoto(foto));
    link.href = `#${r.id}`;
    link.setAttribute('aria-label', `Jelajahi ${r.namaPendek}`);
    return card;
}

export function initRail(on) {
    const section = $('#wilayah');
    const rail = $('#rail');
    const track = $('#rail-track');
    const prev = $('#rail-prev');
    const next = $('#rail-next');
    const cards = $$('.region-card', track);
    let pinned = null;

    const step = () => cards[1].offsetLeft - cards[0].offsetLeft;

    function setProgress(progress) {
        $('#rail-bar').style.setProperty('--p', Math.max(0.06, progress).toFixed(4));
        prev.disabled = progress < 0.01;
        next.disabled = progress > 0.99;
    }

    function syncRail() {
        if (pinned) return;
        setProgress(rail.scrollLeft / Math.max(1, rail.scrollWidth - rail.clientWidth));
    }

    function moveRail(direction) {
        if (pinned) pinned.moveBy(direction);
        else rail.scrollBy({ left: direction * step(), behavior: scrollBehavior });
    }

    function pushButton(button, direction) {
        moveRail(direction);
        button.classList.remove('pressed');
        void button.offsetWidth;
        button.classList.add('pressed');
    }

    function pinRail() {
        const stage = $('#regions-stage');
        const distance = () => Math.max(0, track.scrollWidth - rail.clientWidth);
        const nearestSnap = (value) => {
            const total = distance() || 1;
            const points = cards.map((card) =>
                clamp((card.offsetLeft - cards[0].offsetLeft) / total, 0, 1),
            );
            return [...points, 1].reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
        };

        section.classList.add('region-list-pinned');
        const tween = gsap.to(track, {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
                trigger: stage,
                pin: true,
                start: () => (stage.offsetHeight > window.innerHeight ? 'bottom bottom' : 'top top'),
                end: () => `+=${distance()}`,
                scrub: true,
                invalidateOnRefresh: true,
                anticipatePin: 1,
                snap: {
                    snapTo: nearestSnap,
                    inertia: false,
                    duration: { min: 0.15, max: 0.35 },
                    delay: 0.05,
                    ease: 'power2.out',
                },
                onUpdate: (self) => setProgress(self.progress),
            },
        });

        const trigger = tween.scrollTrigger;
        const scrollFor = (x) => trigger.start + clamp(x, 0, distance());
        pinned = {
            moveBy: (direction) => {
                scrollToY(scrollFor(trigger.progress * distance() + direction * step()));
            },
            reveal: (card) => scrollToY(scrollFor(card.offsetLeft - cards[0].offsetLeft), true),
        };
        setProgress(0);

        return () => {
            section.classList.remove('region-list-pinned');
            pinned = null;
            syncRail();
        };
    }

    on(rail, 'scroll', syncRail);
    on(prev, 'click', () => pushButton(prev, -1));
    on(next, 'click', () => pushButton(next, 1));
    on(rail, 'keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        moveRail(e.key === 'ArrowRight' ? 1 : -1);
    });
    on(track, 'focusin', (e) => {
        const card = e.target.closest('.region-card');
        if (card && pinned && e.target.matches(':focus-visible')) pinned.reveal(card);
    });

    requestAnimationFrame(syncRail);
    if (!motionOK) return null;

    const matchMedia = gsap.matchMedia();
    matchMedia.add('(min-width: 1024px) and (min-height: 560px)', pinRail);
    return matchMedia;
}

const artiIstilah = new Map(
    Object.entries(istilah).map(([kata, arti]) => [kata.toLowerCase(), arti]),
);
const polaIstilah = new RegExp(
    `(?<![\\p{L}-])(${Object.keys(istilah)
        .sort((a, b) => b.length - a.length)
        .join('|')})(?![\\p{L}-])`,
    'gu',
);

function isiIstilah(el, teks) {
    const ditandai = new Set();
    const isi = [];
    let awal = 0;

    for (const match of teks.matchAll(polaIstilah)) {
        const kunci = match[0].toLowerCase();
        if (ditandai.has(kunci)) continue;
        ditandai.add(kunci);

        const tombol = cetak('tpl-term');
        tombol.textContent = match[0];
        tombol.dataset.term = kunci;
        isi.push(teks.slice(awal, match.index), tombol);
        awal = match.index + match[0].length;
    }
    isi.push(teks.slice(awal));
    el.replaceChildren(...isi);
    return el;
}

const gelembung = $('#term-tip');
let istilahAktif = null;
let istilahTerkunci = false;

function tutupIstilah() {
    gelembung.hidden = true;
    istilahAktif?.removeAttribute('aria-describedby');
    istilahAktif = null;
    istilahTerkunci = false;
}

function bukaIstilah(tombol) {
    istilahAktif?.removeAttribute('aria-describedby');
    istilahAktif = tombol;
    $('#term-tip-name').textContent = tombol.textContent;
    $('#term-tip-text').textContent = artiIstilah.get(tombol.dataset.term);
    tombol.setAttribute('aria-describedby', 'term-tip');
    gelembung.hidden = false;

    const margin = 12;
    const jarak = 10;
    const kotak = tombol.getClientRects()[0];
    const tinggi = gelembung.offsetHeight;
    const keBawah = kotak.top - tinggi - jarak < stickyH();
    const maxLeft = window.innerWidth - gelembung.offsetWidth - margin;
    gelembung.style.left = `${clamp(kotak.left, margin, maxLeft)}px`;
    gelembung.style.top = `${keBawah ? kotak.bottom + jarak : kotak.top - tinggi - jarak}px`;
}

document.addEventListener('click', (e) => {
    const tombol = e.target.closest('.term');
    if (tombol) {
        if (tombol === istilahAktif && istilahTerkunci) {
            tutupIstilah();
        } else {
            bukaIstilah(tombol);
            istilahTerkunci = true;
        }
    } else if (!e.target.closest('#term-tip')) {
        tutupIstilah();
    }
});
document.addEventListener('mouseover', (e) => {
    const tombol = e.target.closest('.term');
    if (tombol && !istilahTerkunci && window.matchMedia('(hover: hover)').matches) {
        bukaIstilah(tombol);
    }
});
document.addEventListener('mouseout', (e) => {
    if (e.target.closest('.term') && !istilahTerkunci) tutupIstilah();
});
document.addEventListener('focusin', (e) => {
    if (e.target.matches('.term:focus-visible')) bukaIstilah(e.target);
});
document.addEventListener('focusout', (e) => {
    if (e.target.matches('.term') && !istilahTerkunci) tutupIstilah();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') tutupIstilah();
});
window.addEventListener('scroll', tutupIstilah, { passive: true });
window.addEventListener('resize', tutupIstilah);

function butir(item) {
    const li = cetak('tpl-item');
    li.prepend(fotoBulat(item.gambar));
    $('h3', li).textContent = item.nama;
    $('.item_status', li).textContent = item.status;
    $('.item_location', li).textContent = item.lokasi;
    isiIstilah($('.item_description', li), item.deskripsi);
    return li;
}

function kartuTempat(place) {
    const li = cetak('tpl-place');
    li.prepend(fotoBulat(place.gambar));
    $('h3', li).textContent = place.nama;
    $('.place-location', li).textContent = place.lokasi;
    isiIstilah($('.place-description', li), place.deskripsi);
    $('.place-coordinates', li).textContent = `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;
    $('.button-dark-small', li).href = mapsURL(place.mapsQuery);
    return li;
}

function setFact(selector, value) {
    const el = $(selector);
    el.dataset.count = value;
    el.textContent = fmt(value);
}

function renderRegion(r) {
    const julukan = `“${r.julukan.teks}”`;

    $('#bc-current').textContent = r.namaPendek;
    $('#d-title').textContent = r.nama;
    $('#d-julukan').textContent = julukan;
    $('#d-lead').textContent = r.ringkasan;
    $('#d-capital').textContent = r.ibuKota;
    Object.assign($('#d-capital-note'), {
        textContent: r.ibuKotaCatatan,
        hidden: !r.ibuKotaCatatan,
    });
    setFact('#d-area', r.luasKm2);
    setFact('#d-population', r.penduduk);
    setFact('#d-districts', r.jumlahKecamatan);
    $('#d-villages').textContent = `${r.jumlahDesa} / ${r.jumlahKelurahan}`;
    $('#d-plate').replaceChildren(fotoBulat(r.hero, 'photo-tall'));

    $('#d-name-em').textContent = r.namaPendek;
    $('#d-penjelasan').replaceChildren(
        ...r.penjelasan.map((teks) => isiIstilah(document.createElement('p'), teks)),
    );
    isiIstilah($('#d-sejarah'), r.sejarah);

    const [julukanTeks, julukanKeterangan] = $$('#d-julukan-card p');
    julukanTeks.textContent = julukan;
    julukanKeterangan.textContent = r.julukan.keterangan;

    $('#mini-map').replaceChildren(pesanPeta('Memuat peta lokasi...'));
    $('#tradisi-list').replaceChildren(...r.tradisi.map(butir));
    $('#seni-list').replaceChildren(...r.seni.map(butir));
    $('#tempat-list').replaceChildren(...r.tempat.map(kartuTempat));
}

function initPlaceStrip(on) {
    const strip = $('#tempat-list');
    const prev = $('#tempat-prev');
    const next = $('#tempat-next');
    const step = () => strip.children[1].offsetLeft - strip.children[0].offsetLeft;
    const syncStrip = () => {
        prev.disabled = strip.scrollLeft < 8;
        next.disabled = strip.scrollLeft + strip.clientWidth > strip.scrollWidth - 8;
    };

    strip.scrollLeft = 0;
    on(prev, 'click', () => strip.scrollBy({ left: -step(), behavior: scrollBehavior }));
    on(next, 'click', () => strip.scrollBy({ left: step(), behavior: scrollBehavior }));
    on(strip, 'scroll', syncStrip);
    requestAnimationFrame(syncStrip);
}

function countUpFacts(delay) {
    $$('#d-facts [data-count]').forEach((el) => {
        const target = Number(el.dataset.count);
        const finalText = el.textContent;
        const skala = Number.isInteger(target) ? 1 : 10;
        const counter = { value: 0 };

        el.textContent = fmt(0);
        gsap.to(counter, {
            value: target,
            duration: 1.9,
            ease: 'expo.out',
            delay: delay + 0.45,
            onUpdate: () => {
                el.textContent = fmt(Math.round(counter.value * skala) / skala);
            },
            onComplete: () => {
                el.textContent = finalText;
            },
        });
    });
}

function animateDetail(delay) {
    return gsap.context(() => {
        gsap
            .timeline({ defaults: { ease: 'expo.out' }, delay })
            .fromTo('.pill-section', { y: -28, opacity: 0.001 }, { y: 0, opacity: 1, duration: 0.9 }, 0.1)
            .fromTo(
                '.region-header_text > *',
                { y: 46, opacity: 0.001 },
                { y: 0, opacity: 1, duration: 1.2, stagger: 0.07 },
                0,
            )
            .fromTo(
                '.region-header_photo .photo',
                { clipPath: 'inset(14% 12% 14% 12% round 56px)' },
                { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 1.6, clearProps: 'clipPath' },
                0,
            )
            .fromTo(
                '.region-header_photo img',
                { scale: 1.28 },
                { scale: 1, duration: 2, clearProps: 'transform' },
                0,
            )
            .fromTo(
                '#d-facts > div',
                { y: 30, opacity: 0.001 },
                { y: 0, opacity: 1, duration: 1, stagger: 0.06 },
                0.35,
            );

        countUpFacts(delay);

        const reveal =
            '.chapter_header, .about_body > p, .about_block, .mini-map, .item, .row-header, ' +
            '.place-row > li, .village-tools, #v-list';
        gsap.set(reveal, { y: 56, opacity: 0.001 });
        ScrollTrigger.batch(reveal, {
            start: 'top 90%',
            once: true,
            onEnter: (els) => {
                gsap.to(els, { ...MUNCUL, duration: 1.1, stagger: 0.08, overwrite: true });
            },
        });

        $$('.item .photo img, .place-row .photo img').forEach((img) => {
            gsap.fromTo(
                img,
                { scale: 1.18 },
                {
                    scale: 1,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: img.parentElement,
                        start: 'top bottom',
                        end: 'center 55%',
                        scrub: true,
                    },
                },
            );
        });
    }, '#view-detail');
}

export function initDetail(r, { goTo, entranceDelay }) {
    const controller = new AbortController();
    const { signal } = controller;
    const on = (el, type, fn) => el.addEventListener(type, fn, { signal });

    document.title = `${r.nama} | ${SITE_NAME}`;
    renderRegion(r);
    renderVillages(r, on);
    refreshIcons();
    initPlaceStrip(on);
    setTabCurrent(null);

    const sectionObserver = watchSections($$('#view-detail > section'), (el) =>
        setTabCurrent($(`#d-tabs a[href="#${el.id}"]`)),
    );
    const destroyMiniMap = initMiniMap(r, signal, goTo);
    const animation = motionOK ? animateDetail(entranceDelay) : null;

    return () => {
        controller.abort();
        sectionObserver.disconnect();
        destroyMiniMap();
        animation?.revert();
        lenis?.start();
    };
}

const norm = (s) =>
    s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();

function highlight(label, query) {
    const name = label.dataset.label;
    const index = query ? norm(name).indexOf(query) : -1;
    if (index < 0) {
        label.textContent = name;
        return;
    }
    const end = index + query.length;
    const mark = Object.assign(document.createElement('mark'), {
        textContent: name.slice(index, end),
    });
    label.replaceChildren(name.slice(0, index), mark, name.slice(end));
}

function setOpen(kecamatan, open) {
    $('.district_button', kecamatan).setAttribute('aria-expanded', String(open));
    $('.district_panel', kecamatan).hidden = !open;
}

function desaEl(desa, kecamatan, kabupaten) {
    const li = cetak('tpl-village');
    const link = $('a', li);
    li.dataset.name = norm(desa.nama);
    li.dataset.jenis = desa.jenis;
    link.href = mapsURL(`${desa.jenis} ${desa.nama}, Kecamatan ${kecamatan}, ${kabupaten}, Bali`);
    link.setAttribute(
        'aria-label',
        `${desa.jenis} ${desa.nama}, Kecamatan ${kecamatan}, buka di Google Maps (tab baru)`,
    );
    $('[data-label]', li).dataset.label = desa.nama;
    if (desa.jenis !== 'Kelurahan') $('small', li).remove();
    return li;
}

function kecamatanEl(kecamatan, open, kabupaten) {
    const panelId = `kec-${kecamatan.kode.replace(/\./g, '-')}`;
    const el = cetak('tpl-kec');
    const button = $('.district_button', el);
    const panel = $('.district_panel', el);

    el.dataset.kec = kecamatan.kode;
    button.id = `${panelId}-btn`;
    button.setAttribute('aria-controls', panelId);
    panel.id = panelId;
    panel.setAttribute('aria-labelledby', button.id);
    setOpen(el, open);
    $('.district_name', el).textContent = `Kecamatan ${kecamatan.nama}`;
    $('.village-list', el).append(
        ...kecamatan.desa.map((desa) => desaEl(desa, kecamatan.nama, kabupaten)),
    );
    return el;
}

function opsiKecamatan(nilai, nama, jumlah) {
    const li = cetak('tpl-kec-option');
    li.dataset.value = nilai;
    $('.district-select_name', li).textContent = nama;
    $('.district-select_count', li).textContent = jumlah;
    return li;
}

function initKecamatanSelect(daftar, total, on, onChange) {
    const box = $('#v-kecamatan-box');
    const button = $('#v-kecamatan-btn');
    const panel = $('#v-kecamatan-panel');
    const scrim = $('#v-kecamatan-scrim');
    const list = $('#v-kecamatan');
    const label = $('#v-kecamatan-label');
    const opsi = [
        opsiKecamatan('', 'Semua kecamatan', total),
        ...daftar.map((k) => opsiKecamatan(k.kode, `Kecamatan ${k.nama}`, k.desa.length)),
    ];

    const isOpen = () => !panel.hidden;

    function sorot(el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest' });
    }

    function close(restoreFocus = true) {
        if (!isOpen()) return;
        panel.hidden = true;
        scrim.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        lenis?.start();
        if (restoreFocus) button.focus({ preventScroll: true });
    }

    function open() {
        panel.hidden = false;
        scrim.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        if (window.matchMedia('(max-width: 640px)').matches) lenis?.stop();
        sorot($('[aria-selected="true"]', list));
    }

    function pick(el) {
        opsi.forEach((o) => o.setAttribute('aria-selected', String(o === el)));
        label.textContent = $('.district-select_name', el).textContent;
        close();
        onChange(el.dataset.value);
    }

    list.replaceChildren(...opsi);
    opsi[0].setAttribute('aria-selected', 'true');
    label.textContent = 'Semua kecamatan';
    close(false);

    on(button, 'click', () => (isOpen() ? close() : open()));
    on(button, 'keydown', (e) => {
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isOpen()) {
            e.preventDefault();
            open();
        }
    });
    on(scrim, 'click', () => close());
    on(list, 'click', (e) => {
        const option = e.target.closest('[role="option"]');
        if (option) pick(option);
    });
    on(list, 'keydown', (e) => {
        const index = opsi.indexOf(document.activeElement);
        const tujuan = {
            ArrowDown: opsi[index + 1],
            ArrowUp: opsi[index - 1],
            Home: opsi[0],
            End: opsi.at(-1),
        }[e.key];

        if (tujuan) {
            e.preventDefault();
            sorot(tujuan);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (opsi[index]) pick(opsi[index]);
        } else if (e.key === 'Escape') {
            e.stopPropagation();
            close();
        } else if (e.key === 'Tab') {
            close(false);
        }
    });
    on(document, 'pointerdown', (e) => {
        if (isOpen() && !box.contains(e.target)) close(false);
    });
}

function renderVillages(r, on) {
    const list = $('#v-list');
    const search = $('#v-search');
    const daftar = villages[r.id];
    const total = r.jumlahDesa + r.jumlahKelurahan;
    let kecNilai = '';
    let searchTimer;

    function apply({ autoExpand = true } = {}) {
        const query = norm(search.value);
        const jenis = $('#v-jenis input:checked').value;
        let totalShown = 0;

        $$('.district', list).forEach((kecamatan) => {
            const items = $$('li', kecamatan);
            const kecamatanMatches = !kecNilai || kecamatan.dataset.kec === kecNilai;
            let shown = 0;

            items.forEach((li) => {
                const visible =
                    kecamatanMatches &&
                    (!query || li.dataset.name.includes(query)) &&
                    (!jenis || li.dataset.jenis === jenis);
                li.hidden = !visible;
                if (visible) shown += 1;
                highlight($('[data-label]', li), visible ? query : '');
            });

            kecamatan.hidden = shown === 0;
            $('.district_count', kecamatan).textContent =
                shown === items.length ? `${shown} desa/kel.` : `${shown} dari ${items.length}`;
            if (autoExpand && (query || kecNilai) && shown > 0) setOpen(kecamatan, true);
            totalShown += shown;
        });

        $('#v-empty').hidden = totalShown > 0;
        $('#v-count-shown').textContent = totalShown;
        $('#v-count-query').textContent = query ? ` untuk “${search.value.trim()}”` : '';
    }

    $('#desa-intro').textContent =
        `${r.nama} terdiri atas ${r.jumlahKecamatan} kecamatan, ${r.jumlahDesa} desa, ` +
        `dan ${r.jumlahKelurahan} kelurahan. Setiap nama membuka Google Maps di tab baru.`;
    list.replaceChildren(...daftar.map((k, i) => kecamatanEl(k, i === 0, r.nama)));
    search.value = '';
    $('#v-jenis input').checked = true;
    $('#v-count-total').textContent = total;

    initKecamatanSelect(daftar, total, on, (nilai) => {
        kecNilai = nilai;
        apply();
    });

    on(search, 'input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(apply, 120);
    });
    $$('#v-jenis input').forEach((input) => {
        on(input, 'change', () => apply({ autoExpand: false }));
    });
    on($('#v-expand'), 'click', () => {
        $$('.district:not([hidden])', list).forEach((kecamatan) => setOpen(kecamatan, true));
    });
    on($('#v-collapse'), 'click', () => {
        $$('.district', list).forEach((kecamatan) => setOpen(kecamatan, false));
    });
    on(list, 'click', (e) => {
        const button = e.target.closest('.district_button');
        if (!button) return;

        const kecamatan = button.closest('.district');
        const open = button.getAttribute('aria-expanded') !== 'true';
        setOpen(kecamatan, open);
        if (open && motionOK) {
            gsap.fromTo(
                $$('.village-list li:not([hidden])', kecamatan).slice(0, 80),
                { y: 14, opacity: 0.001 },
                { ...MUNCUL, duration: 0.55, stagger: 0.012 },
            );
        }
    });

    apply({ autoExpand: false });
}
