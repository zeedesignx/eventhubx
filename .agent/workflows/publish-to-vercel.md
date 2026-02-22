---
description: How to publish the SwapcardOS application to Vercel
---
# Workflow: Publish to Vercel

Use this workflow to deploy the current state of the application to production on Vercel.

## 1. Prerequisites Check
Ensure the following files are updated and present in the root directory:
- `vercel.json`: Defines routing, builds, and cron jobs.
- `requirements.txt`: Lists all Python dependencies for the backend.
- `main.py`: The entry point for the FastAPI server.

## 2. Environment Variables
Verify that all required environment variables are configured in the Vercel Dashboard or listed in your `.env.local` for reference. Key variables include:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_ID`
- `SWAPCARD_API_KEY`

## 3. GitHub Sync
Deployment is most reliable when triggered via git.
1. Commit all changes: `git add . && git commit -m "Deployment update"`
2. Push to main: `git push origin main`

## 4. Manual Production Deployment
If a manual push is required or git sync is not configured:
// turbo
1. Run the production deployment command:
   ```powershell
   npx vercel deploy --prod --yes
   ```

## 5. Verification
1. Once the deployment is complete, navigate to the production URL provided by Vercel.
2. Verify that the Dashboard and Events pages load correctly.
3. Check the Vercel Logs for any runtime errors (ImportErrors, Database connection issues).
