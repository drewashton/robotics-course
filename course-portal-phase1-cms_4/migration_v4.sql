-- Run this ONCE against your existing pr-course-db, IF it currently has the
-- shape from migration_v3.sql: units as pure folders, and lessons each
-- holding their own topics_html/assignments_html/resources_html/published.
--
-- This moves Assignments and Resources up to the unit level (shared across
-- all lessons in that unit), and simplifies each lesson down to a title
-- and one content field.
--
-- Not sure what shape your database is in? Since a fresh database costs
-- nothing to set up, the simplest fix is often to delete pr-course-db and
-- recreate it from schema.sql instead of running this migration.

ALTER TABLE units ADD COLUMN assignments_html TEXT NOT NULL DEFAULT '';
ALTER TABLE units ADD COLUMN resources_html TEXT NOT NULL DEFAULT '';
ALTER TABLE units ADD COLUMN published INTEGER NOT NULL DEFAULT 1;

-- Carry each unit's first lesson's assignments/resources up to the unit
UPDATE units SET
  assignments_html = COALESCE((SELECT assignments_html FROM lessons WHERE lessons.unit_id = units.id ORDER BY sort_order LIMIT 1), ''),
  resources_html = COALESCE((SELECT resources_html FROM lessons WHERE lessons.unit_id = units.id ORDER BY sort_order LIMIT 1), '');

ALTER TABLE lessons ADD COLUMN content_html TEXT NOT NULL DEFAULT '';
UPDATE lessons SET content_html = topics_html;

ALTER TABLE lessons DROP COLUMN topics_html;
ALTER TABLE lessons DROP COLUMN assignments_html;
ALTER TABLE lessons DROP COLUMN resources_html;
