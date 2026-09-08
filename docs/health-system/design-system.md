# SozoRock Health design system

VERIFIED against the implemented CSS and production build, September 2026. Source: app/health-system.css, app/publications/publications.module.css, app/layout.tsx and Health shell components in apps/public-site.

## Typography

Instrument Sans variable, Latin subset, next/font/google, display swap. Build-generated WOFF2 files are served locally under /_next/static/media/. Full SIL Open Font License: public/licenses/instrument-sans-OFL.txt. Fallbacks: Helvetica Neue, Arial, sans-serif. Existing DM Sans/Newsreader variables remain for untouched application surfaces; Health uses Instrument Sans. All sizes below are CSS pixels.

| Role | Desktop 1200–1599 | Tablet 600–899 | Mobile ≤599 | Weight / line height / tracking |
|---|---|---|---|---|
| Home H1 | clamp(56px,4.5vw,72px); 80px at ≥1600 | 64 | clamp(39px,10.5vw,56px) | 650 / 1.04; mobile1.06 / −.04em |
| Capability H2 | 44 | 36 | 32 | 650 / 1.12; mobile1.13 / −.04em |
| Capability disclosure | 26 | 23 | 22 | 600 / 1.2 / −.025em |
| Opening paragraph | 21 | 19 | 18 | 400 / 1.48; mobile1.5 / normal |
| Capability detail | 19 | 17 | 17 | 400 / 1.6 / normal |
| Evidence entry H2 | 40 | 36 | 32 | 650 / 1.12 / −.04em |
| Supporting H1 | 64 | 52 | 42 | 650 / 1.04 / −.04em |
| Work H2 | 36 | 36 | 30 | 650 / 1.12 / −.04em |
| Work H3 | 23 | 23 | 23 | 650 / 1.25 / −.04em |
| Context/contact H2 | 28 | 28 | 28 | 650 / 1.15 / −.04em |
| Legal H1 | 58 | 58 | clamp(28px,8vw,40px) | 650 / 1.07 / −.04em |
| Legal H2 | 28 | 28 | 26 | 650 / 1.2 / −.04em |
| Publication H1 | clamp(38px,4.5vw,64px) | same fluid rule | same fluid rule | 650 / 1.08 / −.035em |
| Body | 17 | 17 | 16 | 400 / 1.6; legal1.7 / normal |
| Navigation | 16 | 18 disclosed | 18 disclosed | 550 / inherited / normal |
| Primary CTA | 17 | 17 | 16 | 600 / inherited / normal |
| Text CTA | 18 | 18 | 17 | 600 / inherited / normal |
| Footer/legal caption | 14 | 14 | 14 | 400 / 1.5–1.6 / normal |
| Eyebrow | 14 | 14 | 14 | 600 / 1.6 / .065em |
| Form fields | 16 | 16 | 16 | 400 / inherited / normal |

900–1199: home H1 56, lead19, capability heading36, disclosure23, supporting H1 52. H4–H6 are not used; no decorative heading levels introduced. Wordmark34 desktop,29 at≤1199,27 mobile; identity descriptor13/12/10.5. Text measures: opening lead38ch desktop/52ch tablet; mobile H1 15ch/tablet19ch; supporting H1 17ch/lead42ch; work65ch; legal66ch; context70ch. Publication description700px; form intro650px.

## Color

| Use/token | Value |
|---|---|
| Page/footer | #FFFFFF |
| Primary text, --hs-ink | #071D3B |
| Muted text, --hs-muted | #44546A |
| Accent/link/action, --hs-blue | #0644AD |
| Hover | #071D3B; filled action text white |
| Focus | #B84500,3px outline,5px offset; white on cobalt |
| Rules, --hs-line | #CED7E3 |
| Context, --hs-pale | #EFF5FF |
| Contact surface | #F5F7FA |
| Input border | #64748B |
| Error | #AD2332 |
| Success token | #185C47 |
| Cobalt-panel rules | #FFFFFF80 |

Executed axe contrast checks passed. Layout rules are decorative; input boundaries use stronger contrast. No gradients, shadows, video tint or unrelated decorative palette.

## Layout

Breakpoints599/899/1199/1600. Hero maximum1920; home lower rows/footer1600. Desktop opening52% narrative/48% capabilities, one column below900. Header minimum98 desktop/90 tablet; desktop gutters clamp(24px,4.8vw,72px), tablet32, mobile20. Menu enters normal flow.

Hero intro desktop100 top, fluid32–72 sides,44 bottom; large112/64 top/bottom; tablet52/40/36; mobile36/20/28. Capabilities desktop68 top/fluid32–80 sides/48 bottom; tablet36/40; mobile32/20. Disclosure targets92 desktop/72 tablet/78 mobile. Evidence row42px vertical desktop,40 tablet,32 mobile; gaps64/28/24.

Supporting content maximum1296 with40 sides,72 top/88 bottom; mobile20 sides/36 top/48 bottom. Work rows1:1.3 with80px gap,32 tablet; mobile one column/24 gap. Legal maximum850 including32px padding,20 mobile. Publications maximum1180,20 side clearance (16 below700), cover220–360 plus flexible text. Forms maximum780. Cover frame ratio0.77 with object-fit contain; actual artwork retained.

Primary actions minimum56 desktop/52 mobile, nav/legal44, input48; square corners. Mobile opening actions full width. SH icon512 square, Apple180, manifest192, ICO32. Social cards1200×630.

## Interaction and continuity

Native disclosures reveal capabilities without requiring JavaScript. Mobile menu supports Escape/focus return. Arrow hover translates4px over180ms ease. Reduced motion disables transitions, animations and smooth scroll throughout the shell. No autoplay media. Forms preserve server validation, separate optional marketing consent and verification before private publication delivery.

Foundation continuities: Instrument Sans, cobalt/ink, concise institutional language, flat rows, shared Foundation entity. Health-specific: split opening, capability disclosure, health-access narrative and clinical boundaries. Explore components/styles are preserved for Prompt4; hostname icon/root organization identity necessarily apply across the hostname.

## Assets and licenses

SH icon and Health social artwork were actually generated with imagegen and inspected; masters retained in the task-generated image store and release outputs. Sharp produced delivery sizes. No Blender render is claimed. Existing publication covers retained with900px WebP previews (33,966;184,326;125,746 bytes). Original covers and DOI destinations preserved. Instrument Sans license is included. No new third-party stock material was introduced; existing publication artwork follows its supplied source provenance.
