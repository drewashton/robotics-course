-- Run this ONCE against your existing pr-course-db, IF it currently has
-- units holding assignments_html/resources_html directly (the version from
-- before this update).
--
-- This turns Assignments and Resources into real collections — same shape
-- as Lessons — so each can hold multiple titled entries instead of one
-- shared block of text, and adds the Mentors table.
--
-- Not sure what shape your database is in? A fresh database costs nothing
-- to set up — deleting pr-course-db and recreating it from schema.sql is
-- often simpler than figuring out which migration applies.

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mentors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Carry each unit's existing Assignments/Resources text into one starter
-- entry each, titled generically, so nothing already written is lost.
INSERT INTO assignments (unit_id, title, content_html, published, sort_order)
SELECT id, 'Assignment 1', assignments_html, 1, 1 FROM units WHERE assignments_html IS NOT NULL AND assignments_html != '';

INSERT INTO resources (unit_id, title, content_html, published, sort_order)
SELECT id, 'Resource 1', resources_html, 1, 1 FROM units WHERE resources_html IS NOT NULL AND resources_html != '';

ALTER TABLE units DROP COLUMN assignments_html;
ALTER TABLE units DROP COLUMN resources_html;
