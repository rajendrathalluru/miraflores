import { executeCommand, loadCommandReceipt, loadWorkspace, validateRequestId } from '@/lib/repository';
import { getBootstrap, maskSensitiveText } from '@/lib/packet';
import { conflictDetails } from '@/lib/review-context';
import { requestContext, readBody, failure, json, runtimeConfig, HttpError } from '@/lib/server';
import { z } from 'zod';
const commandSchema = z.object({
  type: z.enum(['accept_adjustment', 'undo_adjustment', 'add_note', 'resolve_note', 'sign_off', 'client_approve', 'freeze', 'draft_question', 'save_investigation', 'workflow']),
  action: z.string().max(80).optional(), payload: z.record(z.unknown()).optional(),
  issueId: z.string().optional(), adjustmentId: z.string().optional(), reason: z.string().optional(),
  body: z.string().optional(), noteId: z.string().optional(), text: z.string().optional(),
  result: z.string().optional(), authority: z.string().optional(), level: z.enum(['reviewer', 'partner', 'client']).optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
}).strict();
export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof requestContext>> | undefined;
  let attemptedRevision = 0;
  try {
    context = await requestContext(true);
    const { ownerId, actor } = context;
    const { expectedRevision, command, requestId, actorId: expectedActorId } = await readBody(request);
    if (expectedActorId !== undefined && typeof expectedActorId !== 'string') throw new HttpError(400, 'Provide a valid expected demo role.');
    if (expectedActorId !== undefined && expectedActorId !== actor.id) throw new HttpError(409, 'The active demo role changed in another session. Return to the original role and review before saving.');
    const parsed = commandSchema.safeParse(command);
    if (!parsed.success || typeof expectedRevision !== 'number') throw new HttpError(400, 'Provide a valid workpaper action and expected revision.');
    attemptedRevision = expectedRevision;
    if (requestId !== undefined && typeof requestId !== 'string') throw new HttpError(400, 'Provide a valid request identity.');
    if (typeof requestId === 'string') validateRequestId(requestId);
    if (['attach_evidence', 'identifier_correction'].includes(parsed.data.action ?? '')) throw new HttpError(400, 'Use the private evidence endpoint for this action.');
    const workspace = await executeCommand(ownerId, actor.id, expectedRevision, parsed.data, undefined, [], { requestId: requestId as string | undefined });
    return json({ ...getBootstrap(actor.id, workspace), config: runtimeConfig(),
      ...(requestId ? { request: { id: requestId, status: 'committed', revision: workspace.revision } } : {}) });
  } catch (error) {
    const response = failure(error);
    if (response.status === 409 && context) {
      const state = await loadWorkspace(context.ownerId);
      return json({ error: maskSensitiveText(error instanceof Error ? error.message : 'The workspace changed.'),
        conflict: conflictDetails(state, attemptedRevision, context.actor.id) }, 409);
    }
    return response;
  }
}

/** A lookup proves only that this actor's exact request identity committed. The
 * POST binding also verifies the original expected revision and canonical body. */
export async function GET(request: Request) {
  try {
    const { ownerId, actor } = await requestContext();
    const query = new URL(request.url).searchParams;
    const requestId = query.get('requestId') || '';
    const expectedActorId = query.get('actorId');
    if (expectedActorId !== null && expectedActorId !== actor.id) throw new HttpError(409, 'The active demo role changed. Return to the original role before checking this request.');
    const receipt = await loadCommandReceipt(ownerId, actor.id, requestId);
    const current = await loadWorkspace(ownerId);
    return json({ requestId, status: receipt ? 'committed' : 'unknown',
      ...(receipt ? { revision: receipt.revision } : {}), workspaceRevision: current.revision });
  } catch (error) { return failure(error); }
}
