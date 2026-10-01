import type { SqlPreset } from './types';

export const mysqlAuth: SqlPreset = {
  id: 'mysql-auth',
  label: 'MySQL Authentication & Sessions',
  dialect: 'mysql',
  description: 'Accounts, sessions and password resets with backticks, ENUM and AUTO_INCREMENT.',
  sql: `-- MySQL 8 authentication schema
CREATE TABLE IF NOT EXISTS \`accounts\` (
  \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`uuid\` CHAR(36) NOT NULL DEFAULT (UUID()),
  \`email\` VARCHAR(191) NOT NULL,
  \`username\` VARCHAR(50) NOT NULL,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`role\` ENUM('user', 'moderator', 'admin') NOT NULL DEFAULT 'user',
  \`email_verified\` TINYINT(1) NOT NULL DEFAULT 0,
  \`failed_login_attempts\` INT NOT NULL DEFAULT 0,
  \`last_login_at\` DATETIME NULL,
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`accounts_email_unique\` (\`email\`),
  UNIQUE KEY \`accounts_username_unique\` (\`username\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registered user accounts';

CREATE TABLE \`sessions\` (
  \`id\` VARCHAR(128) NOT NULL,
  \`account_id\` BIGINT UNSIGNED NOT NULL,
  \`ip_address\` VARCHAR(45) DEFAULT NULL,
  \`user_agent\` TEXT,
  \`payload\` JSON NOT NULL,
  \`expires_at\` DATETIME NOT NULL,
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`sessions_account_id_index\` (\`account_id\`),
  CONSTRAINT \`sessions_account_fk\` FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`password_resets\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  \`account_id\` BIGINT UNSIGNED NOT NULL,
  \`token_hash\` CHAR(64) NOT NULL COMMENT 'SHA-256 of the emailed token',
  \`used\` BOOLEAN NOT NULL DEFAULT FALSE,
  \`expires_at\` DATETIME NOT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (\`token_hash\`)
) ENGINE=InnoDB;
`,
};
