-- Safe to run regardless of which schema version your database is
-- currently on. Drops and rebuilds streams/units/lessons/assets fresh —
-- your instructors table (and your login) is untouched.

DROP TABLE IF EXISTS lessons;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS streams;
DROP TABLE IF EXISTS assets;

CREATE TABLE IF NOT EXISTS instructors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The three streams are fixed — instructors can edit their syllabus info
-- (name, description, objectives, schedule) but cannot add or remove streams.
CREATE TABLE IF NOT EXISTS streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  objectives_html TEXT NOT NULL DEFAULT '',
  schedule_html TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- A unit is a folder inside a stream (e.g. "Unit 1: Intro to FIRST").
-- Instructors can freely add, rename, reorder, and delete these. Assignments
-- and Resources belong to the whole unit, not to individual lessons.
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  unit_label TEXT NOT NULL,
  title TEXT NOT NULL,
  assignments_html TEXT NOT NULL DEFAULT '',
  resources_html TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- A lesson is one individual entry inside a unit's Lessons list — just a
-- title and its own content.
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES instructors(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed the three fixed streams
INSERT OR IGNORE INTO streams (stream_key, name, description, sort_order) VALUES
  ('business', 'Business Stream', 'Students will learn how a FIRST team operates as organizations. Students will develop skills in marketing, fundraising, finance, leadership, communications, project management, sponsorship, event planning, and professional practices. Students will complete projects and assignments that prepare them to take on business positions on the Penticton Robotics FRC team.', 1),
  ('build', 'Build Stream', '[Course Description Placeholder]', 2),
  ('programming', 'Programming Stream', '[Course Description Placeholder]', 3);

-- Seed the existing Business Stream units as folders (published so they
-- stay visible), each with one starter lesson carrying its old title.
INSERT OR IGNORE INTO units (stream_id, unit_label, title, sort_order, published)
SELECT id, 'Unit 1', 'Intro to FIRST', 1, 1 FROM streams WHERE stream_key = 'business';
INSERT OR IGNORE INTO units (stream_id, unit_label, title, sort_order, published)
SELECT id, 'Unit 2', 'Professionalism', 2, 1 FROM streams WHERE stream_key = 'business';
INSERT OR IGNORE INTO units (stream_id, unit_label, title, sort_order, published)
SELECT id, 'Unit 3', 'Leadership', 3, 1 FROM streams WHERE stream_key = 'business';
INSERT OR IGNORE INTO units (stream_id, unit_label, title, sort_order, published)
SELECT id, 'Unit 4', 'Marketing', 4, 1 FROM streams WHERE stream_key = 'business';
INSERT OR IGNORE INTO units (stream_id, unit_label, title, sort_order, published)
SELECT id, 'Unit 5', 'Fundraising', 5, 1 FROM streams WHERE stream_key = 'business';
INSERT OR IGNORE INTO units (stream_id, unit_label, title, sort_order, published)
SELECT id, 'Unit 6', 'Finance', 6, 1 FROM streams WHERE stream_key = 'business';
INSERT OR IGNORE INTO units (stream_id, unit_label, title, sort_order, published)
SELECT id, 'Unit 7', 'Project Management', 7, 1 FROM streams WHERE stream_key = 'business';
INSERT OR IGNORE INTO units (stream_id, unit_label, title, sort_order, published)
SELECT id, 'Unit 8', 'Outreach', 8, 1 FROM streams WHERE stream_key = 'business';
INSERT OR IGNORE INTO units (stream_id, unit_label, title, sort_order, published)
SELECT id, 'Unit 10', 'Competition', 9, 1 FROM streams WHERE stream_key = 'business';

INSERT OR IGNORE INTO lessons (unit_id, title, sort_order, published)
SELECT id, title, 1, 1 FROM units WHERE stream_id = (SELECT id FROM streams WHERE stream_key = 'business');
