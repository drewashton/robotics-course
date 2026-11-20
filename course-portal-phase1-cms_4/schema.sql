CREATE TABLE IF NOT EXISTS instructors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Streams are fixed - mentors can edit their info (name, description,
-- overview, schedule) but cannot add or remove them. site = 'course' for the
-- learning platform's three streams, 'internal' for the internal portal's
-- sections.
CREATE TABLE IF NOT EXISTS streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  objectives_html TEXT NOT NULL DEFAULT '',
  schedule_html TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  site TEXT NOT NULL DEFAULT 'course'
);

-- The internal portal's landing page layout (heading text, buttons, boxes
-- and the sections in each box) is kept here as one JSON row. The Admin
-- Panel also creates this table on first save, so it is optional to run.
CREATE TABLE IF NOT EXISTS portal_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- A unit is a folder inside a stream. Purely a container now - its
-- Lessons, Assignments, and Resources are each their own collection below.
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  unit_label TEXT NOT NULL,
  title TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Lessons, Assignments, and Resources are all the same shape: a titled
-- entry with its own content, inside a unit. Kept as three tables (rather
-- than one generic one) since each is queried/managed independently.
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

-- Up to 3 per stream (enforced in the admin API, not here). Shown next to
-- the stream's title/description on the student portal as "who to ask for
-- help" contacts.
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
  ('exploration', 'Exploration Period', 'The first couple of months in the Prep Team. Try a bit of everything in build, programming, and business, then choose the stream you want to follow.', 0),
  ('business', 'Business Stream', 'Students will learn how a FIRST team operates as organizations. Students will develop skills in marketing, fundraising, finance, leadership, communications, project management, sponsorship, event planning, and professional practices. Students will complete projects and assignments that prepare them to take on business positions on the Penticton Robotics FRC team.', 1),
  ('build', 'Build Stream', '[Course Description Placeholder]', 2),
  ('programming', 'Programming Stream', '[Course Description Placeholder]', 3);

-- Seed the existing Business Stream units as folders, each with one
-- starter lesson carrying its old title.
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

-- Internal portal (internal.pentictonrobotics.ca): sections, groups, starter pages
-- Internal portal sections, groups, and starter pages.
INSERT OR IGNORE INTO streams (stream_key, name, description, sort_order, site) VALUES ('prep-team', 'Prep Team', 'Everything for Prep Team students and mentors: onboarding, the learning portal, Google Classroom, the weekly plan, course credit, and how to move up to the Competition Team.', 10, 'internal');
INSERT OR IGNORE INTO streams (stream_key, name, description, sort_order, site) VALUES ('comp-team', 'Competition Team', 'Everything for Competition Team students: onboarding, platforms, course credit and daily marks, and the team org chart. Role handbooks sit alongside this section.', 11, 'internal');
INSERT OR IGNORE INTO streams (stream_key, name, description, sort_order, site) VALUES ('roles', 'Role Handbooks', 'A handbook and a resources library for every role on the team. Pick a role to find its training, reports, job description, and duties.', 12, 'internal');
INSERT OR IGNORE INTO streams (stream_key, name, description, sort_order, site) VALUES ('parents', 'Parent Volunteer Handbook', 'Everything parent volunteers need to support the team: training, what is expected of you, resources, and who to contact.', 13, 'internal');
INSERT OR IGNORE INTO streams (stream_key, name, description, sort_order, site) VALUES ('mentors', 'Mentor Handbook', 'Training, expectations, and resources for mentors working with Penticton Robotics students.', 14, 'internal');
INSERT OR IGNORE INTO streams (stream_key, name, description, sort_order, site) VALUES ('how-it-runs', 'How It Runs', 'How the two teams fit together, and the policies that apply to everyone.', 15, 'internal');
INSERT OR IGNORE INTO streams (stream_key, name, description, sort_order, site) VALUES ('career', 'Resume and Career', 'Certifications, FIRST scholarships, and Penticton scholarships to help students build their resumes and plan what comes after high school.', 16, 'internal');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Onboarding', 1, 1 FROM streams WHERE stream_key = 'prep-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Onboarding');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Learning Portal', 2, 1 FROM streams WHERE stream_key = 'prep-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Learning Portal');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Learning Portal', '<p>The Prep Team learning portal holds the lessons, assignments, and resources for the Build, Programming, and Business streams.</p><p><a href="/prepteam" target="_blank" rel="noopener">Open the learning portal</a></p>', 1, 1 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'prep-team' AND u.title = 'Learning Portal' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Learning Portal');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Google Classroom', 3, 1 FROM streams WHERE stream_key = 'prep-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Google Classroom');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Standardized Plan', 4, 1 FROM streams WHERE stream_key = 'prep-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Standardized Plan');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Prep Team Standard Plan', '<p><em>Draft template. Fill in each block, then publish.</em></p><ul><li>Weeks 1 to 4: ____ lesson. Assessment: ____ (weight: ____%)</li><li>Weeks 5 to 8: ____ lesson. Assessment: ____ (weight: ____%)</li><li>Weeks 9 to 12: ____ lesson. Assessment: ____ (weight: ____%)</li><li>Weeks 13 to 16: ____ lesson. Assessment: ____ (weight: ____%)</li></ul>', 0, 1 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'prep-team' AND u.title = 'Standardized Plan' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Prep Team Standard Plan');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Course Credit and Grading', 5, 1 FROM streams WHERE stream_key = 'prep-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Course Credit and Grading');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Course Credit', '<p>Both the Prep Team and the Competition Team are eligible for Princess Margaret Secondary School course credit. Students can choose whether they would like to officially register and receive graduation credits and a mark on their transcript, or participate without receiving credit. The learning experience is exactly the same either way. The decision to earn credits is entirely up to the student.</p><p>For students wanting a grade and credits, the accredited robotics course is open to students across School District 67. Students attending Summerland Secondary School or Penticton Secondary School are welcome to cross enrol at Princess Margaret.</p>', 1, 1 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'prep-team' AND u.title = 'Course Credit and Grading' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Course Credit');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Prep Team Grading', '<p><em>Draft. Review and edit before publishing.</em></p><p>Prep Team students are marked on the assignments in their stream. The same criteria are used for every student. The Standardized Plan shows what each assignment is worth.</p><h3>How assignments are marked</h3><ul><li>____</li><li>____</li><li>____</li></ul>', 0, 2 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'prep-team' AND u.title = 'Course Credit and Grading' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Prep Team Grading');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Org Chart', 6, 1 FROM streams WHERE stream_key = 'prep-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Org Chart');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Prep Team Org Chart', '', 0, 1 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'prep-team' AND u.title = 'Org Chart' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Prep Team Org Chart');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Transfer to Competition Team', 7, 1 FROM streams WHERE stream_key = 'prep-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Transfer to Competition Team');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'How to Transfer', '<p>As students progress through the curriculum, they have opportunities to demonstrate that they are ready for the next step. Once a student has shown they have the basic skills, commitment, confidence, and mindset needed to move to the Competition Team, they can interview with the team lead and a mentor.</p><p>Students do not need to complete the entire curriculum before moving up. For some students, this could happen within their first few days. For others, it may take several weeks or months.</p>', 1, 1 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'prep-team' AND u.title = 'Transfer to Competition Team' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'How to Transfer');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Onboarding', 1, 1 FROM streams WHERE stream_key = 'comp-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Onboarding');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Platforms', 2, 1 FROM streams WHERE stream_key = 'comp-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Platforms');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Course Credit and Grading', 3, 1 FROM streams WHERE stream_key = 'comp-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Course Credit and Grading');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Course Credit', '<p>Both the Prep Team and the Competition Team are eligible for Princess Margaret Secondary School course credit. Students can choose whether they would like to officially register and receive graduation credits and a mark on their transcript, or participate without receiving credit. The learning experience is exactly the same either way. The decision to earn credits is entirely up to the student.</p><p>For students wanting a grade and credits, the accredited robotics course is open to students across School District 67. Students attending Summerland Secondary School or Penticton Secondary School are welcome to cross enrol at Princess Margaret.</p>', 1, 1 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'comp-team' AND u.title = 'Course Credit and Grading' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Course Credit');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Daily Reflection and Progress Log', '<p>Competition Team students fill in the <strong>Daily Robotics Team Reflection</strong> at the end of each meeting. Your mentors read each one and give the day''s mark after class. That mark feeds the team''s marks sheet and the leaderboard.</p><p><br></p><p><a href="/reflection">Open the Daily Reflection form</a></p><p><br></p><p>The form asks:</p><ol><li>What did you work on today?</li><li>How productive were you today?</li><li>What mark out of 100 do you believe you deserve for today''s work? (Your own estimate. The mark you receive comes from your mentors.)</li><li>Why do you believe you deserve this mark?</li><li>What is one thing you want to accomplish next time?</li></ol><p><br></p><p>The daily reflections also serve as each Competition Team student''s progress log. Prep Team students are assessed through their stream assignments.</p>', 1, 2 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'comp-team' AND u.title = 'Course Credit and Grading' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Daily Reflection and Progress Log');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Bonus Points', '<p>Students can earn bonus points on top of their daily marks:</p><ul><li><strong>10 points</strong> for every hour of robotics work done outside of class</li><li><strong>10 points</strong> for every $100 raised</li><li><strong>5 points</strong> each time a student gets a shout out in #appreciation</li></ul><p>Bonus points are recorded in the team''s marks sheet.</p>', 1, 3 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'comp-team' AND u.title = 'Course Credit and Grading' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Bonus Points');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Grading Rubric', '<p><em>Draft. Review and edit before publishing.</em></p><p>The same four criteria are used for every student, every day. They match the questions in the Daily Robotics Team Reflection.</p><h3>Effort</h3><ul><li>90 to 100: ____</li><li>75 to 89: ____</li><li>60 to 74: ____</li><li>Below 60: ____</li></ul><h3>Productivity</h3><ul><li>90 to 100: ____</li><li>75 to 89: ____</li><li>60 to 74: ____</li><li>Below 60: ____</li></ul><h3>Teamwork</h3><ul><li>90 to 100: ____</li><li>75 to 89: ____</li><li>60 to 74: ____</li><li>Below 60: ____</li></ul><h3>Contribution</h3><ul><li>90 to 100: ____</li><li>75 to 89: ____</li><li>60 to 74: ____</li><li>Below 60: ____</li></ul>', 0, 4 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'comp-team' AND u.title = 'Course Credit and Grading' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Grading Rubric');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Org Chart', 4, 1 FROM streams WHERE stream_key = 'comp-team' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Org Chart');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Competition Team Org Chart', '', 0, 1 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'comp-team' AND u.title = 'Org Chart' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Competition Team Org Chart');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Training', 1, 1 FROM streams WHERE stream_key = 'parents' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Training');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Expectations', 2, 1 FROM streams WHERE stream_key = 'parents' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Expectations');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Resources', 3, 1 FROM streams WHERE stream_key = 'parents' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Resources');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Contacts', 4, 1 FROM streams WHERE stream_key = 'parents' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Contacts');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Training', 1, 1 FROM streams WHERE stream_key = 'mentors' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Training');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Expectations', 2, 1 FROM streams WHERE stream_key = 'mentors' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Expectations');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Resources', 3, 1 FROM streams WHERE stream_key = 'mentors' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Resources');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Prep Team and Competition Team', 1, 1 FROM streams WHERE stream_key = 'how-it-runs' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Prep Team and Competition Team');
INSERT INTO lessons (unit_id, title, content_html, published, sort_order) SELECT u.id, 'Prep Team and Competition Team', '<p>Penticton Robotics is divided into two cohorts: the Prep Team and the Competition Team. Each cohort meets on different days.</p><h3>Prep Team</h3><p>The Prep Team is where students complete the learning pathway and build the foundational knowledge and skills they need. Students choose one of three streams: build, programming, or business. Every student begins here, and the Prep Team is the required starting point for joining the Competition Team.</p><h3>Competition Team</h3><p>The Competition Team is where students apply and continue developing those skills in a less structured, more demanding, student-led environment.</p><p>Along with developing foundational knowledge and skills, students build qualities that are essential on a less structured, student-led team, including initiative, reliability, and teamwork.</p>', 1, 1 FROM units u JOIN streams s ON s.id = u.stream_id WHERE s.stream_key = 'how-it-runs' AND u.title = 'Prep Team and Competition Team' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.unit_id = u.id AND l.title = 'Prep Team and Competition Team');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Policies', 2, 1 FROM streams WHERE stream_key = 'how-it-runs' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Policies');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Certifications', 1, 1 FROM streams WHERE stream_key = 'career' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Certifications');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'FIRST Scholarships', 2, 1 FROM streams WHERE stream_key = 'career' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'FIRST Scholarships');
INSERT INTO units (stream_id, unit_label, title, sort_order, published) SELECT id, '', 'Penticton Scholarships', 3, 1 FROM streams WHERE stream_key = 'career' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.stream_id = streams.id AND u.title = 'Penticton Scholarships');
