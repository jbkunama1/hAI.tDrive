# Goal: tRive Repository Setup & Configuration

## User Request

Create a new public repository named `tRive` under MIT license with all necessary files, professional appearance, BuyMeACoffee link, shield tags, colored graphics, emojis, and generalized branding (removing personalized network terms). The application must also include an admin interface with a one-time setup to save environment variables (JWT, port, password, API server, and key), secured by an initial password that must be changed immediately after the first login.

## Refined Goal

1. Initialize repository structure for `tRive` (Public, MIT License).
2. Create professional README.md with shields, buy me a coffee link, colored graphics, and emojis, ensuring generic branding.
3. Generate a synced `index.html` for GitHub Pages.
4. Add a GitHub Actions workflow to build and push a Docker image to GHCR.
5. Add a TruffleHog action workflow to check the repo.
6. Implement the application features:
   - Admin interface for one-time setup of environment variables (JWT, port, password, API server, key).
   - Initial password protection requiring an immediate password change upon first login.

## Acceptance Criteria

- [ ] Repository is configured as public with MIT license.
- [ ] Professional README.md exists with shields, BuyMeACoffee, and general branding.
- [ ] Synced index.html is present for GitHub Pages.
- [ ] GHCR Docker build workflow is added.
- [ ] TruffleHog workflow is added.
- [ ] Admin interface with one-time env setup (JWT, port, password, API server, key) is implemented.
- [ ] Initial password protection requiring password change on first login is implemented.

## Scope Boundaries

**In scope:**
- All requested setup files, workflows, documentation, and the admin interface backend/frontend logic.

**Out of scope:**
- Production deployment outside of the standard repository setup.

## Applicable Project Conventions

**Quality gate command:**
- `npm test` or basic check if applicable.

**Commit convention:**
- conventional commits
- Assisted-by trailer required: `Assisted-by: GPT:5.6-Luna`
