CREATE TABLE `identifier_corrections` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `ref` text NOT NULL,
  `ciphertext` text NOT NULL,
  `iv` text NOT NULL,
  `tag` text NOT NULL,
  `created_at` text NOT NULL
);
CREATE INDEX `identifier_corrections_owner_ref` ON `identifier_corrections` (`owner_id`, `ref`, `created_at`);
