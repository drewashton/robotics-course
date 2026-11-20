-- One address for the whole portal: portal.pentictonrobotics.ca
-- Safe to run more than once. Adds the Exploration Period stream to the
-- learning platform (shown first) and points old links at the new addresses.

INSERT INTO streams (stream_key, name, description, sort_order, site)
SELECT 'exploration', 'Exploration Period', 'The first couple of months in the Prep Team. Try a bit of everything in build, programming, and business, then choose the stream you want to follow.', 0, 'course'
WHERE NOT EXISTS (SELECT 1 FROM streams WHERE stream_key = 'exploration');

UPDATE lessons SET content_html = REPLACE(content_html, 'https://course.pentictonrobotics.ca', '/prepteam') WHERE content_html LIKE '%course.pentictonrobotics.ca%';
UPDATE lessons SET content_html = REPLACE(content_html, 'href="#/reflection"', 'href="/reflection"') WHERE content_html LIKE '%#/reflection%';
