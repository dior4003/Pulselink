-- PulseLink MySQL / MariaDB Schema (v3)
CREATE DATABASE IF NOT EXISTS pulselink CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pulselink;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  google_id VARCHAR(191) NULL UNIQUE,
  username VARCHAR(64) NULL UNIQUE,
  invite_code VARCHAR(32) NULL UNIQUE,
  phone VARCHAR(32) NULL,
  display_name VARCHAR(120) NOT NULL,
  bio VARCHAR(255) NOT NULL DEFAULT 'PulseLink orqali aloqadaman',
  avatar_color VARCHAR(16) NOT NULL DEFAULT '#6366F1',
  avatar_url VARCHAR(512) NULL,
  password_hash VARCHAR(255) NULL,
  role ENUM('user', 'moderator', 'admin') NOT NULL DEFAULT 'user',
  is_banned TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS friendships (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  friend_id CHAR(36) NOT NULL,
  status ENUM('pending', 'accepted', 'blocked') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_friend_pair (user_id, friend_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) PRIMARY KEY,
  chat_id VARCHAR(80) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  receiver_id CHAR(36) NOT NULL,
  text TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'text',
  media_url VARCHAR(512) NULL,
  status ENUM('sent', 'delivered', 'read') NOT NULL DEFAULT 'sent',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_chat (chat_id, created_at),
  INDEX idx_messages_receiver (receiver_id, status),
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS calls (
  id CHAR(36) PRIMARY KEY,
  caller_id CHAR(36) NOT NULL,
  receiver_id CHAR(36) NOT NULL,
  call_type ENUM('audio', 'video') NOT NULL DEFAULT 'audio',
  status ENUM('ringing', 'active', 'ended', 'missed', 'rejected') NOT NULL DEFAULT 'ringing',
  duration_sec INT NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  INDEX idx_calls_users (caller_id, receiver_id, started_at),
  FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) PRIMARY KEY,
  reporter_id CHAR(36) NOT NULL,
  target_user_id CHAR(36) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
