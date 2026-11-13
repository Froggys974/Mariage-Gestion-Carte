import type { APIRoute } from 'astro';
import { adminRoute, csvResponse } from '~/features/admin/admin.http';
import { exportInvitationsCsv } from '~/features/admin/invitations.service';
import { getDb } from '~/lib/db/client';
import { getEnv } from '~/lib/env';

export const GET: APIRoute = () =>
  adminRoute('export', async () =>
    csvResponse(await exportInvitationsCsv(getDb(), getEnv().PUBLIC_URL), 'invitations.csv'),
  );
