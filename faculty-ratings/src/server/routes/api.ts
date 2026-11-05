
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
} from '../../shared/api';

export const api = new Hono();

const FACULTY_HASH_KEY = 'faculty:records';
const REQUESTS_HASH_KEY = 'faculty:requests';

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

    const faculty: FacultyRecord[] = Object.entries(storedRecords)
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
      .sort((a, b) =>
        getFullName(a).localeCompare(getFullName(b))
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
              message: 'A pending request already exists for this faculty member.',
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
