import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  ApiErrorResponse,
  DecrementResponse,
  FacultyListResponse,
  FacultyRecord,
  FacultyRequest,
  FacultyRequestSubmissionResponse,
  IncrementResponse,
  InitResponse,
  ModerationActionResponse,
  CourseRecord,
  CourseRequest,
  CourseListResponse,
  CourseRequestSubmissionResponse,
  ModeratorCourseRequestsResponse,
  ModeratorRequestsResponse,
  ModeratorStatusResponse,
} from '../../shared/api';

export const api = new Hono();

const FACULTY_HASH_KEY = 'faculty:records';
const REQUESTS_HASH_KEY = 'faculty:requests';
const COURSES_HASH_KEY = 'courses:records';
const COURSE_REQUESTS_HASH_KEY = 'courses:requests';
const COURSE_CODE_PATTERN = /^[A-Z]{3}[0-9]{4}$/;

const VALID_SCHOOLS = [
  'SASL',
  'SBET',
  'SCOPE',
  'SCAI',
  'SMEC',
  'BS',
  'SEEE',
  'SA',
];

const REJECTION_REASONS = [
  'Duplicate Request',
  'Already Exists',
  'Invalid',
  'Custom',
];

const normalizeName = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

const getFullName = (record: {
  firstName: string;
  middleName?: string;
  lastName: string;
}) =>
  [record.firstName, record.middleName, record.lastName]
    .filter(Boolean)
    .join(' ');

const isDuplicateFaculty = (
  records: Record<string, string>,
  request: FacultyRequest
) => {
  return Object.values(records).some((value) => {
    try {
      const record = JSON.parse(value) as FacultyRecord;

      return (
        record.school === request.school &&
        normalizeName(getFullName(record)) ===
          normalizeName(getFullName(request))
      );
    } catch {
      return false;
    }
  });
};

const getModerator = async () => {
  try {
    const user = await reddit.getCurrentUser();

    if (!user) {
      return null;
    }

    const subreddit = await reddit.getCurrentSubreddit();
    const permissions = await user.getModPermissionsForSubreddit(
      subreddit.name
    );

    if (!permissions || permissions.length === 0) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Moderator permission check failed:', error);
    return null;
  }
};

api.get('/faculty', async (c) => {
  try {
    const search = (c.req.query('search') ?? '').trim().toLowerCase();
    const school = (c.req.query('school') ?? '').trim().toUpperCase();

    if (school && !VALID_SCHOOLS.includes(school)) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Invalid school selection',
        },
        400
      );
    }

    const storedRecords = await redis.hGetAll(FACULTY_HASH_KEY);

    const currentUserId = context.userId;

    const records = Object.entries(storedRecords)
      .flatMap(([id, value]) => {
        try {
          const record = JSON.parse(value) as FacultyRecord;

          if (
            !record ||
            typeof record.firstName !== 'string' ||
            typeof record.lastName !== 'string' ||
            typeof record.school !== 'string'
          ) {
            return [];
          }

          return [{ ...record, id }];
        } catch {
          return [];
        }
      })
      .filter((record) => {
        const fullName = getFullName(record).toLowerCase();
        const matchesSearch = !search || fullName.includes(search);
        const matchesSchool = !school || record.school === school;

        return matchesSearch && matchesSchool;
      })
      .sort((a, b) => getFullName(a).localeCompare(getFullName(b)));

    const faculty = await Promise.all(
      records.map(async (record) => {
        const ratings = await redis.hGetAll(
          `${RATINGS_KEY_PREFIX}${record.id}`
        );
        return {
          ...record,
          ratingCount: Object.keys(ratings).length,
          hasRated: currentUserId ? Boolean(ratings[currentUserId]) : false,
        };
      })
    );

    return c.json<FacultyListResponse>({
      status: 'success',
      faculty,
      total: faculty.length,
    });
  } catch (error) {
    console.error('Faculty list error:', error);

    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Unable to load faculty records',
      },
      500
    );
  }
});

api.post('/requests', async (c) => {
  try {
    const userId = context.userId;
    const username = await reddit.getCurrentUsername();

    if (!userId || !username) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'You must be logged in to submit a faculty request.',
        },
        401
      );
    }

    const body = await c.req.json<{
      firstName?: unknown;
      middleName?: unknown;
      lastName?: unknown;
      school?: unknown;
      courseCodes?: unknown;
    }>();

    const firstName =
      typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const middleName =
      typeof body.middleName === 'string' ? body.middleName.trim() : '';
    const lastName =
      typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const school =
      typeof body.school === 'string' ? body.school.trim().toUpperCase() : '';

    const requestedCourseCodes = Array.isArray(body.courseCodes)
      ? body.courseCodes.filter((code): code is string => typeof code === 'string')
      : [];

    if (requestedCourseCodes.length > 20 || new Set(requestedCourseCodes).size !== requestedCourseCodes.length) {
      return c.json<ApiErrorResponse>({ status: 'error', message: 'Select no more than 20 unique courses.' }, 400);
    }

    const approvedCourses = await redis.hGetAll(COURSES_HASH_KEY);
    const invalidCourse = requestedCourseCodes.find((code) => !approvedCourses[code]);
    if (invalidCourse) {
      return c.json<ApiErrorResponse>({ status: 'error', message: `${invalidCourse} is not an approved course. Refresh the course list and try again.` }, 400);
    }

    if (!firstName || !lastName) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'First name and last name are required.',
        },
        400
      );
    }

    if (
      firstName.length > 60 ||
      middleName.length > 60 ||
      lastName.length > 60
    ) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Names cannot exceed 60 characters.',
        },
        400
      );
    }

    if (!VALID_SCHOOLS.includes(school)) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Please select a valid school.',
        },
        400
      );
    }

    const requestedName = normalizeName(
      [firstName, middleName, lastName].filter(Boolean).join(' ')
    );

    const [facultyRecords, requestRecords] = await Promise.all([
      redis.hGetAll(FACULTY_HASH_KEY),
      redis.hGetAll(REQUESTS_HASH_KEY),
    ]);

    for (const value of Object.values(facultyRecords)) {
      try {
        const record = JSON.parse(value) as FacultyRecord;

        if (
          normalizeName(getFullName(record)) === requestedName &&
          record.school === school
        ) {
          return c.json<ApiErrorResponse>(
            {
              status: 'error',
              message: 'This faculty member already exists in the directory.',
            },
            409
          );
        }
      } catch {
        continue;
      }
    }

    for (const value of Object.values(requestRecords)) {
      try {
        const record = JSON.parse(value) as FacultyRequest;

        if (
          record.status === 'pending' &&
          record.school === school &&
          normalizeName(getFullName(record)) === requestedName
        ) {
          return c.json<ApiErrorResponse>(
            {
              status: 'error',
              message:
                'A pending request already exists for this faculty member.',
            },
            409
          );
        }
      } catch {
        continue;
      }
    }

    const requestId = randomUUID();

    const request: FacultyRequest = {
      id: requestId,
      firstName,
      middleName,
      lastName,
      school,
      createdAt: Date.now(),
      submittedByUsername: username,
      submittedByUserId: userId,
      status: 'pending',
      courseCodes: requestedCourseCodes,
    };

    await redis.hSet(REQUESTS_HASH_KEY, {
      [requestId]: JSON.stringify(request),
    });

    return c.json<FacultyRequestSubmissionResponse>({
      status: 'success',
      message: 'Your faculty request has been submitted for moderator review.',
      requestId,
    });
  } catch (error) {
    console.error('Faculty request submission error:', error);

    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Unable to submit your request. Please try again.',
      },
      500
    );
  }
});


api.get('/courses', async (c) => {
  try {
    const search = (c.req.query('search') ?? '').trim().toUpperCase();
    const stored = await redis.hGetAll(COURSES_HASH_KEY);
    const courses = Object.entries(stored)
      .flatMap(([id, value]) => {
        try {
          const course = JSON.parse(value) as CourseRecord;
          if (!course || typeof course.code !== 'string' || !COURSE_CODE_PATTERN.test(course.code)) return [];
          return [{ ...course, id }];
        } catch {
          return [];
        }
      })
      .filter((course) => !search || course.code.includes(search))
      .sort((a, b) => a.code.localeCompare(b.code));

    return c.json<CourseListResponse>({ status: 'success', courses, total: courses.length });
  } catch (error) {
    console.error('Course list error:', error);
    return c.json<ApiErrorResponse>({ status: 'error', message: 'Unable to load courses.' }, 500);
  }
});

api.post('/course-requests', async (c) => {
  try {
    const userId = context.userId;
    const username = await reddit.getCurrentUsername();
    if (!userId || !username) {
      return c.json<ApiErrorResponse>({ status: 'error', message: 'You must be logged in to request a course.' }, 401);
    }

    const body = await c.req.json<{ code?: unknown }>();
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!COURSE_CODE_PATTERN.test(code)) {
      return c.json<ApiErrorResponse>({ status: 'error', message: 'Course code must contain exactly three letters followed by four digits (for example, MAT1001).' }, 400);
    }

    const [courses, requests] = await Promise.all([
      redis.hGetAll(COURSES_HASH_KEY),
      redis.hGetAll(COURSE_REQUESTS_HASH_KEY),
    ]);

    if (Object.values(courses).some((value) => {
      try { return (JSON.parse(value) as CourseRecord).code === code; } catch { return false; }
    })) {
      return c.json<ApiErrorResponse>({ status: 'error', message: 'This course already exists.' }, 409);
    }

    if (Object.values(requests).some((value) => {
      try {
        const request = JSON.parse(value) as CourseRequest;
        return request.code === code && request.status === 'pending';
      } catch { return false; }
    })) {
      return c.json<ApiErrorResponse>({ status: 'error', message: 'A request for this course is already pending.' }, 409);
    }

    const requestId = randomUUID();
    const request: CourseRequest = {
      id: requestId,
      code,
      createdAt: Date.now(),
      submittedByUsername: username,
      submittedByUserId: userId,
      status: 'pending',
    };
    await redis.hSet(COURSE_REQUESTS_HASH_KEY, { [requestId]: JSON.stringify(request) });

    return c.json<CourseRequestSubmissionResponse>({
      status: 'success',
      message: 'Your course request has been submitted for moderator review.',
      requestId,
    });
  } catch (error) {
    console.error('Course request submission error:', error);
    return c.json<ApiErrorResponse>({ status: 'error', message: 'Unable to submit the course request.' }, 500);
  }
});

api.get('/mod/course-requests', async (c) => {
  try {
    if (!(await getModerator())) {
      return c.json<ApiErrorResponse>({ status: 'error', message: 'Moderator permissions are required.' }, 403);
    }
    const stored = await redis.hGetAll(COURSE_REQUESTS_HASH_KEY);
    const requests = Object.values(stored)
      .flatMap((value) => {
        try {
          const request = JSON.parse(value) as CourseRequest;
          return request && request.status === 'pending' && typeof request.code === 'string' ? [request] : [];
        } catch { return []; }
      })
      .sort((a, b) => a.createdAt - b.createdAt);
    return c.json<ModeratorCourseRequestsResponse>({ status: 'success', requests, total: requests.length });
  } catch (error) {
    console.error('Moderator course requests error:', error);
    return c.json<ApiErrorResponse>({ status: 'error', message: 'Unable to load course requests.' }, 500);
  }
});

api.post('/mod/course-requests/:id/approve', async (c) => {
  try {
    const moderator = await getModerator();
    if (!moderator) return c.json<ApiErrorResponse>({ status: 'error', message: 'Moderator permissions are required.' }, 403);
    const requestId = c.req.param('id');
    const storedRequest = await redis.hGet(COURSE_REQUESTS_HASH_KEY, requestId);
    if (!storedRequest) return c.json<ApiErrorResponse>({ status: 'error', message: 'Course request not found.' }, 404);

    const request = JSON.parse(storedRequest) as CourseRequest;
    if (request.status !== 'pending') return c.json<ApiErrorResponse>({ status: 'error', message: 'This request has already been reviewed.' }, 409);
    if (!COURSE_CODE_PATTERN.test(request.code)) return c.json<ApiErrorResponse>({ status: 'error', message: 'The stored course code is invalid.' }, 400);

    const existing = await redis.hGet(COURSES_HASH_KEY, request.code);
    if (existing) return c.json<ApiErrorResponse>({ status: 'error', message: 'This course code already exists.' }, 409);

    const now = Date.now();
    const course: CourseRecord = {
      id: request.code,
      code: request.code,
      createdAt: now,
      createdByUsername: request.submittedByUsername,
      approvedAt: now,
      approvedByUsername: moderator.username,
    };
    const updated: CourseRequest = { ...request, status: 'approved', reviewedAt: now, reviewedByUsername: moderator.username };
    await redis.hSet(COURSES_HASH_KEY, { [request.code]: JSON.stringify(course) });
    await redis.hSet(COURSE_REQUESTS_HASH_KEY, { [requestId]: JSON.stringify(updated) });
    return c.json<ModerationActionResponse>({ status: 'success', message: `${request.code} has been added to the course directory.` });
  } catch (error) {
    console.error('Course approval error:', error);
    return c.json<ApiErrorResponse>({ status: 'error', message: 'Unable to approve this course request.' }, 500);
  }
});

api.post('/mod/course-requests/:id/reject', async (c) => {
  try {
    const moderator = await getModerator();
    if (!moderator) return c.json<ApiErrorResponse>({ status: 'error', message: 'Moderator permissions are required.' }, 403);
    const requestId = c.req.param('id');
    const storedRequest = await redis.hGet(COURSE_REQUESTS_HASH_KEY, requestId);
    if (!storedRequest) return c.json<ApiErrorResponse>({ status: 'error', message: 'Course request not found.' }, 404);
    const request = JSON.parse(storedRequest) as CourseRequest;
    if (request.status !== 'pending') return c.json<ApiErrorResponse>({ status: 'error', message: 'This request has already been reviewed.' }, 409);

    const body = await c.req.json<{ reason?: unknown; customReason?: unknown }>();
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const customReason = typeof body.customReason === 'string' ? body.customReason.trim() : '';
    if (!REJECTION_REASONS.includes(reason)) return c.json<ApiErrorResponse>({ status: 'error', message: 'Select a valid rejection reason.' }, 400);
    if (reason === 'Custom' && !customReason) return c.json<ApiErrorResponse>({ status: 'error', message: 'Enter a custom rejection reason.' }, 400);
    if (customReason.length > 300) return c.json<ApiErrorResponse>({ status: 'error', message: 'The custom reason cannot exceed 300 characters.' }, 400);

    const updated: CourseRequest = {
      ...request,
      status: 'rejected',
      rejectionReason: reason,
      customReason: reason === 'Custom' ? customReason : undefined,
      reviewedAt: Date.now(),
      reviewedByUsername: moderator.username,
    };
    await redis.hSet(COURSE_REQUESTS_HASH_KEY, { [requestId]: JSON.stringify(updated) });
    return c.json<ModerationActionResponse>({ status: 'success', message: `${request.code} request rejected.` });
  } catch (error) {
    console.error('Course rejection error:', error);
    return c.json<ApiErrorResponse>({ status: 'error', message: 'Unable to reject this course request.' }, 500);
  }
});

api.get('/mod/status', async (c) => {
  const user = await getModerator();

  return c.json<ModeratorStatusResponse>({
    status: 'success',
    isModerator: Boolean(user),
  });
});

api.get('/mod/requests', async (c) => {
  try {
    const moderator = await getModerator();

    if (!moderator) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Moderator permissions are required.',
        },
        403
      );
    }

    const storedRequests = await redis.hGetAll(REQUESTS_HASH_KEY);

    const requests = Object.values(storedRequests)
      .flatMap((value) => {
        try {
          const request = JSON.parse(value) as FacultyRequest;

          if (
            !request ||
            typeof request.id !== 'string' ||
            typeof request.firstName !== 'string' ||
            typeof request.lastName !== 'string' ||
            request.status !== 'pending'
          ) {
            return [];
          }

          return [request];
        } catch {
          return [];
        }
      })
      .sort((a, b) => a.createdAt - b.createdAt);

    return c.json<ModeratorRequestsResponse>({
      status: 'success',
      requests,
      total: requests.length,
    });
  } catch (error) {
    console.error('Moderator request list error:', error);

    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Unable to load pending requests.',
      },
      500
    );
  }
});

api.post('/mod/requests/:id/approve', async (c) => {
  try {
    const moderator = await getModerator();

    if (!moderator) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: 'Moderator permissions are required.' },
        403
      );
    }

    const requestId = c.req.param('id');

    if (!requestId || requestId.length > 100) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: 'Invalid request ID.' },
        400
      );
    }

    const body = await c.req.json<{
      firstName?: unknown;
      middleName?: unknown;
      lastName?: unknown;
      school?: unknown;
    }>();

    const firstName =
      typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const middleName =
      typeof body.middleName === 'string' ? body.middleName.trim() : '';
    const lastName =
      typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const school =
      typeof body.school === 'string' ? body.school.trim().toUpperCase() : '';

    if (!firstName || !lastName) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: 'First name and last name are required.' },
        400
      );
    }

    if (
      firstName.length > 60 ||
      middleName.length > 60 ||
      lastName.length > 60
    ) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: 'Names cannot exceed 60 characters.' },
        400
      );
    }

    if (!VALID_SCHOOLS.includes(school)) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: 'Please select a valid school.' },
        400
      );
    }

    const storedRequest = await redis.hGet(REQUESTS_HASH_KEY, requestId);

    if (!storedRequest) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: 'Faculty request not found.' },
        404
      );
    }

    const request = JSON.parse(storedRequest) as FacultyRequest;

    if (request.status !== 'pending') {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: 'This request has already been reviewed.' },
        409
      );
    }

    const approvedCoursesForApproval = await redis.hGetAll(COURSES_HASH_KEY);

    const approvedRecord: FacultyRecord = {
      id: request.id,
      firstName,
      middleName,
      lastName,
      school,
      courseCodes: (request.courseCodes ?? []).filter((code) => Boolean(approvedCoursesForApproval[code])),
      createdAt: Date.now(),
    };

    const facultyRecords = await redis.hGetAll(FACULTY_HASH_KEY);
    const duplicate = Object.values(facultyRecords).some((value) => {
      try {
        const existing = JSON.parse(value) as FacultyRecord;
        return (
          existing.school === school &&
          normalizeName(getFullName(existing)) ===
            normalizeName(getFullName(approvedRecord))
        );
      } catch {
        return false;
      }
    });

    if (duplicate) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message:
            'A faculty member with these corrected details already exists in this school.',
        },
        409
      );
    }

    const now = Date.now();
    const updatedRequest: FacultyRequest = {
      ...request,
      firstName,
      middleName,
      lastName,
      school,
      status: 'approved',
      reviewedAt: now,
      reviewedByUsername: moderator.username,
    };

    await redis.hSet(FACULTY_HASH_KEY, {
      [approvedRecord.id]: JSON.stringify(approvedRecord),
    });

    await redis.hSet(REQUESTS_HASH_KEY, {
      [requestId]: JSON.stringify(updatedRequest),
    });

    return c.json<ModerationActionResponse>({
      status: 'success',
      message: `${getFullName(approvedRecord)} has been added to the faculty directory.`,
    });
  } catch (error) {
    console.error('Faculty approval error:', error);

    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'Unable to approve this request.' },
      500
    );
  }
});

api.post('/mod/requests/:id/reject', async (c) => {
  try {
    const moderator = await getModerator();

    if (!moderator) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Moderator permissions are required.',
        },
        403
      );
    }

    const requestId = c.req.param('id');

    if (!requestId || requestId.length > 100) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Invalid request ID.',
        },
        400
      );
    }

    const body = await c.req.json<{
      reason?: unknown;
      customReason?: unknown;
    }>();

    const reason =
      typeof body.reason === 'string' ? body.reason.trim() : '';
    const customReason =
      typeof body.customReason === 'string'
        ? body.customReason.trim()
        : '';

    if (!REJECTION_REASONS.includes(reason)) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Select a valid rejection reason.',
        },
        400
      );
    }

    if (reason === 'Custom' && !customReason) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Please enter a custom rejection reason.',
        },
        400
      );
    }

    if (customReason.length > 300) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'The custom reason cannot exceed 300 characters.',
        },
        400
      );
    }

    const storedRequest = await redis.hGet(REQUESTS_HASH_KEY, requestId);

    if (!storedRequest) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Faculty request not found.',
        },
        404
      );
    }

    const request = JSON.parse(storedRequest) as FacultyRequest;

    if (request.status !== 'pending') {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'This request has already been reviewed.',
        },
        409
      );
    }

    const updatedRequest: FacultyRequest = {
      ...request,
      status: 'rejected',
      rejectionReason: reason,
      customReason: reason === 'Custom' ? customReason : undefined,
      reviewedAt: Date.now(),
      reviewedByUsername: moderator.username,
    };

    await redis.hSet(REQUESTS_HASH_KEY, {
      [requestId]: JSON.stringify(updatedRequest),
    });

    return c.json<ModerationActionResponse>({
      status: 'success',
      message: 'Faculty request rejected.',
    });
  } catch (error) {
    console.error('Faculty rejection error:', error);

    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Unable to reject this request.',
      },
      500
    );
  }
});


const RATINGS_KEY_PREFIX = 'faculty:ratings:';
const MIN_ACCOUNT_AGE_DAYS = 30;
const MIN_TOTAL_KARMA = 15;
const RATING_FIELDS = [
  'teaching',
  'internalMarking',
  'examEvaluation',
  'overallRecommendation',
  'classAverage',
] as const;

type RatingValues = {
  teaching: number;
  internalMarking: number;
  examEvaluation: number;
  overallRecommendation: number;
  classAverage: number;
};

const getRatingEligibility = async () => {
  const user = await reddit.getCurrentUser();

  if (!user) {
    return {
      user: undefined,
      loggedIn: false,
      eligible: false,
      accountAgeDays: null,
      totalKarma: null,
      reason: 'Log in to Reddit to submit a rating.',
    };
  }

  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / 86_400_000
  );
  const totalKarma = user.linkKarma + user.commentKarma;

  if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
    return {
      user,
      loggedIn: true,
      eligible: false,
      accountAgeDays,
      totalKarma,
      reason: 'Your Reddit account must be at least 30 days old.',
    };
  }

  if (totalKarma < MIN_TOTAL_KARMA) {
    return {
      user,
      loggedIn: true,
      eligible: false,
      accountAgeDays,
      totalKarma,
      reason: 'You need at least 15 total Reddit karma to submit a rating.',
    };
  }

  return {
    user,
    loggedIn: true,
    eligible: true,
    accountAgeDays,
    totalKarma,
    reason: '',
  };
};

type StoredRatingValues = Omit<RatingValues, 'classAverage'> & {
  classAverage?: number;
};

const isValidStoredRating = (value: unknown): value is StoredRatingValues => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const requiredFields = [
    'teaching',
    'internalMarking',
    'examEvaluation',
    'overallRecommendation',
  ] as const;
  const requiredValid = requiredFields.every((field) => {
    const rating = record[field];
    return typeof rating === 'number' && Number.isInteger(rating) && rating >= 0 && rating <= 100;
  });
  const classAverageValid =
    record.classAverage === undefined ||
    (typeof record.classAverage === 'number' &&
      Number.isInteger(record.classAverage) &&
      record.classAverage >= 0 &&
      record.classAverage <= 100);
  return requiredValid && classAverageValid;
};

const isValidRatingValues = (value: unknown): value is RatingValues =>
  isValidStoredRating(value) && typeof value.classAverage === 'number';

api.get('/faculty/:id/ratings', async (c) => {
  try {
    const facultyId = c.req.param('id');
    if (!facultyId || facultyId.length > 100) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: 'Invalid faculty ID.' },
        400
      );
    }

    const [storedRatings, eligibility] = await Promise.all([
      redis.hGetAll(`${RATINGS_KEY_PREFIX}${facultyId}`),
      getRatingEligibility(),
    ]);

    const ratings = Object.values(storedRatings).flatMap((value) => {
      try {
        const parsed = JSON.parse(value) as unknown;
        return isValidStoredRating(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });

    const count = ratings.length;
    const averages: RatingValues = {
      teaching: 0,
      internalMarking: 0,
      examEvaluation: 0,
      overallRecommendation: 0,
      classAverage: 0,
    };

    if (count > 0) {
      for (const field of RATING_FIELDS) {
        const values = ratings
          .map((rating) => rating[field])
          .filter((value): value is number => typeof value === 'number');
        if (values.length > 0) {
          averages[field] = Math.round(
            values.reduce((sum, value) => sum + value, 0) / values.length
          );
        }
      }
    }

    const existingRating = eligibility.user
      ? await redis.hGet(
          `${RATINGS_KEY_PREFIX}${facultyId}`,
          eligibility.user.id
        )
      : undefined;

    return c.json({
      status: 'success' as const,
      count,
      averages,
      eligibility: {
        loggedIn: eligibility.loggedIn,
        eligible: eligibility.eligible,
        accountAgeDays: eligibility.accountAgeDays,
        totalKarma: eligibility.totalKarma,
        hasRated: Boolean(existingRating),
        reason: eligibility.reason,
      },
    });
  } catch (error) {
    console.error('Faculty rating summary error:', error);
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'Unable to load faculty ratings.' },
      500
    );
  }
});

api.post('/faculty/:id/ratings', async (c) => {
  try {
    const facultyId = c.req.param('id');
    if (!facultyId || facultyId.length > 100) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: 'Invalid faculty ID.' },
        400
      );
    }

    const facultyRecord = await redis.hGet(FACULTY_HASH_KEY, facultyId);
    if (!facultyRecord) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: 'Faculty member not found.' },
        404
      );
    }

    const eligibility = await getRatingEligibility();
    if (!eligibility.user) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: eligibility.reason },
        401
      );
    }
    if (!eligibility.eligible) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: eligibility.reason },
        403
      );
    }

    const body = await c.req.json<unknown>();
    if (!isValidRatingValues(body)) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'All five ratings must be whole numbers from 0 to 100.',
        },
        400
      );
    }

    const saved = await redis.hSetNX(
      `${RATINGS_KEY_PREFIX}${facultyId}`,
      eligibility.user.id,
      JSON.stringify({ ...body, createdAt: Date.now() })
    );

    if (!saved) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'You have already submitted a rating for this faculty member.',
        },
        409
      );
    }

    return c.json({
      status: 'success' as const,
      message: 'Your rating has been submitted successfully.',
    });
  } catch (error) {
    console.error('Faculty rating submission error:', error);
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'Unable to submit your rating.' },
      500
    );
  }
});

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId,
      count: count ? parseInt(count, 10) : 0,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);

    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Initialization failed',
      },
      500
    );
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;

  if (!postId) {
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', 1);

  return c.json<IncrementResponse>({
    count,
    postId,
    type: 'increment',
  });
});

api.post('/decrement', async (c) => {
  const { postId } = context;

  if (!postId) {
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', -1);

  return c.json<DecrementResponse>({
    count,
    postId,
    type: 'decrement',
  });
});