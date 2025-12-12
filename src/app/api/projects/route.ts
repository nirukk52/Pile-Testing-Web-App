/**
 * Projects API Route
 * Why: CRUD operations for Project entities (containers for tests).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/projects - List all projects
 * Why: Home screen needs to show project list.
 */
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { tests: true },
        },
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects - Create a new project
 * Why: First step before creating a test is to create/select a project.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, client, contractor, pmc, location } = body;

    // Validate required fields
    if (!name || !client || !contractor || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: name, client, contractor, location' },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        client,
        contractor,
        pmc: pmc || null,
        location,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}


