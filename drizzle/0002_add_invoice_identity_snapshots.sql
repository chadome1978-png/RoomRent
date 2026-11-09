ALTER TABLE `rental_invoices` ADD `roomNumber` varchar(40) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `rental_invoices` ADD `tenantName` varchar(160) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `rental_invoices` ADD `phone` varchar(32) DEFAULT '' NOT NULL;