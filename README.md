# FTG Fellowship

Secure bilingual learning and program operations platform for the Future Builders Fellowship.

Production: https://ftg-fellowship.vercel.app

## Main capabilities

- Mentee learning, assignments, submissions, attendance, feedback, and progress tracking.
- Mentor onboarding, mentee pairing, assignment creation, review, and revision workflows.
- Fasil account management, curriculum, calendar, information board, email notifications, reports, and audit logs.
- Public program-impact reporting for donors and partners.
- Central Google Drive storage for submitted files. Supabase stores metadata and links only.

## Account and credential policy

Login credentials are never stored in this repository or exposed in documentation.

- Create and manage accounts through the Fasil dashboard or Supabase Auth.
- Store operational credentials in an approved password manager.
- Put server secrets only in Vercel environment variables.
- Never place service-role keys, OAuth client secrets, refresh tokens, SMTP passwords, donor access codes, or user passwords in browser files.
- Rotate a credential immediately if it has ever been committed or shared in plaintext.

The Supabase publishable key and Google OAuth client ID used by the browser are public identifiers. Privileged access remains server-side and is protected by authenticated role checks.

## Required server configuration

Configure values in Vercel and local `.env` files. Only variable names are documented here:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
APP_URL
GOOGLE_DRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET
GOOGLE_DRIVE_REFRESH_TOKEN
GOOGLE_DRIVE_ROOT_FOLDER_ID
GOOGLE_DRIVE_OWNER_EMAIL
UPLOAD_SESSION_SECRET
EMAIL_PROVIDER
ZOHO_SMTP_HOST
ZOHO_SMTP_PORT
ZOHO_SMTP_USER
ZOHO_SMTP_APP_PASSWORD
NOTIFICATION_FROM_EMAIL
NOTIFICATION_REPLY_TO
CRON_SECRET
DONOR_TOKEN_SECRET
```

Use distinct high-entropy values for `UPLOAD_SESSION_SECRET`, `DONOR_TOKEN_SECRET`, and `CRON_SECRET`.

## Database

Apply files in `supabase/migrations` in filename order. The application uses Supabase Auth for passwords and `public.profiles` for role and profile data. Legacy `public.ftg_users.password` storage is prohibited and removed by the security migration.

## Development and verification

```bash
npm install
npm run security
npm run qa
```

`npm run security` scans tracked source files for credential exposure and verifies critical security controls. `npm run qa` runs syntax, localization, and browser checks.

## Deployment rules

1. Run security and QA checks before every deployment.
2. Review database migrations before applying them to production.
3. Deploy through the authorized Vercel project.
4. Verify login and authorization separately for Mentee, Mentor, and Fasil.
5. Never publish test credentials in commits, issues, screenshots, or repository descriptions.

## Responsible disclosure

Report suspected vulnerabilities privately to the program owner. Do not include passwords, access tokens, participant data, or exploit details in a public issue.
