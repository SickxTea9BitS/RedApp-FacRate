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
  ModeratorRequestsResponse,
  ModeratorStatusResponse,
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
      .sort((a, b) => getFullName(a).localeCompare(getFullName(b)));

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

    const approvedRecord: FacultyRecord = {
      id: request.id,
      firstName,
      middleName,
      lastName,
      school,
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