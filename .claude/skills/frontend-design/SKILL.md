---
name: frontend-design
description: PileTest Pro Design System & Styling Guide. Use this skill when building UI components, pages, or styling for the pile load testing platform. Ensures consistent "Precision Engineering" aesthetic across all interfaces.
license: Complete terms in LICENSE.txt
---

# PileTest Pro – Design System & Styling Guide

**Tech Stack**: Next.js 14+ (App Router), Tailwind CSS 3.4+, shadcn/ui  
**Reference**: See `project_info_and_context/report.html` for implementation examples.

---

## 1. Design Philosophy

**Aesthetic**: "Precision Engineering" – Clean, high-contrast, distraction-free.

**Core Principle**: Clarity over Flash. Field engineers work in bright sunlight; Reviewers analyze dense data.

**Shape Language**: Slightly rounded corners (`rounded-lg`), distinct borders, and card-based grouping to separate distinct testing stages.

---

## 2. Color Palette

Slate & Blue foundation conveys trust and engineering precision, with Emerald for safety/success indicators.

### Primary Colors

| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| **Structure Blue** | `#2563eb` | `blue-600` | Main buttons, active tabs, loading curves on graphs |
| **Midnight Slate** | `#1e293b` | `slate-800` | Sidebars, mobile headers, primary headings |

### Functional / Status Colors (IS 2911 Checks)

| Status | Hex | Tailwind | Usage |
|--------|-----|----------|-------|
| **Safe / Passed** | `#10b981` | `emerald-500` | "Passed" badges, Net Settlement within limits, Unloading curves |
| **Warning / Check** | `#f59e0b` | `amber-500` | Pending Review status, readings approaching safety limits |
| **Fail / Danger** | `#e11d48` | `rose-600` | "Failed" badges, Delete actions, Settlement exceeding limits |

### Backgrounds & Neutrals

| Element | Hex | Tailwind | Usage |
|---------|-----|----------|-------|
| **App Background** | `#f3f4f6` | `gray-100` | Reduces eye strain |
| **Card Surface** | `#ffffff` | `white` | All card containers |
| **Text Main** | `#1e293b` | `slate-800` | Primary text |
| **Text Secondary** | `#64748b` | `slate-500` | Meta information, labels |
| **Borders** | `#e2e8f0` | `slate-200` | Card borders, dividers |

### CSS Variables (globals.css)

```css
:root {
  --primary: #2563eb;
  --primary-dark: #1e40af;
  --secondary: #64748b;
  --bg: #f3f4f6;
  --card-bg: #ffffff;
  --text-main: #1e293b;
  --text-light: #64748b;
  --success: #10b981;
  --warning: #f59e0b;
  --destructive: #e11d48;
}
```

---

## 3. Typography

### Font Families

| Context | Font | Reason |
|---------|------|--------|
| **Web** | Inter, Segoe UI | Clean, professional readability |
| **Mobile** | System Default | San Francisco (iOS), Roboto (Android) – feels native |
| **Data Entry / Tables** | JetBrains Mono, Roboto Mono | Aligns numerical data in tables |

### Type Scale

| Element | Tailwind Classes | Mobile Adjustment |
|---------|------------------|-------------------|
| **Page Title** | `text-2xl font-bold text-slate-800` | `text-xl` |
| **Section Header** | `text-lg font-bold text-slate-700 uppercase tracking-wide` | – |
| **KPI Value** | `text-3xl font-extrabold text-slate-900` | – |
| **Body** | `text-sm text-slate-600` | – |
| **Input Text** | `text-base font-medium text-slate-900` | 16px min (prevents zoom) |
| **Card Label** | `text-xs font-bold text-slate-500 uppercase tracking-wide` | – |

---

## 4. UI Components (Atomic Design)

### A. Cards (The Core Container)

Used for: KPI summaries, Graph containers, Reading forms.

```tsx
// Tailwind classes
className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"

// Mobile: Full width
// Web: Grid layout
```

### B. Buttons

**Primary (Submit/Save)**
```tsx
className="bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg shadow-sm hover:bg-blue-700 active:bg-blue-700 transition-colors"
```

**Secondary (Cancel/Back)**
```tsx
className="bg-white text-slate-700 border border-slate-300 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 active:bg-gray-50 transition-colors"
```

**Ghost (Text Link)**
```tsx
className="text-blue-600 font-medium hover:underline"
```

**Download/Export**
```tsx
className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm shadow-sm hover:bg-blue-700 transition-colors"
```

### C. Input Fields (Field Data Entry)

Optimized for "Fat Finger" usage in the field.

```tsx
// Input field
className="h-12 bg-white border border-slate-300 rounded-lg px-3 text-lg w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"

// Label (above input)
className="text-xs font-bold text-slate-500 uppercase mb-1"
```

### D. Badges (Status Indicators)

Used for Test Status (Ongoing, Review, Signed).

**Base shape**: `rounded-full px-3 py-1 text-xs font-bold uppercase`

| Status | Classes |
|--------|---------|
| **Success/Passed** | `bg-emerald-100 text-emerald-700` |
| **Pending/Warning** | `bg-amber-100 text-amber-700` |
| **Draft/Neutral** | `bg-slate-100 text-slate-600` |
| **Failed/Danger** | `bg-rose-100 text-rose-700` |

### E. Navigation Items (Sidebar)

```tsx
// Base nav item
className="px-4 py-3 rounded-lg cursor-pointer transition-colors text-slate-400 text-sm flex items-center justify-between"

// Hover state
className="hover:bg-slate-700 hover:text-white"

// Active state
className="bg-blue-600 text-white"

// Status dot (green indicator)
className="h-2 w-2 rounded-full bg-emerald-500"
```

### F. Tables (Data Display)

```tsx
// Table container
className="overflow-x-auto"

// Table header
className="text-left p-3 bg-slate-50 text-slate-500 font-semibold border-b-2 border-slate-200 text-sm"

// Table cell
className="p-3 border-b border-slate-200 text-slate-800"

// Row hover
className="hover:bg-slate-50"

// Highlighted row (Peak Hold)
className="bg-emerald-50"
```

---

## 5. Data Visualization Style (Chart.js)

For Load vs. Settlement/Deflection charts.

### Grid & Axes
```typescript
{
  grid: { color: '#f1f5f9' }, // Subtle dotted lines
  ticks: { color: '#64748b', font: { size: 11 } }
}
```

### Line Styles

| Line | Style | Color | Width |
|------|-------|-------|-------|
| **Loading Phase** | Solid | `#2563eb` | 2px |
| **Unloading Phase** | Dashed `[5, 5]` | `#10b981` | 2px |
| **Safety Limit** | Dotted | `#e11d48` | 1px |

### Data Points
```typescript
{
  pointRadius: 3,
  pointBackgroundColor: '#fff',
  pointBorderColor: '#2563eb', // Match line color
  pointBorderWidth: 2
}
```

### Chart Configuration
```typescript
options: {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      reverse: true, // Settlement goes DOWN
      suggestedMin: 0,
      suggestedMax: 12
    }
  }
}
```

---

## 6. Layout Patterns

### Web Dashboard (Next.js)

**Sidebar Layout**
```tsx
// Sidebar (fixed left)
className="w-64 bg-slate-800 text-white p-5 fixed h-full flex flex-col"

// Main content (scrollable)
className="ml-64 flex-1 p-8 bg-gray-100 min-h-screen"
```

**Grid Systems**
```tsx
// KPI Cards
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"

// Main Content (Graph + Specs)
className="grid grid-cols-1 lg:grid-cols-3 gap-5"
// Graph: col-span-2, Specs: col-span-1
```

**Header**
```tsx
className="flex justify-between items-center mb-8"
```

### Mobile Considerations

- Sidebar collapses to hamburger menu
- Cards stack vertically (full width)
- Input fields minimum 16px font (prevents iOS zoom)
- Touch targets minimum 44px height

---

## 7. Report PDF Output Styling

The PDF should mimic Web View, optimized for A4 paper.

### Structure
- **Header**: Logos left/right, Project Title centered
- **Footer**: Page numbers, "Generated by ZedGeo Platform", Sign-off box

### Print CSS Guidelines
```css
@media print {
  /* Prevent page breaks inside tables */
  .data-table, .reading-row {
    break-inside: avoid;
  }
  
  /* High-resolution graphs */
  .chart-container {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  /* Black text for legal readability */
  body { color: #000; }
  
  /* Preserve colored badges */
  .badge { -webkit-print-color-adjust: exact; }
}
```

---

## 8. shadcn/ui Integration

When using shadcn/ui components, apply these customizations:

### Button Variants
```tsx
// Primary action
<Button className="bg-blue-600 hover:bg-blue-700">Save Report</Button>

// Secondary
<Button variant="outline" className="border-slate-300">Cancel</Button>
```

### Card Component
```tsx
<Card className="border-slate-200 shadow-sm">
  <CardHeader>
    <CardTitle className="text-lg font-bold text-slate-700">
      Pile Specifications
    </CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

### Form Inputs
```tsx
<Input 
  className="h-12 text-lg border-slate-300 focus:border-blue-500 focus:ring-blue-200" 
/>
```

---

## Quick Reference: Common Patterns

```tsx
// KPI Card
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Test Load</p>
  <p className="text-3xl font-extrabold text-slate-900 mt-2">
    367.5 <span className="text-base font-normal">MT</span>
  </p>
  <p className="text-sm text-blue-600 mt-1">2.5x Design Load</p>
</div>

// Status Badge
<span className="rounded-full px-3 py-1 text-xs font-bold uppercase bg-emerald-100 text-emerald-700">
  Passed
</span>

// Section Header
<h3 className="text-lg font-bold text-slate-700 uppercase tracking-wide mb-4">
  Load Increment Summary
</h3>
```

---

## Brand Element

```tsx
// ZedGeo Brand (Sidebar)
<div className="text-xl font-bold tracking-wide mb-10">
  <span className="text-blue-600">ZED</span>
  <span className="text-white">GEO</span>
</div>
```
