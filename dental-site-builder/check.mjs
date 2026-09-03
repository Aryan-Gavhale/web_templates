/* Headless render check for the dental templates.
   Loads a built site in jsdom, lets site.js hydrate, then asserts the
   client.js overrides actually reached the DOM. */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const target = process.argv[2];
const dir = resolve(target);
const html = readFileSync(join(dir, 'index.html'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  virtualConsole: vc,
  pretendToBeVisual: true,
});
const { window } = dom;

// jsdom has no IntersectionObserver; site.js uses it for the lazy map.
window.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ isIntersecting: true, target: el }], this); }
  unobserve() {} disconnect() {}
};
window.matchMedia = window.matchMedia || (() => ({
  matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
}));

for (const file of ['site-config.js', 'client.js', 'site.js']) {
  window.eval(readFileSync(join(dir, 'assets', 'js', file), 'utf8'));
}
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

const $ = (s) => window.document.querySelector(s);
const $$ = (s) => [...window.document.querySelectorAll(s)];
const txt = (s) => ($(s)?.textContent || '').trim();
const cfg = window.SITE_CONFIG;

// Repeats render real elements, not the <template> that seeds them.
const rendered = (sel) => $$(sel).filter((n) => !n.closest('template')).length;

const report = {
  target,
  errors,
  title: window.document.title,
  themeColor: $('meta[name="theme-color"]')?.getAttribute('content'),
  description: $('meta[name="description"]')?.getAttribute('content')?.slice(0, 60),
  brandVar: window.document.documentElement.style.getPropertyValue('--brand')
         || window.document.documentElement.style.getPropertyValue('--acc'),
  merged: {
    businessName: cfg.business?.name,
    city: cfg.business?.city,
    phone: cfg.contact?.phoneDisplay,
    teamCount: cfg.team?.members?.length,
    galleryCount: cfg.gallery?.images?.length,
    hoursCount: cfg.hours?.length,
    statsCount: cfg.stats?.length,
    // Not in the CSV row — proves defaults survive the merge.
    keptDefaultConsultHeading: (cfg.consult?.heading || '').slice(0, 34),
  },
  dom: {
    stats: rendered('[data-repeat="stats"] > *'),
    team: rendered('[data-repeat="team.members"] > *'),
    gallery: rendered('[data-repeat="gallery.images"] > *'),
    hours: rendered('[data-repeat="hours"] > *'),
    telHref: $('a[href^="tel:"]')?.getAttribute('href'),
    mapSrc: ($('[data-map] iframe')?.getAttribute('src') || '').slice(0, 52),
    dockPresent: !!$('[data-dock]'),
    unresolvedBindings: $$('[data-bind]')
      .filter((n) => /\{\{|__/.test(n.textContent || '')).length,
  },
  sampleText: {
    firstTeamName: txt('[data-repeat="team.members"] [data-field="name"]'),
    firstStatLabel: txt('[data-repeat="stats"] [data-field="label"]'),
  },
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
