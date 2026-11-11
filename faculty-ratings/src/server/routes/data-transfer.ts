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

const ensurePermanentFacultyIds = async () => {
  const stored = await redis.hGetAll(FACULTY_KEY);
  for (const [id, value] of Object.entries(stored)) {
    try {
      const record = JSON.parse(value) as Faculty;
      if (!record.facultyId) {
        const sequence = await redis.incrBy('faculty:id-counter', 1);
        await redis.hSet(FACULTY_KEY, { [id]: JSON.stringify({ ...record, facultyId: 'VITBFAC' + String(sequence).padStart(4, '0') }) });
      }
    } catch { /* Preserve malformed legacy data for moderators to repair. */ }
  }
  const refreshed = await redis.hGetAll(FACULTY_KEY);
  const permanentIds = parseHash<Faculty>(refreshed).flatMap(item => item.record.facultyId ? [item.record.facultyId] : []);
  await synchronizeFacultyIdCounter(permanentIds);
};

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
    const storedCourses = await redis.hGetAll(COURSES_KEY);
    await ensurePermanentFacultyIds();
    const refreshedFaculty = await redis.hGetAll(FACULTY_KEY);
    const faculty = parseHash<Faculty>(refreshedFaculty);
    const courses = parseHash<{ code?: string }>(storedCourses)
      .filter(({ id, record }) => COURSE_CODE_PATTERN.test(record.code ?? id))
      .map(({ id, record }) => ({ course_code: record.code ?? id }));
    const files: Record<string, string> = {};
    const counts: Record<string, number> = {};

    if (dataset === 'faculty' || dataset === 'faculty-courses' || dataset === 'all' || dataset === 'ratings') {
      const rows = facultyRows(faculty);
      files['faculties.csv'] = toCsv(rows, ['faculty_id', 'first_name', 'middle_name', 'last_name', 'school']);
      counts.faculties = rows.length;
    }

    if (dataset === 'courses' || dataset === 'all' || (dataset === 'faculty' && includeAssignments)) {
      files['courses.csv'] = toCsv(courses, ['course_code']);
      counts.courses = courses.length;
    }

    if (dataset === 'faculty-courses' || dataset === 'all' || (dataset === 'faculty' && includeAssignments)) {
      const rows = assignmentRows(faculty);
      files['faculty_course_assignments.csv'] = toCsv(rows, ['faculty_id', 'course_code']);
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
      files['ratings.csv'] = toCsv(ratingRows, ['faculty_id', 'teaching', 'internal_marking', 'exam_evaluation', 'overall_recommendation', 'class_average', 'question_provision', 'created_at']);
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
    try { await writeImportLog(actor, 'data.export', { dataset, error: error instanceof Error ? error.message : 'Unknown failure' }, 'failure'); } catch { /* Preserve the export error. */ }
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to export data.',
    }, 500);
  }
});


type ImportMode = 'faculty' | 'faculty-courses' | 'courses' | 'ratings' | 'all';
type CsvRow = Record<string, string> & {
  faculty_id: string; first_name: string; middle_name: string; last_name: string; school: string;
  course_code: string; teaching: string; internal_marking: string; exam_evaluation: string;
  overall_recommendation: string; class_average: string; question_provision: string; created_at: string;
};

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

const readImportArchive = async (form: FormData) => {
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
  const requireHeaders = (name: string, expected: string[]) => {
    const header = (files[name] ?? '').split(/\\r?\\n/, 1)[0]!.split(',').map(value => value.trim());
    if (header.length !== expected.length || expected.some((value, index) => header[index] !== value)) {
      throw new Error(name + ' has missing, unexpected, or incorrectly ordered columns.');
    }
  };
  const headerRequirements: Partial<Record<ImportMode, Array<[string, string[]]>>> = {
    faculty: [['faculties.csv', ['faculty_id', 'first_name', 'middle_name', 'last_name', 'school']]],
    'faculty-courses': [['faculties.csv', ['faculty_id', 'first_name', 'middle_name', 'last_name', 'school']], ['faculty_course_assignments.csv', ['faculty_id', 'course_code']]],
    courses: [['courses.csv', ['course_code']]],
    ratings: [['faculties.csv', ['faculty_id', 'first_name', 'middle_name', 'last_name', 'school']], ['ratings.csv', ['faculty_id', 'teaching', 'internal_marking', 'exam_evaluation', 'overall_recommendation', 'class_average', 'question_provision', 'created_at']]],
    all: [['faculties.csv', ['faculty_id', 'first_name', 'middle_name', 'last_name', 'school']], ['courses.csv', ['course_code']], ['faculty_course_assignments.csv', ['faculty_id', 'course_code']], ['ratings.csv', ['faculty_id', 'teaching', 'internal_marking', 'exam_evaluation', 'overall_recommendation', 'class_average', 'question_provision', 'created_at']]],
  };
  for (const [name, headers] of headerRequirements[mode] ?? []) requireHeaders(name, headers);
  if (mode === 'faculty' && files['courses.csv'] !== undefined) requireHeaders('courses.csv', ['course_code']);
  if (mode === 'faculty' && files['faculty_course_assignments.csv'] !== undefined) requireHeaders('faculty_course_assignments.csv', ['faculty_id', 'course_code']);
  if (mode === 'faculty-courses' && files['courses.csv'] !== undefined) requireHeaders('courses.csv', ['course_code']);
  const parseRows = (source: string): CsvRow[] => parseCsv(source) as unknown as CsvRow[];
  const rows = {
    faculties: files['faculties.csv'] === undefined ? [] : parseRows(files['faculties.csv']),
    courses: files['courses.csv'] === undefined ? [] : parseRows(files['courses.csv']),
    assignments: files['faculty_course_assignments.csv'] === undefined ? [] : parseRows(files['faculty_course_assignments.csv']),
    ratings: files['ratings.csv'] === undefined ? [] : parseRows(files['ratings.csv']),
  };
  if (Object.values(rows).some(list => list.length > 100_000)) throw new Error('The archive contains too many CSV rows.');
  if (rows.faculties.some(row => !validFacultyRow(row))) throw new Error('One or more faculty rows contain invalid names or school values.');
  if (rows.courses.some(row => !/^[A-Z]{3}[0-9]{4}$/.test((row.course_code ?? '').trim().toUpperCase()))) throw new Error('One or more course codes are invalid. Expected format: XXX0000.');
  const sourceFacultyIds = new Set(rows.faculties.map(row => row.faculty_id).filter(Boolean));
  if (rows.faculties.some(row => !row.faculty_id || !/^VITBFAC[0-9]{4,15}$/.test(row.faculty_id))) throw new Error('Every faculty row must have a valid permanent faculty ID.');
  const sourceCourseCodes = new Set(rows.courses.map(row => row.course_code.trim().toUpperCase()));
  if (mode !== 'faculty-courses' && rows.assignments.some(row => !sourceCourseCodes.has(row.course_code.trim().toUpperCase()))) {
    throw new Error('Every faculty course assignment must reference a course included in courses.csv.');
  }
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
    const { mode, rows } = await readImportArchive(await c.req.formData());
    await ensurePermanentFacultyIds();
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
      return { sourceId: source.faculty_id, match: byId ? 'faculty-id' : byIdentity.length === 1 ? 'identity' : byIdentity.length > 1 ? 'ambiguous' : 'new', candidates: byIdentity.map(item => ({ facultyId: item.record.facultyId ?? '', name: [item.record.firstName, item.record.middleName, item.record.lastName].filter(Boolean).join(' '), school: item.record.school })) };
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
        existingRatings: (await Promise.all(existingFaculty.map(item => redis.hGetAll(RATINGS_PREFIX + item.id)))).reduce((total, ratings) => total + Object.keys(ratings).length, 0),
        newFaculties: matches.filter(item => item.match === 'new').length,
        matchedByFacultyId: matches.filter(item => item.match === 'faculty-id').length,
        matchedByIdentity: matches.filter(item => item.match === 'identity').length,
        ambiguousFacultyMatches: matches.filter(item => item.match === 'ambiguous').length,
        missingCourses: missingCourses.length,
      },
      missingCourses,
      ambiguousFacultyIds: matches.filter(item => item.match === 'ambiguous').map(item => item.sourceId),
      ambiguousFacultyMatches: matches.filter(item => item.match === 'ambiguous'),
      warnings: mode === 'all' ? [
        'This operation replaces faculty, courses, assignments, and ratings in this subreddit.',
        'Approved admins may perform this operation. A full backup is created before replacement.',
        'Owner, approved admins, security settings, moderation/admin logs, and security audit logs are preserved.',
      ] : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to validate the import archive.';
    try { await writeImportLog(actor, 'data.import.preview', { error: message }, 'failure'); } catch { /* Preserve the validation error. */ }
    return c.json({ status: 'error', message }, 400);
  }
});


type ImportOptions = {
  selectedCourses?: unknown;
  addMissingFaculty?: unknown;
  facultyResolutions?: unknown;
  confirmation?: unknown;
  finalConfirmation?: unknown;
};

const writeImportLog = async (
  actor: { id: string; username: string },
  action: string,
  details: Record<string, unknown>,
  result: 'success' | 'failure' = 'success'
) => {
  const entry = { id: randomUUID(), actorId: actor.id, actorUsername: actor.username, action, timestamp: Date.now(), details, result };
  await redis.zAdd(ADMIN_LOG_KEY, { member: JSON.stringify(entry), score: entry.timestamp });
};

const setHashInBatches = async (key: string, values: Record<string, string>) => {
  const entries = Object.entries(values);
  for (let index = 0; index < entries.length; index += 200) {
    await redis.hSet(key, Object.fromEntries(entries.slice(index, index + 200)));
  }
};

const synchronizeFacultyIdCounter = async (facultyIds: string[]) => {
  const maximum = facultyIds.reduce((max, id) => {
    const match = /^VITBFAC([0-9]+)$/.exec(id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const current = Number(await redis.get('faculty:id-counter') ?? '0');
  if (Number.isSafeInteger(maximum) && maximum > current) await redis.incrBy('faculty:id-counter', maximum - current);
};

const createPermanentFacultyId = async (used: Set<string>) => {
  for (let attempt = 0; attempt < 100_000; attempt += 1) {
    const sequence = await redis.incrBy('faculty:id-counter', 1);
    const id = 'VITBFAC' + String(sequence).padStart(4, '0');
    if (!used.has(id)) { used.add(id); return id; }
  }
  throw new Error('Unable to allocate a unique permanent faculty ID.');
};

const sourceFacultyMap = async (
  rows: CsvRow[],
  addMissing: boolean,
  resolutions: Record<string, string>,
  selectedCourses: Set<string>,
  assignmentRows: CsvRow[],
  preserveSourceIds = false
) => {
  const stored = await redis.hGetAll(FACULTY_KEY);
  const existing = parseHash<Faculty>(stored);
  const byId = new Map(existing.filter(item => item.record.facultyId).map(item => [item.record.facultyId!, item]));
  const byIdentity = new Map<string, typeof existing>();
  for (const item of existing) {
    const key = identityKey({ first_name: item.record.firstName, middle_name: item.record.middleName, last_name: item.record.lastName, school: item.record.school });
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), item]);
  }
  const usedIds = new Set(existing.map(item => item.record.facultyId).filter((id): id is string => Boolean(id)));
  if (preserveSourceIds) await synchronizeFacultyIdCounter(rows.map(row => row.faculty_id));
  for (const row of rows) {
    if (byId.has(row.faculty_id)) continue;
    const candidates = byIdentity.get(identityKey(row)) ?? [];
    if (candidates.length > 1) {
      const resolved = resolutions[row.faculty_id];
      if (!resolved || !candidates.some(item => item.record.facultyId === resolved)) {
        throw new Error('Faculty ' + row.faculty_id + ' has multiple possible matches. Choose one of the listed destination faculty records.');
      }
    }
  }
  const assignmentsBySource = new Map<string, string[]>();
  for (const row of assignmentRows) assignmentsBySource.set(row.faculty_id, [...(assignmentsBySource.get(row.faculty_id) ?? []), row.course_code.trim().toUpperCase()]);
  const mapping = new Map<string, string>();
  let added = 0;
  let matched = 0;
  const addedFacultyIds: string[] = [];

  for (const row of rows) {
    let target = byId.get(row.faculty_id);
    if (!target) {
      const identityMatches = byIdentity.get(identityKey(row)) ?? [];
      if (identityMatches.length === 1) target = identityMatches[0];
      else if (identityMatches.length > 1) {
        const resolvedFacultyId = resolutions[row.faculty_id];
        if (resolvedFacultyId) target = identityMatches.find(item => item.record.facultyId === resolvedFacultyId);
        if (!target) throw new Error('Faculty ' + row.faculty_id + ' has multiple possible matches. Resolve the ambiguity before importing.');
      }
    }

    if (target) {
      mapping.set(row.faculty_id, target.id);
      matched += 1;
      if (assignmentRows.length) {
        const current = target.record.courseCodes ?? [];
        const incoming = assignmentsBySource.get(row.faculty_id) ?? [];
        const merged = Array.from(new Set([...current, ...incoming.filter(code => selectedCourses.has(code))]));
        if (merged.length !== current.length) {
          await redis.hSet(FACULTY_KEY, { [target.id]: JSON.stringify({ ...target.record, courseCodes: merged }) });
        }
      }
      continue;
    }

    if (!addMissing) continue;
    const permanentId = preserveSourceIds && /^VITBFAC[0-9]{4,}$/.test(row.faculty_id) && !usedIds.has(row.faculty_id)
      ? (usedIds.add(row.faculty_id), row.faculty_id)
      : await createPermanentFacultyId(usedIds);
    const key = randomUUID();
    const courseCodes = Array.from(new Set((assignmentsBySource.get(row.faculty_id) ?? []).filter(code => selectedCourses.has(code))));
    const record: Faculty = {
      facultyId: permanentId,
      firstName: row.first_name.trim(),
      middleName: (row.middle_name ?? '').trim(),
      lastName: row.last_name.trim(),
      school: row.school.trim().toUpperCase(),
      courseCodes,
      createdAt: Date.now(),
    };
    await redis.hSet(FACULTY_KEY, { [key]: JSON.stringify(record) });
    mapping.set(row.faculty_id, key);
    addedFacultyIds.push(permanentId);
    added += 1;
  }
  return { mapping, added, matched, addedFacultyIds };
};

dataTransfer.post('/import/apply', async (c) => {
  const actor = await getAdminActor();
  if (!actor) return c.json({ status: 'error', message: 'Approved admin access is required.' }, 403);

  let mode = 'unknown';
  try {
    const form = await c.req.formData();
    const options = JSON.parse(String(form.get('options') ?? '{}')) as ImportOptions;
    const upload = form.get('file');
    if (!(upload instanceof File)) throw new Error('Choose the validated ZIP file again to continue.');
    const { mode: parsedMode, rows } = await readImportArchive(form);
    mode = parsedMode;
    await ensurePermanentFacultyIds();
    const selectedCourses = new Set(
      Array.isArray(options.selectedCourses)
        ? options.selectedCourses.filter((value): value is string => typeof value === 'string' && /^[A-Z]{3}[0-9]{4}$/.test(value))
        : []
    );
    const resolutions = options.facultyResolutions && typeof options.facultyResolutions === 'object'
      ? options.facultyResolutions as Record<string, string>
      : {};

    if (mode === 'all') {
      if (options.confirmation !== 'CONFIRM' || options.finalConfirmation !== true) {
        throw new Error('Full replacement requires typing CONFIRM and accepting the final confirmation.');
      }
      const currentFaculty = await redis.hGetAll(FACULTY_KEY);
      const currentCourses = await redis.hGetAll(COURSES_KEY);
      const currentRatings: Record<string, Record<string, string>> = {};
      for (const id of Object.keys(currentFaculty)) currentRatings[id] = await redis.hGetAll(RATINGS_PREFIX + id);
      const backupId = randomUUID();
      const backupKey = 'import:backup:' + backupId;
      const backup = { backupId, createdAt: Date.now(), actorId: actor.id, faculty: currentFaculty, courses: currentCourses, ratings: currentRatings };
      await redis.hSet(backupKey, { snapshot: JSON.stringify(backup) });
      await redis.hSet('import:backups', { [backupId]: JSON.stringify({ backupId, createdAt: backup.createdAt, actorId: actor.id, facultyCount: Object.keys(currentFaculty).length, courseCount: Object.keys(currentCourses).length }) });
      await writeImportLog(actor, 'data.backup.created', { backupId, type: 'full-replacement' });

      try {
        await synchronizeFacultyIdCounter(rows.faculties.map(row => row.faculty_id));
        const coursesByCode = new Set(rows.courses.map(row => row.course_code.trim().toUpperCase()));
        const facultyKeyBySource = new Map<string, string>();
        const newFaculty: Record<string, string> = {};
        const usedIds = new Set<string>();
        for (const row of rows.faculties) {
          if (usedIds.has(row.faculty_id)) throw new Error('Duplicate permanent faculty ID in full replacement.');
          usedIds.add(row.faculty_id);
          const key = randomUUID();
          facultyKeyBySource.set(row.faculty_id, key);
          const assigned = rows.assignments.filter(item => item.faculty_id === row.faculty_id).map(item => item.course_code.trim().toUpperCase()).filter(code => coursesByCode.has(code));
          newFaculty[key] = JSON.stringify({
            facultyId: row.faculty_id,
            firstName: row.first_name.trim(),
            middleName: (row.middle_name ?? '').trim(),
            lastName: row.last_name.trim(),
            school: row.school.trim().toUpperCase(),
            courseCodes: Array.from(new Set(assigned)),
            createdAt: Date.now(),
          });
        }
        const newCourses: Record<string, string> = {};
        for (const row of rows.courses) {
          const code = row.course_code.trim().toUpperCase();
          newCourses[code] = JSON.stringify({ id: code, code, createdAt: Date.now(), createdByUsername: actor.username, approvedAt: Date.now(), approvedByUsername: actor.username });
        }
        const newRatings: Record<string, Record<string, string>> = {};
        for (const row of rows.ratings) {
          const facultyKey = facultyKeyBySource.get(row.faculty_id);
          if (!facultyKey) continue;
          const rating: Rating = {
            teaching: Number(row.teaching),
            internalMarking: Number(row.internal_marking),
            examEvaluation: Number(row.exam_evaluation),
            overallRecommendation: Number(row.overall_recommendation),
            classAverage: Number(row.class_average),
            questionProvision: row.question_provision as Rating['questionProvision'],
            createdAt: Number(row.created_at),
          };
          (newRatings[facultyKey] ??= {})['imported:' + randomUUID()] = JSON.stringify(rating);
        }
        const oldRatingKeys = Object.keys(currentFaculty).map(id => RATINGS_PREFIX + id);
        await redis.del(FACULTY_KEY, COURSES_KEY, ...oldRatingKeys);
        await setHashInBatches(FACULTY_KEY, newFaculty);
        await setHashInBatches(COURSES_KEY, newCourses);
        for (const [facultyKey, ratings] of Object.entries(newRatings)) await setHashInBatches(RATINGS_PREFIX + facultyKey, ratings);
        await writeImportLog(actor, 'data.import.full-replacement', {
          backupId,
          faculties: Object.keys(newFaculty).length,
          courses: Object.keys(newCourses).length,
          ratings: Object.values(newRatings).reduce((sum, item) => sum + Object.keys(item).length, 0),
        });
        return c.json({ status: 'success', message: 'Full replacement completed. A recovery backup was retained.', backupId });
      } catch (error) {
        const partialFaculty = await redis.hGetAll(FACULTY_KEY);
        const partialRatingKeys = Object.keys(partialFaculty).map(id => RATINGS_PREFIX + id);
        await redis.del(FACULTY_KEY, COURSES_KEY, ...partialRatingKeys);
        await setHashInBatches(FACULTY_KEY, currentFaculty);
        await setHashInBatches(COURSES_KEY, currentCourses);
        for (const [id, ratings] of Object.entries(currentRatings)) await setHashInBatches(RATINGS_PREFIX + id, ratings);
        await writeImportLog(actor, 'data.import.full-replacement.rollback', { backupId, error: error instanceof Error ? error.message : 'Unknown failure' }, 'failure');
        throw new Error('Full replacement failed; the original data was restored. ' + (error instanceof Error ? error.message : 'Unknown failure'));
      }
    }

    if (mode === 'courses') {
      const current = await redis.hGetAll(COURSES_KEY);
      const added: Record<string, string> = {};
      for (const row of rows.courses) {
        const code = row.course_code.trim().toUpperCase();
        if (current[code] || !selectedCourses.has(code)) continue;
        added[code] = JSON.stringify({ id: code, code, createdAt: Date.now(), createdByUsername: actor.username, approvedAt: Date.now(), approvedByUsername: actor.username });
      }
      await setHashInBatches(COURSES_KEY, added);
      await writeImportLog(actor, 'data.import.courses', { added: Object.keys(added).length, courseCodes: Object.keys(added) });
      return c.json({ status: 'success', message: Object.keys(added).length + ' course(s) imported.', addedCourses: Object.keys(added) });
    }

    const currentCourses = await redis.hGetAll(COURSES_KEY);
    const newCourses: Record<string, string> = {};
    const courseCodesToImport = new Set([...rows.courses.map(row => row.course_code.trim().toUpperCase()), ...(mode === 'faculty-courses' ? rows.assignments.map(row => row.course_code.trim().toUpperCase()) : [])]);
    for (const code of courseCodesToImport) {
      if (currentCourses[code] || !selectedCourses.has(code)) continue;
      newCourses[code] = JSON.stringify({ id: code, code, createdAt: Date.now(), createdByUsername: actor.username, approvedAt: Date.now(), approvedByUsername: actor.username });
    }
    const availableCodes = new Set([...Object.keys(currentCourses), ...Object.keys(newCourses)]);
    const assignments = rows.assignments.filter(row => availableCodes.has(row.course_code.trim().toUpperCase()));
    const addMissingFaculty = mode === 'faculty' || mode === 'ratings' && options.addMissingFaculty === true;
    const { mapping, added, matched, addedFacultyIds } = await sourceFacultyMap(rows.faculties, addMissingFaculty, resolutions, availableCodes, assignments, mode === 'faculty' && Object.keys(await redis.hGetAll(FACULTY_KEY)).length === 0);
    await setHashInBatches(COURSES_KEY, newCourses);
    let importedRatings = 0;

    if (mode === 'ratings') {
      for (const row of rows.ratings) {
        const facultyKey = mapping.get(row.faculty_id);
        if (!facultyKey) continue;
        const rating: Rating = {
          teaching: Number(row.teaching),
          internalMarking: Number(row.internal_marking),
          examEvaluation: Number(row.exam_evaluation),
          overallRecommendation: Number(row.overall_recommendation),
          classAverage: Number(row.class_average),
          questionProvision: row.question_provision as Rating['questionProvision'],
          createdAt: Number(row.created_at),
        };
        await redis.hSet(RATINGS_PREFIX + facultyKey, { ['imported:' + randomUUID()]: JSON.stringify(rating) });
        importedRatings += 1;
      }
    }

    const details = { mode, addedFaculties: added, addedFacultyIds, matchedFaculties: matched, skippedFaculties: rows.faculties.length - mapping.size, addedCourses: Object.keys(newCourses).length, courseCodesAdded: Object.keys(newCourses), importedRatings };
    await writeImportLog(actor, 'data.import.' + mode, details);
    return c.json({ status: 'success', message: 'Import completed.', ...details });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import data.';
    try { await writeImportLog(actor, 'data.import.' + mode, { error: message }, 'failure'); } catch { /* Preserve the import error if audit logging also fails. */ }
    return c.json({ status: 'error', message }, 400);
  }
});


dataTransfer.get('/backups', async (c) => {
  const actor = await getAdminActor();
  if (!actor) return c.json({ status: 'error', message: 'Approved admin access is required.' }, 403);
  const stored = await redis.hGetAll('import:backups');
  const backups = Object.values(stored).flatMap(value => {
    try { return [JSON.parse(value) as { backupId: string; createdAt: number; actorId: string; facultyCount: number; courseCount: number }]; }
    catch { return []; }
  }).sort((a, b) => b.createdAt - a.createdAt);
  return c.json({ status: 'success', backups });
});

dataTransfer.post('/backups/:id/restore', async (c) => {
  const actor = await getAdminActor();
  if (!actor) return c.json({ status: 'error', message: 'Approved admin access is required.' }, 403);
  const backupId = c.req.param('id');
  if (!/^[0-9a-f-]{36}$/i.test(backupId)) return c.json({ status: 'error', message: 'Invalid backup ID.' }, 400);
  const restoreConfirmation = await c.req.json<{ confirmation?: unknown; finalConfirmation?: unknown }>().catch(() => ({} as { confirmation?: unknown; finalConfirmation?: unknown }));
  if (restoreConfirmation.confirmation !== 'RESTORE' || restoreConfirmation.finalConfirmation !== true) {
    return c.json({ status: 'error', message: 'Type RESTORE and accept the final confirmation before restoring a backup.' }, 400);
  }
  try {
    const storedBackup = await redis.hGet('import:backup:' + backupId, 'snapshot');
    if (!storedBackup) return c.json({ status: 'error', message: 'Backup not found.' }, 404);
    const backup = JSON.parse(storedBackup) as {
      faculty: Record<string, string>;
      courses: Record<string, string>;
      ratings: Record<string, Record<string, string>>;
    };
    if (!backup.faculty || !backup.courses || !backup.ratings) throw new Error('Backup contents are incomplete.');
    const currentFaculty = await redis.hGetAll(FACULTY_KEY);
    const currentCourses = await redis.hGetAll(COURSES_KEY);
    const currentRatings: Record<string, Record<string, string>> = {};
    for (const id of Object.keys(currentFaculty)) currentRatings[id] = await redis.hGetAll(RATINGS_PREFIX + id);
    const rollbackId = randomUUID();
    await redis.hSet('import:backup:' + rollbackId, { snapshot: JSON.stringify({ backupId: rollbackId, createdAt: Date.now(), actorId: actor.id, faculty: currentFaculty, courses: currentCourses, ratings: currentRatings }) });
    await redis.hSet('import:backups', { [rollbackId]: JSON.stringify({ backupId: rollbackId, createdAt: Date.now(), actorId: actor.id, facultyCount: Object.keys(currentFaculty).length, courseCount: Object.keys(currentCourses).length }) });

    try {
      const currentRatingKeys = Object.keys(currentFaculty).map(id => RATINGS_PREFIX + id);
      await redis.del(FACULTY_KEY, COURSES_KEY, ...currentRatingKeys);
      await setHashInBatches(FACULTY_KEY, backup.faculty);
      await setHashInBatches(COURSES_KEY, backup.courses);
      for (const [id, ratings] of Object.entries(backup.ratings)) await setHashInBatches(RATINGS_PREFIX + id, ratings);
      const permanentIds = Object.values(backup.faculty).flatMap(value => {
        try { const record = JSON.parse(value) as Faculty; return record.facultyId ? [record.facultyId] : []; }
        catch { return []; }
      });
      await synchronizeFacultyIdCounter(permanentIds);
      await writeImportLog(actor, 'data.backup.restored', { backupId, rollbackBackupId: rollbackId });
      return c.json({ status: 'success', message: 'Backup restored. A backup of the replaced data was retained.', rollbackBackupId: rollbackId });
    } catch (error) {
      const partialFaculty = await redis.hGetAll(FACULTY_KEY);
      const partialRatingKeys = Object.keys(partialFaculty).map(id => RATINGS_PREFIX + id);
      await redis.del(FACULTY_KEY, COURSES_KEY, ...partialRatingKeys);
      await setHashInBatches(FACULTY_KEY, currentFaculty);
      await setHashInBatches(COURSES_KEY, currentCourses);
      for (const [id, ratings] of Object.entries(currentRatings)) await setHashInBatches(RATINGS_PREFIX + id, ratings);
      await writeImportLog(actor, 'data.backup.restore-rollback', { backupId, rollbackBackupId: rollbackId, error: error instanceof Error ? error.message : 'Unknown failure' }, 'failure');
      throw new Error('Backup restore failed; the destination data was restored. ' + (error instanceof Error ? error.message : 'Unknown failure'));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to restore backup.';
    return c.json({ status: 'error', message }, 500);
  }
});
