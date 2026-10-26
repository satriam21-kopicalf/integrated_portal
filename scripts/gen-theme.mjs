// Generates src/app/theme-colors.css: every Tailwind colour as a CSS variable, light and dark.
//
// Each family gets three roles, so one class name works in both themes:
//   --b-<family>-<step>  backgrounds, gradients, fills, shadows (bg-*, from-*, fill-*)
//   --t-<family>-<step>  text and placeholders (text-*)
//   --l-<family>-<step>  borders, rings, dividers, outlines (border-*, ring-*, divide-*)
// Light = the stock Tailwind palette. Dark: surfaces go dark (white = card, 50 = page),
// neutral text goes light, tinted backgrounds (50-300) become dark tints of the hue, and
// coloured text moves to its light steps; solid fills (500-700) keep their hue so white
// text on buttons and badges stays readable.
//
// Run: node scripts/gen-theme.mjs   (then commit the CSS)
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
// Kopi Calf Operations palette (2026-10-25): white, the blue of the logo (#0E46C7 = blue-600, the primary colour) and a dark
// red accent (maroon, 700 = #7E2226). Status colours (red, amber, emerald) stay the stock Tailwind ones.
const tailwind = require('tailwindcss/colors');
const BRAND = {
  blue: { 50: '#eef3ff', 100: '#dce6fe', 200: '#bfd1fc', 300: '#93b2f8', 400: '#5f8bf0', 500: '#3366e3', 600: '#0e46c7',
    700: '#0b3aa6', 800: '#0e3286', 900: '#112c6b', 950: '#0c1b44' },
  maroon: { 50: '#fbf3f3', 100: '#f6e3e3', 200: '#eecbcb', 300: '#e0a3a4', 400: '#cb6e70', 500: '#b14548', 600: '#962d31',
    700: '#7e2226', 800: '#691e22', 900: '#591d20', 950: '#310c0e' },
};
// Wasgee Tea (ESB company CALF7, 2026-10-26): white + dark orange. While that brand is chosen (lib/company.tsx sets
// html.brand-wasgee) the primary colour (blue) becomes dark orange (600 = #C94A0B) and the accent (maroon) a deep brown.
const BRAND_THEMES = {
  'brand-wasgee': {
    blue: { 50: '#fff6ed', 100: '#ffead5', 200: '#fdd0aa', 300: '#fbad74', 400: '#f7803c', 500: '#ea5f16', 600: '#c94a0b',
      700: '#a53b0c', 800: '#843112', 900: '#6b2a12', 950: '#3a1306' },
    maroon: { 50: '#faf5f0', 100: '#f2e6d9', 200: '#e5ccb3', 300: '#d1a682', 400: '#b8794f', 500: '#9a5a33', 600: '#7f4627',
      700: '#673920', 800: '#55301d', 900: '#47291b', 950: '#28140c' },
  },
};

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const NEUTRALS = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
const HUES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'maroon'];
const SURFACE = '#0f172a';

const rgb = hex => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const triplet = c => (Array.isArray(c) ? c : rgb(c)).map(Math.round).join(' ');
const mix = (a, b, w) => rgb(a).map((v, i) => v * w + rgb(b)[i] * (1 - w));

// neutral roles in the dark theme (slate based, used for every grey family)
const DARK_NEUTRAL = {
  b: { white: '#0f172a', 50: '#0b1120', 100: '#1e293b', 200: '#334155', 300: '#475569', 400: '#64748b', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#334155', 900: '#475569', 950: '#334155' },
  t: { white: '#ffffff', 50: '#f8fafc', 100: '#e2e8f0', 200: '#64748b', 300: '#5b6b82', 400: '#7c8ba1', 500: '#94a3b8', 600: '#b4c0d0', 700: '#cbd5e1', 800: '#e2e8f0', 900: '#f1f5f9', 950: '#f8fafc' },
  l: { white: '#0f172a', 50: '#1e293b', 100: '#1e293b', 200: '#2b3a52', 300: '#3b4a63', 400: '#55657d', 500: '#64748b', 600: '#7c8ba1', 700: '#94a3b8', 800: '#cbd5e1', 900: '#e2e8f0', 950: '#f1f5f9' },
};

function darkHue(p) {
  return {
    b: { 50: mix(p[500], SURFACE, 0.12), 100: mix(p[500], SURFACE, 0.2), 200: mix(p[500], SURFACE, 0.3), 300: mix(p[500], SURFACE, 0.45),
      400: p[400], 500: p[500], 600: p[600], 700: p[600], 800: p[700], 900: p[800], 950: p[900] },
    t: { 50: p[50], 100: p[100], 200: p[200], 300: p[300], 400: p[300], 500: p[400], 600: p[400], 700: p[300], 800: p[200], 900: p[100], 950: p[50] },
    l: { 50: mix(p[500], SURFACE, 0.18), 100: mix(p[500], SURFACE, 0.25), 200: mix(p[500], SURFACE, 0.35), 300: mix(p[500], SURFACE, 0.5),
      400: p[500], 500: p[500], 600: p[500], 700: p[400], 800: p[300], 900: p[200], 950: p[100] },
  };
}

const light = [];
const dark = [];
for (const role of ['b', 't', 'l']) {
  light.push(`  --${role}-white: 255 255 255;`, `  --${role}-black: 0 0 0;`);
  dark.push(`  --${role}-white: ${triplet(DARK_NEUTRAL[role].white)};`, `  --${role}-black: ${role === 't' ? '241 245 249' : '0 0 0'};`);
}
for (const fam of [...NEUTRALS, ...HUES]) {
  const p = BRAND[fam] ?? tailwind[fam];
  const d = NEUTRALS.includes(fam) ? DARK_NEUTRAL : darkHue(p);
  for (const role of ['b', 't', 'l']) {
    for (const s of STEPS) {
      light.push(`  --${role}-${fam}-${s}: ${triplet(p[s])};`);
      dark.push(`  --${role}-${fam}-${s}: ${triplet(d[role][s])};`);
    }
  }
}

// brand themes: only their families, light then dark (html.dark.brand-x outranks html.brand-x and html.dark)
const brandCss = Object.entries(BRAND_THEMES).map(([cls, fams]) => {
  const l = [], d = [];
  for (const [fam, p] of Object.entries(fams)) {
    const dh = darkHue(p);
    for (const role of ['b', 't', 'l']) {
      for (const s of STEPS) {
        l.push(`  --${role}-${fam}-${s}: ${triplet(p[s])};`);
        d.push(`  --${role}-${fam}-${s}: ${triplet(dh[role][s])};`);
      }
    }
  }
  return `\nhtml.${cls} {\n${l.join('\n')}\n}\n\nhtml.dark.${cls} {\n${d.join('\n')}\n}\n`;
}).join('');

const css = `/* Generated by scripts/gen-theme.mjs: Tailwind colours as variables, light and dark. Do not edit. */
:root {
${light.join('\n')}
}

html.dark {
  color-scheme: dark;
${dark.join('\n')}
}
${brandCss}`;
writeFileSync(new URL('../src/app/theme-colors.css', import.meta.url), css);
console.log(`theme-colors.css: ${light.length} variables per theme`);
