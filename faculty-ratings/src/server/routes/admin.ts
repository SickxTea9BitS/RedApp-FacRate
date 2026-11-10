import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';

export const admin = new Hono();

const OWNER_REDDIT_ID = '135m5v7osr';
const ADMIN_USERS_KEY = 'admin:users';
const MOD_LOG_KEY = 'logs:moderator';
const ADMIN_LOG_KEY = 'logs:admin';
const SECURITY_LOG_KEY = 'logs:security';
const LOG_WARNING_THRESHOLD = 5000;

type AdminRole = 'owner' | 'admin' | 'none';
type Actor = { id: string; username: string; role: AdminRole };
type LogEntry = {
  id: string;
  actorId: string;
  actorUsername: string;
  action: string;
  timestamp: number;
  details: Record<string, unknown>;
  result: 'success' | 'failure';
};

const normalizeRedditId = (value: string) => value.replace(/^t2_/, '').trim();

const getActor = async (): Promise<Actor | null> => {
  const rawId = context.userId;
  if (!rawId) return null;
  const id = normalizeRedditId(rawId);
  const username = (await reddit.getCurrentUsername()) ?? 'unknown';
  if (id === OWNER_REDDIT_ID) return { id, username, role: 'owner' };
  const stored = await redis.hGet(ADMIN_USERS_KEY, id);
  if (!stored) return { id, username, role: 'none' };
  try {
    const record = JSON.parse(stored) as { username?: string; active?: boolean };
    if (record.active === false) return { id, username, role: 'none' };
    return { id, username: record.username || username, role: 'admin' };
  } catch {
    return { id, username, role: 'none' };
  }
};

const requireAdmin = async () => {
  const actor = await getActor();
  return actor && actor.role !== 'none' ? actor : null;
};

const requireOwner = async () => {
  const actor = await getActor();
  return actor?.role === 'owner' ? actor : null;
};

const writeLog = async (
  key: string,
  actor: Actor,
  action: string,
  details: Record<string, unknown>,
  result: 'success' | 'failure' = 'success'
) => {
  const entry: LogEntry = {
    id: randomUUID(),
    actorId: actor.id,
    actorUsername: actor.username,
    action,
    timestamp: Date.now(),
    details,
    result,
  };
  await redis.zAdd(key, { member: JSON.stringify(entry), score: entry.timestamp });
};

const readAllLogs = async (key: string) => {
  const members = await redis.zRange(key, 0, -1, { by: 'rank', reverse: true });
  return members.flatMap(({ member }) => {
    try { return [JSON.parse(member) as LogEntry]; } catch { return []; }
  });
};

const readLogPage = async (key: string, page: number, pageSize: number) => {
  const total = await redis.zCard(key);
  const start = (page - 1) * pageSize;
  const members = await redis.zRange(key, start, start + pageSize - 1, {
    by: 'rank',
    reverse: true,
  });
  const entries = members.flatMap(({ member }) => {
    try {
      return [JSON.parse(member) as LogEntry];
    } catch {
      return [];
    }
  });
  return { entries, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
};

admin.get('/status', async (c) => {
  const actor = await requireAdmin();
  if (!actor) return c.json({ status: 'success' as const, role: 'none' as const });
  const [moderatorLogCount, adminLogCount] = await Promise.all([
    redis.zCard(MOD_LOG_KEY),
    redis.zCard(ADMIN_LOG_KEY),
  ]);
  return c.json({
    status: 'success' as const,
    role: actor.role,
    canManageAdmins: actor.role === 'owner',
    canExportLogs: actor.role === 'owner',
    canClearLogs: actor.role === 'owner',
    moderatorLogCount,
    adminLogCount,
    logWarningThreshold: LOG_WARNING_THRESHOLD,
    showLogWarning:
      actor.role === 'owner' &&
      (moderatorLogCount >= LOG_WARNING_THRESHOLD ||
        adminLogCount >= LOG_WARNING_THRESHOLD),
  });
});

admin.get('/admins', async (c) => {
  const actor = await requireOwner();
  if (!actor) return c.json({ status: 'error', message: 'Owner access is required.' }, 403);
  const stored = await redis.hGetAll(ADMIN_USERS_KEY);
  const admins = Object.entries(stored).flatMap(([id, value]) => {
    try {
      const record = JSON.parse(value) as { username?: string; addedAt?: number; addedBy?: string; active?: boolean };
      if (record.active === false) return [];
      return [{ id, username: record.username ?? 'unknown', addedAt: record.addedAt ?? 0, addedBy: record.addedBy ?? '' }];
    } catch {
      return [];
    }
  });
  return c.json({ status: 'success' as const, admins });
});

admin.post('/admins/add', async (c) => {
  const actor = await requireOwner();
  if (!actor) return c.json({ status: 'error', message: 'Owner access is required.' }, 403);
  try {
    const body = await c.req.json<{ redditUserId?: unknown; username?: unknown }>();
    const id = typeof body.redditUserId === 'string' ? normalizeRedditId(body.redditUserId) : '';
    const username = typeof body.username === 'string' ? body.username.trim().replace(/^u\//, '') : '';
    if (!/^[a-z0-9]+$/i.test(id) || id.length > 40 || !/^[A-Za-z0-9_-]{2,20}$/.test(username)) {
      return c.json({ status: 'error', message: 'Enter a valid Reddit user ID and username.' }, 400);
    }
    if (id === OWNER_REDDIT_ID) return c.json({ status: 'error', message: 'The owner is already permanently authorized.' }, 409);
    await redis.hSet(ADMIN_USERS_KEY, {
      [id]: JSON.stringify({ username, addedAt: Date.now(), addedBy: actor.id, active: true }),
    });
    await writeLog(ADMIN_LOG_KEY, actor, 'admin.add', { targetUserId: id, targetUsername: username });
    await writeLog(SECURITY_LOG_KEY, actor, 'admin.add', { targetUserId: id, targetUsername: username });
    return c.json({ status: 'success' as const, message: 'Admin added.' });
  } catch {
    await writeLog(ADMIN_LOG_KEY, actor, 'admin.add', {}, 'failure');
    return c.json({ status: 'error', message: 'Unable to add admin.' }, 500);
  }
});

admin.post('/admins/remove', async (c) => {
  const actor = await requireOwner();
  if (!actor) return c.json({ status: 'error', message: 'Owner access is required.' }, 403);
  try {
    const body = await c.req.json<{ redditUserId?: unknown }>();
    const id = typeof body.redditUserId === 'string' ? normalizeRedditId(body.redditUserId) : '';
    if (!id || id === OWNER_REDDIT_ID) return c.json({ status: 'error', message: 'The owner cannot be removed.' }, 400);
    const existing = await redis.hGet(ADMIN_USERS_KEY, id);
    if (!existing) return c.json({ status: 'error', message: 'Admin not found.' }, 404);
    await redis.hDel(ADMIN_USERS_KEY, [id]);
    await writeLog(ADMIN_LOG_KEY, actor, 'admin.remove', { targetUserId: id });
    await writeLog(SECURITY_LOG_KEY, actor, 'admin.remove', { targetUserId: id });
    return c.json({ status: 'success' as const, message: 'Admin removed.' });
  } catch {
    await writeLog(ADMIN_LOG_KEY, actor, 'admin.remove', {}, 'failure');
    return c.json({ status: 'error', message: 'Unable to remove admin.' }, 500);
  }
});

admin.get('/logs/moderator', async (c) => {
  if (!(await requireAdmin())) return c.json({ status: 'error', message: 'Admin access is required.' }, 403);
  const page = Math.max(1, Math.min(100000, Number(c.req.query('page')) || 1));
  const pageSize = Math.max(10, Math.min(100, Number(c.req.query('pageSize')) || 50));
  return c.json({ status: 'success' as const, ...(await readLogPage(MOD_LOG_KEY, page, pageSize)) });
});

admin.get('/logs/admin', async (c) => {
  if (!(await requireAdmin())) return c.json({ status: 'error', message: 'Admin access is required.' }, 403);
  const page = Math.max(1, Math.min(100000, Number(c.req.query('page')) || 1));
  const pageSize = Math.max(10, Math.min(100, Number(c.req.query('pageSize')) || 50));
  return c.json({ status: 'success' as const, ...(await readLogPage(ADMIN_LOG_KEY, page, pageSize)) });
});

admin.get('/logs/security', async (c) => {
  if (!(await requireOwner())) return c.json({ status: 'error', message: 'Owner access is required.' }, 403);
  const page = Math.max(1, Math.min(100000, Number(c.req.query('page')) || 1));
  const pageSize = Math.max(10, Math.min(100, Number(c.req.query('pageSize')) || 50));
  return c.json({ status: 'success' as const, ...(await readLogPage(SECURITY_LOG_KEY, page, pageSize)) });
});

admin.post('/logs/clear', async (c) => {
  const actor = await requireOwner();
  if (!actor) return c.json({ status: 'error', message: 'Owner access is required.' }, 403);
  const body = await c.req.json<{ confirmation?: unknown }>();
  if (body.confirmation !== 'CONFIRM') {
    return c.json({ status: 'error', message: 'Type CONFIRM to clear logs.' }, 400);
  }
  const [moderatorLogCount, adminLogCount] = await Promise.all([
    redis.zCard(MOD_LOG_KEY),
    redis.zCard(ADMIN_LOG_KEY),
  ]);
  await redis.del(MOD_LOG_KEY, ADMIN_LOG_KEY);
  const details = { moderatorLogCount, adminLogCount, clearedAt: Date.now() };
  await writeLog(SECURITY_LOG_KEY, actor, 'logs.clear', details);
  await writeLog(ADMIN_LOG_KEY, actor, 'logs.clear', details);
  return c.json({ status: 'success' as const, message: 'Moderator and admin logs cleared. The protected security audit log was preserved.' });
});

admin.get('/logs/export', async (c) => {
  const actor = await requireOwner();
  if (!actor) return c.json({ status: 'error', message: 'Owner access is required.' }, 403);
  const [moderator, adminLogs, security] = await Promise.all([
    readAllLogs(MOD_LOG_KEY),
    readAllLogs(ADMIN_LOG_KEY),
    readAllLogs(SECURITY_LOG_KEY),
  ]);
  const payload = JSON.stringify({ exportedAt: Date.now(), moderator, admin: adminLogs, security }, null, 2);
  await writeLog(ADMIN_LOG_KEY, actor, 'logs.export', { bytes: payload.length });
  return new Response(payload, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="faculty-ratings-logs.json"',
    },
  });
});
