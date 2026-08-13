CREATE TABLE `court_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `court_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `court_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`character` varchar(32) NOT NULL,
	`language` enum('fa','en') NOT NULL DEFAULT 'fa',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `court_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `favorite_characters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`character` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorite_characters_id` PRIMARY KEY(`id`),
	CONSTRAINT `favorite_characters_user_character_unique` UNIQUE(`userId`,`character`)
);
--> statement-breakpoint
CREATE TABLE `fortunes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`question` text NOT NULL,
	`verse` text NOT NULL,
	`interpretation` text NOT NULL,
	`language` enum('fa','en') NOT NULL DEFAULT 'fa',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fortunes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `court_messages_session_created_idx` ON `court_messages` (`sessionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `court_sessions_user_updated_idx` ON `court_sessions` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `fortunes_user_created_idx` ON `fortunes` (`userId`,`createdAt`);