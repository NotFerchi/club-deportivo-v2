---
name: Club Social y Deportivo
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464e'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#75777f'
  outline-variant: '#c5c6cf'
  surface-tint: '#4e5e86'
  primary: '#000b27'
  on-primary: '#ffffff'
  primary-container: '#0f2146'
  on-primary-container: '#7989b4'
  inverse-primary: '#b6c6f4'
  secondary: '#4059aa'
  on-secondary: '#ffffff'
  secondary-container: '#8fa7fe'
  on-secondary-container: '#1d3989'
  tertiary: '#000e18'
  on-tertiary: '#ffffff'
  tertiary-container: '#002539'
  on-tertiary-container: '#0092d0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b6c6f4'
  on-primary-fixed: '#061a3f'
  on-primary-fixed-variant: '#36466d'
  secondary-fixed: '#dce1ff'
  secondary-fixed-dim: '#b6c4ff'
  on-secondary-fixed: '#00164e'
  on-secondary-fixed-variant: '#264191'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-hero:
    fontFamily: Playfair Display
    fontSize: 44px
    fontWeight: '600'
    lineHeight: 52px
  display-hero-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

### Brand Personality & Emotional Impact
The design system establishes an environment of distinction, heritage, and vitality tailored for high-end sports, wellness, and country club communities in Mexico. It bridges the prestige of a private social institution with the crisp utility required by modern athletics management. The interface evokes:
- **Prestige & Confianza:** Traditional country club values translated into contemporary, clutter-free surfaces.
- **Vigor & Dinamismo:** Subtle, energetic accents that celebrate physical discipline, sport, and wellness without compromising elegance.
- **Cercanía & Accesibilidad:** Effortless clarity and high legibility across multiple generations of *socios* (from junior academy athletes to senior members).

### Design Aesthetic: Neo-Country Club Modernism
The design style blends warm luxury minimalism with athletic precision:
- **Deep Anchor Contrast:** Structural elements (such as persistent navigation and executive dashboards) utilize deep, stately navy tones that project stability and permanence.
- **Airy Surfaces:** Interaction areas breathe with expansive slate backdrops (`#f8fafc`), crisp white cards, and generous internal padding.
- **Refined Typography Pairing:** The structural clarity of a geometric humanist sans is elevated by high-contrast editorial serifs reserved exclusively for prestigious titles, greetings, and signature institutional landmarks.
- **Physical Precision:** Soft, layered ambient drop shadows emulate natural daylight falling across tactile card stock, framed with smooth organic radii (`rounded-2xl` to `rounded-3xl`).

## Colors

### Palette Strategy
The color hierarchy preserves institutional credibility while ensuring instant comprehension for fast-paced court reservations, access control, and membership statuses.

- **Primary (`#0f2146`):** Deep Navy. Anchors persistent app structures (sidebars, major mastheads, primary action buttons, key metrics titles).
- **Secondary (`#1e3a8a` / `#0369a1`):** Royal Navy and Ocean Blue. Deployed for secondary interactive elements, high-contrast text links, and active segmented controls ensuring minimum WCAG AA compliance (4.5:1+) on light surfaces.
- **Tertiary Accent (`#0ea5e9` / `#06b6d4`):** Sky and Electric Cyan. Reserved for focus rings, live match tags, progress milestones, and dynamic highlights.
- **Neutral Core:**
  - Base Background: Slate 50 (`#f8fafc`) and Slate 100 (`#f1f5f9`).
  - Card & Surface: Pure White (`#ffffff`).
  - Dividers & Outlines: Slate 200 (`#e2e8f0`).
  - Text Primary: Slate 900 (`#0f172a`).
  - Text Muted: Slate 500 (`#64748b`).

### Status Tokens (State + Contrast Match)
Status states must never rely on color alone; always pair status color with explicit iconography and descriptive Spanish microcopy.
- **Éxito (Cuota al día, Cancha confirmada):** Base text `#059669`, background `#ecfdf5`, border `#a7f3d0`.
- **Atención (Pago pendiente, Lista de espera):** Base text `#d97706`, background `#fffbeb`, border `#fde68a`.
- **Alerta / Cancelado (Acceso denegado, Suspensión):** Base text `#dc2626`, background `#fef2f2`, border `#fecaca`.
- **Informativo (Aviso de mantenimiento, Torneo abierto):** Base text `#0284c7`, background `#f0f9ff`, border `#bae6fd`.

### Sport Discipline Tokens
Used selectively for tags, court calendars, and category indicator lines:
- **Tenis & Pádel:** Volt Lime (`#84cc16`, surface `#f7fee7`)
- **Natación & Acuática:** Azure (`#0284c7`, surface `#f0f9ff`)
- **Fitness & Gimnasio:** Warm Coral (`#ea580c`, surface `#fff7ed`)
- **Golf:** Fairway Green (`#15803d`, surface `#f0fdf4`)
- **Fútbol & Canchas Multiuso:** Emerald Pitch (`#10b981`, surface `#ecfdf5`)

## Typography

### Hierarchy & Editorial Rules
- **Playfair Display (Display & Institutional Titles):** Employed deliberately to express pedigree. Limit its application strictly to:
  - Institutional club branding ("Club Social y Deportivo").
  - Formal greeting headers (e.g., *"Bienvenido a su club, Don Eduardo"*).
  - Prominent section titles on overview landing portals and ceremonial trophy dashboards.
- **Plus Jakarta Sans (Interface Core & Readability Engine):** Powers all functional UI components, operational headings, data tables, schedule grids, form inputs, buttons, and microcopy. Its generous x-height and open apertures guarantee quick recognition outdoors in direct sunlight during athletic activities.

### Language and Formatting Specifications
- All interface copy adheres to Mexican Spanish naming and formal conversational warmth (*usted/socios* register).
- Financial values must format with explicit Mexican currency notation: `$1,250.00 MXN`.
- Dates conform to standard daylight usage: `Sábado, 28 de Octubre, 2025` or short format `28 oct · 09:00 hrs`.

## Layout & Spacing

### Grid & Layout Strategy
The layout employs an asymmetrical responsive system combining a rigid, authoritative desktop command drawer with fluid content grids:
- **Desktop (1200px+):** Fixed 280px persistent Navy navigation bar (`#0f2146`) docked on the left. Main canvas employs a 12-column fluid grid with `2rem` (32px) margins and `1.5rem` (24px) gutters. Maximum content reading bounds capped at `1440px`.
- **Tablet (768px – 1199px):** Adaptive collapsed navigation drawer (80px icon dock). Grid reflows to 8 columns with `1.5rem` outer margins.
- **Mobile (< 768px):** Navigation transitions to a bottom bar with explicit icon labels. Single or 2-column stacked flow with `1rem` (16px) margins to preserve maximum tap targets.

### Spacing Rhythm
- **Micro Space (`space-xs` = 4px, `space-sm` = 8px):** Internal icon-to-label spacing, badge padding, compact input offsets.
- **Component Gap (`space-md` = 16px):** Standard stack margins between form elements, table cell internal vertical pads, card cluster gaps.
- **Macro Space (`space-lg` = 24px, `space-xl` = 32px):** Internal padding for primary white cards, dashboard module separation, and modal container body margins.

## Elevation & Depth

### Ambient Daylight System
Depth is achieved without harsh borders or artificial drops. The system simulates diffused daylight over clean white panels resting on a muted slate foundation:

- **Surface 0 (Background Canvas):** Slate 50 (`#f8fafc`). Completely flat, absorbing glare.
- **Surface 1 (Cards & Data Tables):** Pure White (`#ffffff`) framed with a subtle border (`1px solid #e2e8f0`) and elevated by:
  `box-shadow: 0 1px 3px 0 rgba(15, 33, 70, 0.04), 0 1px 2px -1px rgba(15, 33, 70, 0.04)`.
- **Surface 2 (Hover States, Interactive Cards, Dropdowns):**
  `box-shadow: 0 10px 15px -3px rgba(15, 33, 70, 0.06), 0 4px 6px -4px rgba(15, 33, 70, 0.04)`.
- **Surface 3 (Modals, Booking Confirmation Sheets):**
  `box-shadow: 0 20px 25px -5px rgba(15, 33, 70, 0.09), 0 8px 10px -6px rgba(15, 33, 70, 0.04)`.
- **Dark Structural Depth (Sidebar Navigation):** The `#0f2146` sidebar employs an internal vertical gradient and a soft hairline border on the right (`rgba(255, 255, 255, 0.08)`) with zero outer drop shadow to keep the navigation grounded and monolithic.

## Shapes

### Corner Curvature Language
The visual identity utilizes generous, friendly curvatures that soften institutional formality and project a hospitable, contemporary club vibe:
- **Base Components (`rounded-lg` / 16px):** Form input fields, buttons, action chips, small metric tiles.
- **Major Surfaces (`rounded-2xl` / 20px – 24px):** Club cards, member credential previews, discipline schedule modules, interactive court cards.
- **System Overlays (`rounded-3xl` / 28px – 32px):** Modal dialogs, bottom sheets on mobile devices, highlighted promotional banner panels.
- **Pills (`rounded-full` / 9999px):** Member tier badges ("Socio Propietario", "Vitalicio"), discipline indicators, status pills, and user avatars.

## Components

### Botones (Buttons)
- **Primario:** Background Deep Navy (`#0f2146`), text white, `height: 48px`, `border-radius: 12px`, typography `label-lg`. Focus ring: 3px Sky Blue (`#0ea5e9`) with 2px white offset. Active state scales to `0.98`.
- **Secundario / Contorno:** Background white, text Navy (`#0f2146`), border `1.5px solid #cbd5e1`. Hover switches background to `#f8fafc`.
- **Acento / Deporte:** Background Sky Blue (`#0284c7`), text white, used exclusively for primary positive club actions (e.g., *"Confirmar Reserva"*).

### Chips e Indicadores de Estado (Chips & Status Pills)
- Rendered with `border-radius: 9999px`, internal padding `4px 12px`, typography `label-md`.
- Must pair an explicit status dot or SVG icon with label copy:
  - *Cuota al día:* `#10b981` dot + `#059669` text on `#ecfdf5` background.
  - *Pendiente de pago:* `#f59e0b` dot + `#d97706` text on `#fffbeb` background.
  - *Cancha ocupada:* `#ef4444` dot + `#dc2626` text on `#fef2f2` background.

### Tarjetas de Disciplina y Canchas (Discipline & Court Cards)
- Elevated white surface (`rounded-2xl`, border `#e2e8f0`).
- Feature an accent indicator (4px top border stripe or top-left category badge) matching the discipline color token (e.g., Volt Lime for Pádel/Tenis, Azure for Natación).
- Include court status, surface type (*"Arcilla", "Pasto sintético"*), and a high-contrast time slot selector.

### Campos de Formulario (Input Fields)
- Clean, open container with `height: 48px`, background `#ffffff`, border `1.5px solid #cbd5e1`, `border-radius: 12px`.
- Active focus state: border shifts to `#0284c7` accompanied by an ambient Sky Blue glow (`box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15)`).
- Labels positioned permanently above the field in `label-md` Slate 700 with clear asterisk indicators for mandatory member data.

### Tablas de Socios e Instructores (Data Tables)
- Generous row heights (`64px`) to accommodate avatars, dual text lines (Socio name + Member ID number `No. 4082`), and quick action buttons.
- Header row styled in subtle uppercase `label-sm` Slate 500 on Slate 50 background.
- Row hover interaction activates a gentle Slate 50 transition (`#f8fafc`).

### Barra de Navegación del Socio (Navigation Shell)
- **Desktop Sidebar:** Deep Navy `#0f2146` background. Header contains the club seal alongside "Club Social y Deportivo" set in `Playfair Display`. Nav items have 12px radius, light gray icons (`#94a3b8`), and active states characterized by sky blue background illumination (`rgba(14, 165, 233, 0.12)`) and white text.
- **Mobile Bottom Bar:** Docked fixed white bar with top border (`#e2e8f0`), housing 4 primary destinations: *Inicio, Reservas, Canchas, Mi Perfil*.