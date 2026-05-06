# Iteration

Habit battle pass application.

## Season reset verification

Use these commands to verify that season progress is reset when a new season starts.

1. Ensure `apps/api/.env` contains `DATABASE_URL` and Supabase credentials.
2. Seed an old season state for a user:

   `npm run setup:season-reset-check -w api -- <supabase-user-uuid> [seedSeasonXp]`

3. Inspect the stored progress before and after calling `GET /api/bootstrap` with the same user's bearer token:

   `npm run inspect:season-progress -w api -- <supabase-user-uuid>`

4. Expected result after bootstrap:

   - `currentSeasonId` changes to the active season
   - `seasonXp` is reset to `0`
   - `seasonLevel` is reset to `1`
