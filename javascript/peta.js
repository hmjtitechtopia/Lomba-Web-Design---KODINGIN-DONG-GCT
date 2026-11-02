import {
    $,
    $$,
    cetak,
    fmt,
    geo,
    heroPoster,
    kreditFoto,
    mapsURL,
    prefersReducedMotion,
    refreshIcons,
    regionById,
    regions,
    totals,
} from './script.js';

const span = (teks) => Object.assign(document.createElement('span'), { textContent: teks });
export const pesanPeta = (teks) => Object.assign(cetak('tpl-map-message'), { textContent: teks });

const CDN = 'https://cdn.jsdelivr.net/npm/';
const scriptCache = new Map();

function loadScript(src) {
    if (!scriptCache.has(src)) {
        const loading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => {
                scriptCache.delete(src);
                reject(new Error(`Gagal memuat ${src}`));
            };
            document.head.append(script);
        });
        scriptCache.set(src, loading);
    }
    return scriptCache.get(src);
}

async function ensureLeaflet() {
    await loadScript(`${CDN}leaflet@1.9.4/dist/leaflet.js`);
    await loadScript(`${CDN}leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js`);
    return window.L;
}

const PITA_LAUT = [
    [38, '#1b263b'],
    [24, '#283850'],
    [11, '#415a77'],
    [2, '#e0e1dd'],
];
const NAMA_LAUT = [
    ['Laut Bali', -8.03, 115.1],
    ['Samudra Hindia', -8.76, 114.82],
];

function terangkan(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const mix = (value, target) =>
        Math.round(value + (target - value) * 0.38)
            .toString(16)
            .padStart(2, '0');
    return `#${mix(r, 0xe0)}${mix(g, 0xe1)}${mix(b, 0xdd)}`;
}

const GARIS = { color: '#0d1b2a', weight: 1 };
const STYLE = {
    base: (fillColor) => ({ ...GARIS, opacity: 0.55, fillColor, fillOpacity: 1 }),
    dim: (fillColor) => ({ ...GARIS, opacity: 0.4, fillColor, fillOpacity: 0.35 }),
    hover: (fill) => ({
        color: '#e0e1dd',
        weight: 2,
        opacity: 1,
        fillColor: terangkan(fill),
        fillOpacity: 1,
    }),
    selected: { color: '#7f94af', weight: 3, opacity: 1, fillColor: '#e0e1dd', fillOpacity: 1 },
    other: { ...GARIS, opacity: 0.5, fillColor: '#415a77', fillOpacity: 1 },
};

function drawPitaLaut(L, map) {
    PITA_LAUT.forEach(([weight, color], i) => {
        const pane = `ombak${i}`;
        map.createPane(pane).style.zIndex = 300 + i;
        L.geoJSON(geo, {
            pane,
            renderer: L.svg({ pane, padding: 0.6 }),
            interactive: false,
            style: { color, weight, opacity: 1, fill: false, lineCap: 'round', lineJoin: 'round' },
        }).addTo(map);
    });
}

function drawNamaLaut(L, map) {
    map.createPane('namaLaut').style.zIndex = 390;
    for (const [nama, lat, lng] of NAMA_LAUT) {
        L.marker([lat, lng], {
            pane: 'namaLaut',
            interactive: false,
            keyboard: false,
            icon: L.divIcon({ className: 'sea-name', html: span(nama), iconSize: [160, 18] }),
        }).addTo(map);
    }
}

function titikTempat(L, place) {
    const popup = cetak('tpl-place-popup');
    $('strong', popup).textContent = place.nama;
    $('span', popup).textContent = `${place.kategori}, ${place.lokasi}`;
    $('a', popup).href = mapsURL(place.mapsQuery);

    const icon = L.divIcon({ className: 'place-marker', html: span(''), iconSize: [14, 14] });
    return L.marker([place.lat, place.lng], { riseOnHover: true, icon })
        .bindTooltip(span(place.nama), {
            direction: 'top',
            className: 'map-label-place',
            offset: [0, -10],
            opacity: 1,
        })
        .bindPopup(popup)
        .on('add', ({ target }) => target.getElement().setAttribute('aria-label', place.nama));
}

function drawKlasterTempat(L, map, places) {
    const cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 30,
        iconCreateFunction: (c) =>
            L.divIcon({
                html: span(c.getChildCount()),
                className: 'place-cluster',
                iconSize: [38, 38],
            }),
    });
    places.forEach((place) => titikTempat(L, place).addTo(cluster));
    map.addLayer(cluster);
    return cluster;
}

async function createBaliMap(container, { focusId, onSelect, signal }) {
    const L = await ensureLeaflet();
    if (signal.aborted) return null;
    container.replaceChildren();

    const map = L.map(container, {
        scrollWheelZoom: false,
        zoomSnap: 0.25,
        minZoom: 8,
        maxZoom: 15,
    });

    map.attributionControl.addAttribution($('#tpl-attribution').innerHTML.trim());
    let selectedId = null;
    let klaster = null;
    const colorOf = (id) => regionById.get(id).warna;
    const styleOf = (id) => {
        if (focusId) return id === focusId ? STYLE.selected : STYLE.other;
        if (!selectedId) return STYLE.base(colorOf(id));
        return id === selectedId ? STYLE.selected : STYLE.dim(colorOf(id));
    };

    drawPitaLaut(L, map);
    const layers = new Map();
    const geoLayer = L.geoJSON(geo, {
        className: 'map-region',
        style: (feature) => styleOf(feature.properties.id),
        onEachFeature(feature, layer) {
            const { id } = feature.properties;
            layers.set(id, layer);
            layer.bindTooltip(span(regionById.get(id).nama), {
                sticky: true,
                direction: 'top',
                className: 'map-label',
                offset: [0, -10],
                opacity: 1,
            });
            layer.on({
                mouseover() {
                    if (id === selectedId || id === focusId) return;
                    layer.setStyle(STYLE.hover(focusId ? '#415a77' : colorOf(id)));
                },
                mouseout: () => layer.setStyle(styleOf(id)),
                click() {
                    if (id !== selectedId && id !== focusId) onSelect(id);
                },
            });
        },
    }).addTo(map);

    const fullBounds = geoLayer.getBounds();
    map.setMaxBounds(fullBounds.pad(0.8));
    if (focusId) {
        const layer = layers.get(focusId);
        map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 11 });
        layer.bringToFront();
        drawKlasterTempat(L, map, regionById.get(focusId).tempat);
    } else {
        map.fitBounds(fullBounds, { padding: [20, 20] });
        drawNamaLaut(L, map);
    }

    function setWheel(active) {
        map.scrollWheelZoom[active ? 'enable' : 'disable']();
        container.toggleAttribute('data-lenis-prevent', active);
    }
    map.on('click focus', () => setWheel(true));
    map.on('blur', () => setWheel(false));
    container.addEventListener('mouseleave', () => setWheel(false), { signal });

    const fit = (bounds, options) =>
        map.flyToBounds(bounds, {
            padding: [36, 36],
            maxZoom: 11.5,
            duration: 0.9,
            animate: !prefersReducedMotion,
            ...options,
        });

    function setSelected(id) {
        selectedId = id;
        layers.forEach((layer, key) => layer.setStyle(styleOf(key)));
        klaster?.remove();
        klaster = id ? drawKlasterTempat(L, map, regionById.get(id).tempat) : null;
    }

    const waveObserver = new IntersectionObserver(([entry]) => {
        container.classList.toggle('map-paused', !entry.isIntersecting);
    });
    waveObserver.observe(container);

    return {
        select(id) {
            setSelected(id);
            const layer = layers.get(id);
            layer.bringToFront();
            fit(layer.getBounds());
        },
        reset() {
            setSelected(null);
            fit(fullBounds, { maxZoom: 10 });
        },
        destroy() {
            waveObserver.disconnect();
            map.remove();
        },
    };
}

export function chipWilayah(r) {
    const item = cetak('tpl-chip');
    const button = $('button', item);
    button.dataset.chip = r.id;
    button.textContent = r.namaPendek;
    button.style.setProperty('--swatch', r.warna);
    return item;
}

function isiPanel(template, foto, teks) {
    const panel = $('#map-panel');
    panel.replaceChildren($(template).content.cloneNode(true));

    const fig = $('.map-panel_photo', panel);
    Object.assign($('img', fig), { src: foto.src, alt: foto.alt });
    fig.after(kreditFoto(foto));

    for (const [field, value] of Object.entries(teks)) {
        $(`[data-field="${field}"]`, panel).textContent = value;
    }
    return panel;
}

function tandaiChip(id) {
    $$('#map-chips button').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.chip === id));
    });
    $('#btn-reset').hidden = !id;
    $('#map-hint').classList.toggle('is-hidden', Boolean(id));
}

export function resetMapPanel() {
    tandaiChip(null);
    isiPanel('#tpl-panel-empty', heroPoster, {
        wilayah: regions.length,
        kecamatan: totals.kec,
        desa: fmt(totals.desa + totals.kel),
    });
}

function renderMapPanel(r) {
    const panel = isiPanel('#tpl-panel-region', r.hero, {
        nama: r.nama,
        julukan: `“${r.julukan.teks}”`,
        ringkasan: r.ringkasan,
        'ibu-kota': r.ibuKota,
        luas: `${fmt(r.luasKm2)} km²`,
        desa: `${r.jumlahDesa} / ${r.jumlahKelurahan}`,
        tautan: `Jelajahi ${r.namaPendek}`,
    });
    $('.map-panel_action', panel).href = `#${r.id}`;
    refreshIcons();
}

export function initIslandMap(on, signal) {
    const container = $('#bali-map');
    let mapReady = null;

    function getMap() {
        mapReady ??= createBaliMap(container, { signal, onSelect: selectRegion }).catch((err) => {
            console.error(err);
            container.replaceChildren(
                pesanPeta('Peta gagal dimuat. Periksa koneksi internet lalu muat ulang.'),
            );
            mapReady = null;
            return null;
        });
        return mapReady;
    }

    async function selectRegion(id) {
        tandaiChip(id);
        renderMapPanel(regionById.get(id));
        (await getMap())?.select(id);
    }

    const observer = new IntersectionObserver(
        ([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            getMap();
        },
        { rootMargin: '600px 0px' },
    );
    observer.observe($('#peta'));

    on($('#map-chips'), 'click', (e) => {
        const chip = e.target.closest('[data-chip]');
        if (chip) selectRegion(chip.dataset.chip);
    });
    on($('#btn-reset'), 'click', async () => {
        resetMapPanel();
        (await getMap())?.reset();
    });

    return () => {
        observer.disconnect();
        mapReady?.then((map) => {
            if (!map) return;
            map.destroy();
            container.replaceChildren(pesanPeta('Memuat peta...'));
        });
    };
}

export function initMiniMap(r, signal, onSelect) {
    const container = $('#mini-map');
    let map = null;

    const observer = new IntersectionObserver(
        async ([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            try {
                map = await createBaliMap(container, { signal, focusId: r.id, onSelect });
            } catch (err) {
                console.error(err);
                container.replaceChildren(pesanPeta('Peta gagal dimuat. Periksa koneksi internet.'));
            }
        },
        { rootMargin: '500px 0px' },
    );
    observer.observe($('#penjelasan'));

    return () => {
        observer.disconnect();
        map?.destroy();
    };
}
