export type ReportTheme = 'moderna-clean' | 'moderna-pro';

export function getThemeCoreCss(theme: ReportTheme = 'moderna-clean'): string {
  const isPro = theme === 'moderna-pro';

  return `
    :root {
      --brand-50: #eff6ff;
      --brand-200: #bfdbfe;
      --brand-400: #60a5fa;
      --brand-700: #1d4ed8;
      --ink-900: #0f172a;
      --ink-600: #475569;
      --line: ${isPro ? '#93c5fd' : '#e2e8f0'};
      --page-radius: ${isPro ? '12px' : '8px'};
    }

    .page {
      position: relative;
    }

    ${isPro ? `.page::before {
      content: '';
      position: absolute;
      inset: 12px;
      border: 1.5px solid var(--line);
      border-radius: var(--page-radius);
      pointer-events: none;
    }` : ''}

    ${isPro ? `.micro-date {
      background: linear-gradient(90deg, var(--brand-50), #dbeafe);
      color: var(--brand-700);
      border: 1px solid var(--brand-200);
      border-radius: 999px;
      padding: 3px 10px;
      font-weight: 600;
      letter-spacing: 0.2px;
    }

    .micro-chip {
      display: inline-block;
      margin-left: 6px;
      padding: 2px 8px;
      border-radius: 999px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: var(--ink-900);
      font-weight: 600;
      letter-spacing: 0.2px;
    }` : `.micro-date, .micro-chip { all: unset; }`}
  `;
}
