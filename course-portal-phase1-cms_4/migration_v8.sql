-- Optional. Adds the table that remembers how the internal portal's landing
-- page is laid out (edited from "Portal layout" in the Admin Panel).
-- The Admin Panel creates it automatically the first time you save a layout,
-- so you can skip this file. It is safe to run any number of times.

CREATE TABLE IF NOT EXISTS portal_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
