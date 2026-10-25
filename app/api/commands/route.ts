import { executeCommand } from '@/lib/repository';
import { getBootstrap } from '@/lib/packet';
import { requestContext, readBody, failure, json, runtimeConfig, HttpError } from '@/lib/server';
import { z } from 'zod';
const commandSchema = z.object({
  type: z.enum(['accept_adjustment', 'undo_adjustment', 'add_note', 'resolve_note', 'sign_off', 'client_approve', 'freeze', 'draft_question', 'save_investigation']),
  issueId: z.string().optional(), adjustmentId: z.string().optional(), reason: z.string().optional(),
  body: z.string().optional(), noteId: z.string().optional(), text: z.string().optional(),
  result: z.string().optional(), level: z.enum(['reviewer', 'partner', 'client']).optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
}).strict();
export async function POST(request: Request) {
  try {
    const { ownerId, actor } = await requestContext(true);
    const { expectedRevision, command } = await readBody(request);
    const parsed = commandSchema.safeParse(command);
    if (!parsed.success || typeof expectedRevision !== 'number') throw new HttpError(400, 'Provide a valid workpaper action and expected revision.');
    const workspace = await executeCommand(ownerId, actor.id, expectedRevision, parsed.data);
    return json({ ...getBootstrap(actor.id, workspace), config: runtimeConfig() });
  } catch (e) { return failure(e); }
}
