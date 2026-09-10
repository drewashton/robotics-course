# Deployment Guide - No Terminal Required

Cloudflare has merged Pages into Workers, so "connect to Git" now builds a
Worker rather than the older Pages Functions system. The files in this
package are set up for that: a single `worker.js` file routes API requests,
and `wrangler.jsonc` tells Cloudflare how to build the project. You don't
need to understand either file - just make sure both end up in your GitHub
repo alongside everything else.

## Your two secret keys

You'll paste these into Cloudflare later. Save them somewhere first:

```
SESSION_SECRET = ayL98VMdKVrY_CWjwEAVms0GOMmi3A7v_nqe89gmsvs
SETUP_TOKEN    = BOr2_l4mf6iUD6PhFKuMN9ZOAwKLx_xv
```

## Phase 1 - Put the code on GitHub

1. Go to github.com and sign up for a free account (skip if you already have one).
2. Click the **+** in the top right → **New repository**. Name it, choose **Private**, click **Create repository**.
3. On the repo page, click **Add file → Upload files**.
4. Unzip the package on your computer, then drag in **everything** inside
   the unzipped folder - including files that start with a dot, like
   `.assetsignore`, and the `worker.js` and `wrangler.jsonc` files at the
   top level. (GitHub's uploader sometimes hides dot-files if you drag a
   folder instead of its contents - if `.assetsignore` doesn't show up
   after uploading, drag that one file in separately.)
5. Click **Commit changes**.

## Phase 2 - Create the Cloudflare project

1. Log into dash.cloudflare.com → **Workers & Pages** → **Create** → connect to your GitHub repo.
2. On the build settings screen: leave **Build command** empty, leave
   **Deploy command** as the default (`npx wrangler deploy`).
3. Click **Deploy**.
4. Wait for it to finish, then open the `.workers.dev` link it gives you.
   The student portal should load and say "No streams available yet" -
   expected, since the database isn't connected yet.

If the deploy fails with an error mentioning a missing entry-point or
assets directory, double check that `worker.js` and `wrangler.jsonc`
actually made it into the GitHub repo (see the note in Phase 1 step 4).

## Phase 3 - Database, file storage, and bindings

1. Sidebar → **Workers & Pages** → **D1 SQL Database** → **Create Database**. Name it `pr-course-db`.
2. Open it → **Console** tab. Open `schema.sql` in a text editor, copy
   everything, paste into the console, run it. This creates the tables and
   loads your existing 9 Business Stream units as folders.

   Already have a database from before this update? Run `migration_v5.sql`
   instead - it turns Assignments/Resources into real multi-entry
   collections (same as Lessons) and adds the Mentors table, without
   losing anything already written. Not sure which schema version you're
   on? Deleting `pr-course-db` and recreating it fresh with `schema.sql`
   is often simpler at this stage.
   ```
   wrangler d1 execute pr-course-db --remote --file=./migration_v5.sql
   ```
3. Sidebar → **R2** → **Create bucket** → name it `pr-course-uploads`.
4. Back in your project → **Settings** → **Bindings** → **Add** → **D1 database binding**. Variable name `DB`, choose `pr-course-db`.
5. **Add** again → **R2 bucket binding**. Variable name `UPLOADS`, choose `pr-course-uploads`.
6. Still in Settings, add two **encrypted** environment variables:
   `SESSION_SECRET` and `SETUP_TOKEN`, pasting the values from the top of
   this guide.
7. Go to **Deployments**, find the latest one, **⋯ → Retry deployment** so the bindings take effect.

## Phase 4 - Create your login and test it

1. Visit `https://YOUR-PROJECT.workers.dev/admin/setup.html`.
2. Enter the `SETUP_TOKEN` value, your name, email, and a password. Click **Create Account**.
3. Go to `/admin` and log in.
4. Create or edit a lesson, publish it, and check it shows up on the main site.

## Phase 5 - Point your real domain over

1. In this project → **Custom domains** → add `course.pentictonrobotics.ca`.
2. Cloudflare will offer to move it from your old project - confirm.
3. Visit `course.pentictonrobotics.ca` after a few minutes to confirm.

Your old project is untouched if you ever need to roll back.

## If something doesn't work

The most common snag is forgetting to retry the deployment after adding
bindings and secrets (Phase 3, last step) - they only take effect on the
*next* deployment.

## What's included in this phase

- Instructor login (separate account per instructor)
- Three fixed streams (Business, Build, Programming) - instructors can edit
  each stream's syllabus (name, intro description, learning objectives,
  recommended schedule) but can't add or remove streams
- Unit folders within each stream - instructors can freely create, rename,
  reorder, publish/unpublish, and delete these
- Lessons, Assignments, and Resources are each their own collection inside
  a unit - instructors add, edit, reorder, publish/unpublish, and delete
  as many titled entries as they need in each, with PDF/PowerPoint/image
  upload and Google Slides embedding on every entry
- Up to 3 mentor contacts per stream - photo, name, title, short bio, and
  an emailable contact button - shown to students next to the stream's
  title/description
- Rich text editing (Quill) throughout, styled to match the student portal
- Public `/api/streams` endpoint the student portal reads from live -
  students only ever see published units and published lessons within them

## Not built yet (later phases, per your roadmap)

- Student accounts, lesson completion tracking, student dashboard (Phase 2)
- Assignments and submissions (Phase 3)
- Quizzes (Phase 4)
- Analytics (Phase 5)
