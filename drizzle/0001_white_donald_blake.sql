CREATE TABLE `sensitive_views` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`target_id` text NOT NULL,
	`viewed_at` text NOT NULL
);
