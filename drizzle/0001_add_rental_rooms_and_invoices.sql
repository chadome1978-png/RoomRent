CREATE TABLE `rental_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`roomId` int NOT NULL,
	`period` varchar(7) NOT NULL,
	`dueDate` varchar(10) NOT NULL,
	`rentAmount` decimal(12,2) NOT NULL,
	`waterPrevious` decimal(12,3) NOT NULL,
	`waterCurrent` decimal(12,3) NOT NULL,
	`waterUnits` decimal(12,3) NOT NULL,
	`waterRate` decimal(12,3) NOT NULL,
	`waterAmount` decimal(12,2) NOT NULL,
	`electricPrevious` decimal(12,3) NOT NULL,
	`electricCurrent` decimal(12,3) NOT NULL,
	`electricUnits` decimal(12,3) NOT NULL,
	`electricRate` decimal(12,3) NOT NULL,
	`electricAmount` decimal(12,2) NOT NULL,
	`extras` json NOT NULL,
	`totalAmount` decimal(12,2) NOT NULL,
	`note` varchar(500) NOT NULL DEFAULT '',
	`status` enum('unpaid','paid') NOT NULL DEFAULT 'unpaid',
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rental_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `rental_invoices_owner_room_period_unique` UNIQUE(`ownerId`,`roomId`,`period`)
);
--> statement-breakpoint
CREATE TABLE `rental_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`roomNumber` varchar(40) NOT NULL,
	`tenantName` varchar(160) NOT NULL,
	`phone` varchar(32) NOT NULL DEFAULT '',
	`rentAmount` decimal(12,2) NOT NULL,
	`waterRate` decimal(12,3) NOT NULL DEFAULT '0',
	`electricRate` decimal(12,3) NOT NULL DEFAULT '0',
	`status` enum('occupied','vacant','archived') NOT NULL DEFAULT 'occupied',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rental_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `rental_rooms_owner_number_unique` UNIQUE(`ownerId`,`roomNumber`)
);
--> statement-breakpoint
ALTER TABLE `rental_invoices` ADD CONSTRAINT `rental_invoices_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rental_invoices` ADD CONSTRAINT `rental_invoices_roomId_rental_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `rental_rooms`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rental_rooms` ADD CONSTRAINT `rental_rooms_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `rental_invoices_owner_period_idx` ON `rental_invoices` (`ownerId`,`period`);--> statement-breakpoint
CREATE INDEX `rental_invoices_room_idx` ON `rental_invoices` (`roomId`);--> statement-breakpoint
CREATE INDEX `rental_rooms_owner_status_idx` ON `rental_rooms` (`ownerId`,`status`);