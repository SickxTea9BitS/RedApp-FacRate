import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import { createZip, toCsv } from './data-transfer';

export const dataTransfer = new Hono();

const OWNER_REDDIT_ID = '135m5v7osr';
const ADMIN_USERS_KEY = 'admin:users';
const ADMIN_LOG_KEY = 'logs:admin';
const FACULTY_KEY = 'faculty:records';
const COURSES_KEY = 'courses:records';
const RATINGS_PREFIX = 'faculty:ratings:';
const COURSE_CODE_PATTERN = /^[A-Z]{3}[0-9]{4}$/;

type Faculty = {
  facultyId?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  school: string;
  courseCodes?: string[];
  createdAt?: number;
};

type Rating = {
  teaching: number;
  internalMarking: number;
  examEvaluation: number;
  overallRecommendation: number;
  classAverage: number;
  questionProvision: 'no' | 'sometimes' | 'yes';
  createdAt?: number;
};

const getAdminActor = async () => {
  const rawId = context.userId;
  if (!rawId) return null;
  const id = rawId.replace(/^t2_/, '').trim();
  const username = (await reddit.getCurrentUsername()) ?? 'unknown';
  if (id === OWNER_REDDIT_ID) return { id, username };
  const stored = await redis.hGet(ADMIN_USERS_KEY, id);
  if (!stored) return null;
  try {
    const record = JSON.parse(stored) as { active?: boolean; username?: string };
    return record.active === false ? null : { id, username: record.username || username };
  } catch {
    return null;
  }
};

const logExport = async (actor: { id: string; username: string }, dataset: string, bytes: number, counts: Record<string, number>) => {
  const entry = {
    id: randomUUID(),
    actorId: actor.id,
    actorUsername: actor.username,
    action: 'data.export',
    timestamp: Date.now(),
    details: { dataset, bytes, counts },
    result: 'success',
  };
  await redis.zAdd(ADMIN_LOG_KEY, { member: JSON.stringify(entry), score: entry.timestamp });
};

const parseHash = <T,>(stored: Record<string, string>) =>
  Object.entries(stored).flatMap(([id, value]) => {
    try {
      const record = JSON.parse(value) as T;
      return record && typeof record === 'object' ? [{ id, record }] : [];
    } catch {
      return [];
    }
  });

const facultyRows = (faculty: Array<{ id: string; record: Faculty }>) =>
  faculty.map(({ id, record }) => ({
    faculty_id: record.facultyId ?? '',
    first_name: record.firstName ?? '',
    middle_name: record.middleName ?? '',
    last_name: record.lastName ?? '',
    school: record.school ?? '',
  }));

const assignmentRows = (faculty: Array<{ id: string; record: Faculty }>) =>
  faculty.flatMap(({ record }) => (record.courseCodes ?? []).map(courseCode => ({
    faculty_id: record.facultyId ?? '',
    course_code: courseCode,
  })));

dataTransfer.get('/export', async (c) => {
  const actor = await getAdminActor();
  if (!actor) return c.json({ status: 'error', message: 'Approved admin access is required.' }, 403);

  const dataset = c.req.query('type') ?? 'all';
  const includeAssignments = c.req.query('includeAssignments') !== 'false';
  if (!['faculty', 'faculty-courses', 'courses', 'ratings', 'all'].includes(dataset)) {
    return c.json({ status: 'error', message: 'Choose a supported export type.' }, 400);
  }

  try {
    const [storedFaculty, storedCourses] = await Promise.all([
      redis.hGetAll(FACULTY_KEY),
      redis.hGetAll(COURSES_KEY),
    ]);
    const faculty = parseHash<Faculty>(storedFaculty);
    const courses = parseHash<{ code?: string }>(storedCourses)
      .filter(({ id, record }) => COURSE_CODE_PATTERN.test(record.code ?? id))
      .map(({ id, record }) => ({ course_code: record.code ?? id }));
    const files: Record<string, string> = {};
    const counts: Record<string, number> = {};

    if (dataset === 'faculty' || dataset === 'faculty-courses' || dataset === 'all' || dataset === 'ratings') {
      const rows = facultyRows(faculty);
      files['faculties.csv'] = toCsv(rows);
      counts.faculties = rows.length;
    }

    if (dataset === 'courses' || dataset === 'all' || dataset === 'faculty-courses' || (dataset === 'faculty' && includeAssignments)) {
      files['courses.csv'] = toCsv(courses);
      counts.courses = courses.length;
    }

    if (dataset === 'faculty-courses' || dataset === 'all' || (dataset === 'faculty' && includeAssignments)) {
      const rows = assignmentRows(faculty);
      files['faculty_course_assignments.csv'] = toCsv(rows);
      counts.assignments = rows.length;
    }

    if (dataset === 'ratings' || dataset === 'all') {
      const ratingRows: Array<Record<string, string | number>> = [];
      for (const { id, record } of faculty) {
        if (!record.facultyId) continue;
        const storedRatings = await redis.hGetAll(RATINGS_PREFIX + id);
        for (const value of Object.values(storedRatings)) {
          try {
            const rating = JSON.parse(value) as Partial<Rating>;
            if (
              !Number.isInteger(rating.teaching) || rating.teaching! < 0 || rating.teaching! > 100 ||
              !Number.isInteger(rating.internalMarking) || rating.internalMarking! < 0 || rating.internalMarking! > 100 ||
              !Number.isInteger(rating.examEvaluation) || rating.examEvaluation! < 0 || rating.examEvaluation! > 100 ||
              !Number.isInteger(rating.overallRecommendation) || rating.overallRecommendation! < 0 || rating.overallRecommendation! > 100 ||
              !Number.isInteger(rating.classAverage) || rating.classAverage! < 0 || rating.classAverage! > 100 ||
              !['no', 'sometimes', 'yes'].includes(rating.questionProvision ?? '')
            ) continue;
            ratingRows.push({
              faculty_id: record.facultyId,
              teaching: rating.teaching!,
              internal_marking: rating.internalMarking!,
              exam_evaluation: rating.examEvaluation!,
              overall_recommendation: rating.overallRecommendation!,
              class_average: rating.classAverage!,
              question_provision: rating.questionProvision!,
              created_at: rating.createdAt ?? 0,
            });
          } catch {
            continue;
          }
        }
      }
      files['ratings.csv'] = toCsv(ratingRows);
      counts.ratings = ratingRows.length;
    }

    const exportedAt = new Date().toISOString();
    const subreddit = await reddit.getCurrentSubreddit();
    const metadata = {
      schemaVersion: 1,
      appVersion: '1.0.0',
      exportedAt,
      sourceSubreddit: subreddit.name,
      dataset,
      counts,
    };
    files['metadata.json'] = JSON.stringify(metadata, null, 2);
    files['manifest.json'] = JSON.stringify({
      format: 'faculty-ratings-export',
      schemaVersion: 1,
      exportedAt,
      files: Object.keys(files).sort(),
      notes: ['Reddit voter IDs are intentionally excluded.', 'Imported ratings are anonymous individual records.'],
    }, null, 2);

    const archive = createZip(files);
    await logExport(actor, dataset, archive.length, counts);
    const date = exportedAt.slice(0, 10);
    return new Response(new Uint8Array(archive), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="FacultyRatings_' + date + '.zip"',
        'Content-Length': String(archive.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Data export failed:', error);
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to export data.',
    }, 500);
  }
});
