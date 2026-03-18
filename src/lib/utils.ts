import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS classes intelligently, handling conflicts.
 * Why: Allows conditional class application without style conflicts
 * when combining base classes with conditional overrides.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a date string into { year, month, day } without timezone ambiguity.
 * Why: `new Date(str)` interprets DD/MM/YYYY as MM/DD in some environments.
 * All field-sheet dates are day-first (DD-MM-YYYY).
 */
function parseDateParts(dateInput: string | Date): { year: number; month: number; day: number } | null {
  if (dateInput instanceof Date) {
    return { year: dateInput.getFullYear(), month: dateInput.getMonth() + 1, day: dateInput.getDate() };
  }

  // ISO: YYYY-MM-DD (with optional time suffix)
  const iso = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3] };

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = dateInput.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) return { year: +dmy[3], month: +dmy[2], day: +dmy[1] };

  // DD/MM/YY or DD-MM-YY
  const dmy2 = dateInput.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (dmy2) return { year: 2000 + +dmy2[3], month: +dmy2[2], day: +dmy2[1] };

  return null;
}

/**
 * Formats a date/timestamp string to dd/mm/yyyy format.
 * Why: Ensures consistent date display across the app per IS 2911 standards.
 * Uses IST (Asia/Kolkata) - all field times are in Indian Standard Time.
 * @param dateInput - ISO string, Date object, or date string
 * @returns Formatted date as dd/mm/yyyy
 */
export function formatDateDDMMYYYY(dateInput: string | Date): string {
  try {
    const parts = typeof dateInput === 'string' ? parseDateParts(dateInput) : null;
    if (parts) {
      return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
    }
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).replace(/\//g, '/');
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats a date/timestamp string to "15 January 2024" format.
 * Why: Used in formal reports for better readability.
 * Uses IST (Asia/Kolkata) - all projects are in India.
 * @param dateInput - ISO string, Date object, or date string
 * @returns Formatted date as "DD Month YYYY"
 */
export function formatDateLong(dateInput: string | Date): string {
  try {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const parts = typeof dateInput === 'string' ? parseDateParts(dateInput) : null;
    if (parts) {
      const name = monthNames[parts.month - 1];
      if (name) return `${String(parts.day).padStart(2, '0')} ${name} ${parts.year}`;
    }
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Converts dd/mm/yyyy string to ISO date string (yyyy-mm-dd).
 * Why: HTML inputs and database storage require ISO format.
 * @param ddmmyyyy - Date string in dd/mm/yyyy format
 * @returns ISO date string (yyyy-mm-dd) or empty string if invalid
 */
export function convertDDMMYYYYToISO(ddmmyyyy: string): string {
  if (!ddmmyyyy) return '';
  
  const match = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return ddmmyyyy; // Return as-is if not in expected format
  
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/**
 * Converts ISO date string (yyyy-mm-dd) to dd/mm/yyyy format.
 * Why: Display dates in user-friendly format for Indian site engineers.
 * @param isoDate - ISO date string (yyyy-mm-dd)
 * @returns Date string in dd/mm/yyyy format or empty string if invalid
 */
export function convertISOToDDMMYYYY(isoDate: string): string {
  if (!isoDate) return '';
  
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate; // Return as-is if not in expected format
  
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * Validates if a string is in valid dd/mm/yyyy format.
 * Why: Provides user feedback for date input validation.
 * @param dateStr - String to validate
 * @returns true if valid dd/mm/yyyy format
 */
export function isValidDDMMYYYY(dateStr: string): boolean {
  if (!dateStr) return false;
  
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  
  const [, day, month, year] = match;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  
  // Basic validation
  if (monthNum < 1 || monthNum > 12) return false;
  if (dayNum < 1 || dayNum > 31) return false;
  if (yearNum < 1900 || yearNum > 2100) return false;
  
  // Check if date is valid
  const date = new Date(yearNum, monthNum - 1, dayNum);
  return date.getFullYear() === yearNum &&
         date.getMonth() === monthNum - 1 &&
         date.getDate() === dayNum;
}





