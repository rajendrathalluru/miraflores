import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Each owner's demo workspace is isolated. A single CAS update commits the full
// working revision, approval invalidations and audit history atomically.
export const workspaces = sqliteTable('workspaces', {
  ownerId: text('owner_id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  objectKey: text('object_key').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  issueId: text('issue_id'),
  createdAt: text('created_at').notNull(),
});

export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  actorId: text('actor_id').notNull(),
  inputRevision: integer('input_revision').notNull(),
  prompt: text('prompt').notNull(),
  mode: text('mode').notNull(),
  result: text('result').notNull(),
  createdAt: text('created_at').notNull(),
});

export const sensitiveViews = sqliteTable('sensitive_views', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  actorId: text('actor_id').notNull(),
  targetId: text('target_id').notNull(),
  viewedAt: text('viewed_at').notNull(),
});

export const identifierCorrections = sqliteTable('identifier_corrections', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  actorId: text('actor_id').notNull(),
  ref: text('ref').notNull(),
  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),
  tag: text('tag').notNull(),
  createdAt: text('created_at').notNull(),
});
