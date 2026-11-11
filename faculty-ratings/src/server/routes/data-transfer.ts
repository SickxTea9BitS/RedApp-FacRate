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


type ImportMode = 'faculty' | 'faculty-courses' | 'courses' | 'ratings' | 'all';
type CsvRow = Record<string, string>;

const validFacultyRow = (row: CsvRow) =>
  Boolean(row.first_name?.trim()) &&
  Boolean(row.last_name?.trim()) &&
  row.first_name.length <= 60 &&
  (row.middle_name ?? '').length <= 60 &&
  row.last_name.length <= 60 &&
  ['SASL', 'SBET', 'SCOPE', 'SCAI', 'SMEC', 'BS', 'SEEE', 'SA'].includes((row.school ?? '').trim().toUpperCase());

const identityKey = (row: { first_name?: string; middle_name?: string; last_name?: string; school?: string }) =>
  [row.first_name, row.middle_name, row.last_name, row.school]
    .map(value => (value ?? '').normalize('NFKC').trim().replace(/\\s+/g, ' ').toLowerCase())
    .join('|');

const validRatingRow = (row: CsvRow) => {
  const fields = ['teaching', 'internal_marking', 'exam_evaluation', 'overall_recommendation', 'class_average'];
  return fields.every(field => /^\\d+$/.test(row[field] ?? '') && Number(row[field]) >= 0 && Number(row[field]) <= 100) &&
    ['no', 'sometimes', 'yes'].includes(row.question_provision ?? '') &&
    /^\\d{1,16}$/.test(row.created_at ?? '');
};

const readImportArchive = async (c: import('hono').Context) => {
  const form = await c.req.formData();
  const mode = String(form.get('mode') ?? '') as ImportMode;
  const upload = form.get('file');
  if (!['faculty', 'faculty-courses', 'courses', 'ratings', 'all'].includes(mode)) throw new Error('Select a valid import mode.');
  if (!(upload instanceof File)) throw new Error('Choose a ZIP file to import.');
  const files = readZip(new Uint8Array(await upload.arrayBuffer()));
  const manifest = JSON.parse(files['manifest.json'] ?? 'null') as { format?: string; schemaVersion?: number } | null;
  if (!manifest || manifest.format !== 'faculty-ratings-export' || manifest.schemaVersion !== 1) {
    throw new Error('This ZIP is not a supported Faculty Ratings export (schema version 1).');
  }
  const required: Record<ImportMode, string[]> = {
    faculty: ['faculties.csv'],
    'faculty-courses': ['faculties.csv', 'faculty_course_assignments.csv'],
    courses: ['courses.csv'],
    ratings: ['faculties.csv', 'ratings.csv'],
    all: ['faculties.csv', 'courses.csv', 'faculty_course_assignments.csv', 'ratings.csv'],
  };
  for (const name of required[mode]) if (!(name in files)) throw new Error('The archive is missing ' + name + '.');
  const metadata = JSON.parse(files['metadata.json'] ?? 'null') as { schemaVersion?: number } | null;
  if (!metadata || metadata.schemaVersion !== 1) throw new Error('The export metadata is missing or unsupported.');
  const rows = {
    faculties: files['faculties.csv'] === undefined ? [] : parseCsv(files['faculties.csv']),
    courses: files['courses.csv'] === undefined ? [] : parseCsv(files['courses.csv']),
    assignments: files['faculty_course_assignments.csv'] === undefined ? [] : parseCsv(files['faculty_course_assignments.csv']),
    ratings: files['ratings.csv'] === undefined ? [] : parseCsv(files['ratings.csv']),
  };
  if (Object.values(rows).some(list => list.length > 100_000)) throw new Error('The archive contains too many CSV rows.');
  if (rows.faculties.some(row => !validFacultyRow(row))) throw new Error('One or more faculty rows contain invalid names or school values.');
  if (rows.courses.some(row => !/^[A-Z]{3}[0-9]{4}$/.test((row.course_code ?? '').trim().toUpperCase()))) throw new Error('One or more course codes are invalid. Expected format: XXX0000.');
  const sourceFacultyIds = new Set(rows.faculties.map(row => row.faculty_id).filter(Boolean));
  if (rows.faculties.some(row => !row.faculty_id || !/^VITBFAC[0-9]{4,}$/.test(row.faculty_id))) throw new Error('Every faculty row must have a valid permanent faculty ID.');
  if (rows.assignments.some(row => !sourceFacultyIds.has(row.faculty_id) || !/^[A-Z]{3}[0-9]{4}$/.test((row.course_code ?? '').trim().toUpperCase()))) {
    throw new Error('Faculty course assignments contain an unknown faculty ID or invalid course code.');
  }
  if (rows.ratings.some(row => !sourceFacultyIds.has(row.faculty_id) || !validRatingRow(row))) {
    throw new Error('Ratings contain an unknown faculty ID or invalid rating values.');
  }
  if (rows.faculties.length !== new Set(rows.faculties.map(row => row.faculty_id)).size) throw new Error('The archive contains duplicate permanent faculty IDs.');
  if (rows.courses.length !== new Set(rows.courses.map(row => row.course_code.trim().toUpperCase())).size) throw new Error('The archive contains duplicate course codes.');
  return { mode, rows };
};

dataTransfer.post('/import/preview', async (c) => {
  const actor = await getAdminActor();
  if (!actor) return c.json({ status: 'error', message: 'Approved admin access is required.' }, 403);
  try {
    const { mode, rows } = await readImportArchive(c);
    const [storedFaculty, storedCourses] = await Promise.all([redis.hGetAll(FACULTY_KEY), redis.hGetAll(COURSES_KEY)]);
    const existingFaculty = parseHash<Faculty>(storedFaculty).map(({ id, record }) => ({ id, record }));
    const existingCourses = new Set(Object.keys(storedCourses));
    const facultyById = new Map(existingFaculty.filter(item => item.record.facultyId).map(item => [item.record.facultyId!, item]));
    const identities = new Map<string, typeof existingFaculty>();
    for (const item of existingFaculty) {
      const key = identityKey({ first_name: item.record.firstName, middle_name: item.record.middleName, last_name: item.record.lastName, school: item.record.school });
      identities.set(key, [...(identities.get(key) ?? []), item]);
    }
    const matches = rows.faculties.map(source => {
      const byId = facultyById.get(source.faculty_id);
      const byIdentity = identities.get(identityKey(source)) ?? [];
      return { sourceId: source.faculty_id, match: byId ? 'faculty-id' : byIdentity.length === 1 ? 'identity' : byIdentity.length > 1 ? 'ambiguous' : 'new' };
    });
    const missingCourses = Array.from(new Set([
      ...rows.courses.map(row => row.course_code.trim().toUpperCase()),
      ...rows.assignments.map(row => row.course_code.trim().toUpperCase()),
    ])).filter(code => !existingCourses.has(code)).sort();
    return c.json({
      status: 'success',
      mode,
      counts: {
        facultiesInFile: rows.faculties.length,
        coursesInFile: rows.courses.length,
        assignmentsInFile: rows.assignments.length,
        ratingsInFile: rows.ratings.length,
        existingFaculties: existingFaculty.length,
        existingCourses: existingCourses.size,
        newFaculties: matches.filter(item => item.match === 'new').length,
        matchedByFacultyId: matches.filter(item => item.match === 'faculty-id').length,
        matchedByIdentity: matches.filter(item => item.match === 'identity').length,
        ambiguousFacultyMatches: matches.filter(item => item.match === 'ambiguous').length,
        missingCourses: missingCourses.length,
      },
      missingCourses,
      ambiguousFacultyIds: matches.filter(item => item.match === 'ambiguous').map(item => item.sourceId),
      warnings: mode === 'all' ? [
        'This operation replaces faculty, courses, assignments, and ratings in this subreddit.',
        'Approved admins may perform this operation. A full backup is created before replacement.',
        'Owner, approved admins, security settings, moderation/admin logs, and security audit logs are preserved.',
      ] : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to validate the import archive.';
    return c.json({ status: 'error', message }, 400);
  }
});
