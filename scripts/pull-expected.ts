/**
 * Pull Expected Data Script
 * Why: Extracts ground truth from Supabase/Prisma for eval comparison.
 * 
 * Usage: npx tsx scripts/pull-expected.ts <report-folder> <pile-id>
 * Example: npx tsx scripts/pull-expected.ts report-001 TP-01
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface ExpectedReading {
  sequence: number;
  date: string;
  time: string;
  pressure: number;
  dg1: number;
  dg2: number;
  dg3: number;
  dg4: number;
}

interface ExpectedData {
  testType: string;
  projectInfo: {
    pileId: string;
    reportNo: string | null;
    project: string;
    pileDiameter: number;
    pileDepth: number;
    designLoad: number;
    testLoad: number;
    ramArea: number;
    concreteGrade: string;
    testDate: string | null;
    dateOfCasting: string | null;
    client: string;
    contractor: string;
  };
  readings: ExpectedReading[];
}

async function pullExpected(reportFolder: string, pileId: string): Promise<void> {
  console.log(`\n🔍 Looking for test with Pile ID: ${pileId}\n`);

  // Find the test by pileId
  const test = await prisma.test.findFirst({
    where: { pileId },
    include: {
      project: true,
      readings: {
        orderBy: { sequence: 'asc' },
      },
    },
  });

  if (!test) {
    console.error(`❌ No test found with Pile ID: ${pileId}`);
    console.log('\n💡 Available tests:');
    
    const allTests = await prisma.test.findMany({
      select: { pileId: true, reportNo: true, testType: true },
      take: 10,
    });
    
    for (const t of allTests) {
      console.log(`   - ${t.pileId} (${t.reportNo || 'no report no'}) - ${t.testType}`);
    }
    
    process.exit(1);
  }

  console.log(`✅ Found test: ${test.pileId} - ${test.reportNo}`);
  console.log(`   Project: ${test.project.name}`);
  console.log(`   Readings: ${test.readings.length}`);

  // Build expected data (RAW fields only)
  const expectedData: ExpectedData = {
    testType: test.testType,
    
    projectInfo: {
      pileId: test.pileId,
      reportNo: test.reportNo,
      project: test.project.name,
      pileDiameter: test.pileDiameterMm,
      pileDepth: test.pileDepthM,
      designLoad: test.designLoadT,
      testLoad: test.testLoadT,
      ramArea: test.ramAreaCm2,
      concreteGrade: test.concreteGrade,
      testDate: test.testDate?.toISOString().split('T')[0] || null,
      dateOfCasting: test.dateOfCasting?.toISOString().split('T')[0] || null,
      client: test.project.client,
      contractor: test.project.contractor,
    },
    
    readings: test.readings.map((r) => ({
      sequence: r.sequence,
      date: r.recordedAt.toISOString().split('T')[0],
      time: r.recordedAt.toISOString().split('T')[1].slice(0, 5),
      pressure: r.pressureKgCm2,
      dg1: r.dg1,
      dg2: r.dg2,
      dg3: r.dg3,
      dg4: r.dg4,
      // NOTE: loadT, avgSettlementMm, phase are NOT included - they are calculated
    })),
  };

  // Write to file
  const outputPath = path.join(process.cwd(), 'training-data', reportFolder, 'expected.json');
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(expectedData, null, 2));
  
  console.log(`\n✅ Written to: ${outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Project Info: ${Object.keys(expectedData.projectInfo).length} fields`);
  console.log(`   - Readings: ${expectedData.readings.length} rows`);
  console.log(`   - RAW fields per reading: date, time, pressure, dg1-4`);
}

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/pull-expected.ts <report-folder> <pile-id>');
    console.log('Example: npx tsx scripts/pull-expected.ts report-001 TP-01');
    process.exit(1);
  }

  const [reportFolder, pileId] = args;

  try {
    await pullExpected(reportFolder, pileId);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

