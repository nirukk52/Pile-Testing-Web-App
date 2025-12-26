# Quickstart: IVPLT Report Automation

**Branch**: `001-ivplt-report-automation` | **Date**: 2025-12-12

## Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account (free tier works)
- OpenAI API key (optional, for AI conclusion)

---

## 1. Clone and Install

```bash
# Switch to feature branch
git checkout 001-ivplt-report-automation

# Install dependencies
npm install

# Install new dependencies for this feature
npm install @supabase/supabase-js @prisma/client pdf-lib
npm install -D prisma playwright @playwright/test
```

---

## 2. Supabase Setup

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for database provisioning (~2 minutes)
3. Go to **Settings > API** and copy:
   - Project URL
   - anon/public key
   - service_role key (for server-side operations)

### 2.2 Create Storage Buckets

Go to **Storage** in Supabase dashboard and create:

```
Bucket: site-images
  - Public: No
  - File size limit: 10MB
  - Allowed MIME types: image/jpeg, image/png, image/webp

Bucket: certificates  
  - Public: No
  - File size limit: 5MB
  - Allowed MIME types: application/pdf
```

### 2.3 Storage Policies (RLS)

Run in **SQL Editor**:

```sql
-- Allow authenticated users to upload to their test folders
CREATE POLICY "Users can upload site images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'site-images');

CREATE POLICY "Users can view site images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'site-images');

CREATE POLICY "Users can delete site images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'site-images');

-- Same for certificates
CREATE POLICY "Users can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Users can view certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'certificates');

CREATE POLICY "Users can delete certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'certificates');
```

---

## 3. Environment Setup

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (from Supabase Settings > Database)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# AI (optional)
OPENAI_API_KEY=sk-...

# PDF Generation
PLAYWRIGHT_BROWSERS_PATH=0
```

---

## 4. Database Setup (Prisma)

### 4.1 Initialize Prisma

```bash
# Initialize Prisma (if not already)
npx prisma init

# Copy schema from data-model.md to prisma/schema.prisma
```

### 4.2 Run Migrations

```bash
# Generate migration
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate
```

### 4.3 Verify Schema

```bash
# Open Prisma Studio to view tables
npx prisma studio
```

---

## 5. Install Playwright for PDF

```bash
# Install Playwright browsers
npx playwright install chromium

# Verify installation
npx playwright --version
```

---

## 6. Project Structure Setup

Create the new directories:

```bash
mkdir -p src/engines
mkdir -p src/lib/pdf/templates
mkdir -p src/app/api/tests
mkdir -p src/app/api/readings
mkdir -p src/app/api/upload
mkdir -p src/app/api/pdf
```

---

## 7. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 8. Development Workflow

### Adding a Reading

1. Navigate to a test
2. Go to Data Entry tab
3. Click "Add Reading"
4. Enter pressure and dial gauge values
5. Toggle faulty gauges if needed
6. Save

### Generating Report

1. Complete all readings (Loading → Hold → Unloading)
2. Upload site images (optional)
3. Upload calibration certificates (optional)
4. Go to Report tab
5. Review KPIs and chart
6. Generate AI conclusion (or write custom)
7. Click "Export PDF"

---

## 9. Key Files to Implement

| File | Purpose | Priority |
|------|---------|----------|
| `src/engines/types.ts` | ITestEngine interface | P1 |
| `src/engines/ivplt-engine.ts` | IVPLT calculations | P1 |
| `src/engines/factory.ts` | Engine factory | P1 |
| `src/lib/supabase.ts` | Supabase client | P1 |
| `src/lib/calculations.ts` | Shared formulas | P1 |
| `src/app/api/tests/route.ts` | Test CRUD | P2 |
| `src/app/api/readings/route.ts` | Reading CRUD | P2 |
| `src/app/api/upload/route.ts` | File uploads | P2 |
| `src/app/api/pdf/route.ts` | PDF generation | P3 |
| `src/lib/pdf/templates/ivplt-template.tsx` | HTML template | P3 |

---

## 10. Testing

### Manual Testing Checklist

- [ ] Create a new project
- [ ] Create a new IVPLT test
- [ ] Enter 10+ readings (loading + unloading)
- [ ] Mark one gauge as faulty, verify average calculation
- [ ] Upload 3 site images with captions
- [ ] Upload 2 calibration certificates
- [ ] View report with KPIs and chart
- [ ] Generate PDF and verify all sections

### Automated Tests (Future)

```bash
# Run Vitest
npm run test

# Run specific test
npm run test -- src/engines/ivplt-engine.test.ts
```

---

## Troubleshooting

### "Cannot connect to database"
- Verify `DATABASE_URL` in `.env.local`
- Check Supabase project is running
- Ensure IP is whitelisted in Supabase

### "PDF generation fails"
- Run `npx playwright install chromium`
- Ensure `PLAYWRIGHT_BROWSERS_PATH=0` in env

### "Storage upload fails"
- Verify bucket exists and RLS policies are set
- Check file size limits

### "Prisma client not found"
- Run `npx prisma generate`
- Restart dev server

---

## Useful Commands

```bash
# Reset database (caution: deletes all data)
npx prisma migrate reset

# View database in browser
npx prisma studio

# Generate types after schema change
npx prisma generate

# Format Prisma schema
npx prisma format
```


