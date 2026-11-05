# Faculty Ratings

Faculty Ratings is a Reddit community app built for the VIT Bhopal student community. It helps students browse faculty profiles, share faculty ratings, and request additions or corrections to the faculty and course directory.

## Features

### Student experience

- Browse the faculty directory.
- Search and filter faculty by name, school, and associated course.
- Open faculty profiles and view available rating summaries.
- Submit a faculty rating when eligible.
- Request that a faculty member be added to the directory.
- Request that a course be added to the approved course list.
- Request course tags to be associated with a faculty profile.

### Moderator experience

- Access the moderator dashboard when the current Reddit user has moderator permissions in the subreddit.
- Review faculty addition requests.
- Approve faculty requests after reviewing and editing the submitted details, or reject them with a reason.
- Review and approve or reject course requests.
- Review faculty course-tag requests and approve selected course associations.
- Edit existing faculty records.

## Ratings and eligibility

The app stores ratings per faculty member and calculates rating summaries from submitted ratings. Rating submission requires a logged-in Reddit user and checks the eligibility rules implemented by the app, including a minimum total Reddit karma requirement. A user can submit only one rating per faculty member.

## Data storage

The app uses the Redis service provided by the Reddit Developer Platform through @devvit/web/server. It does not require a separately managed database or external hosting provider.

Stored data includes faculty records, faculty requests, approved courses, course requests, faculty course-tag requests, and faculty ratings. Redis data is scoped to the app installation in a subreddit; separate subreddit installations do not automatically share records.

## Technology

- React
- TypeScript
- Hono
- Devvit Web
- Reddit Developer Platform Redis

## Installation and development

Install dependencies:

```bash
npm ci
```

Run the type check, lint, and production build:

```bash
npm run test:types
npm run lint
npm run build
```

Log in to Devvit:

```bash
npx devvit login
```

Start a playtest in a subreddit where you have moderator permissions and which meets Devvit's playtest subreddit requirements:

```bash
npx devvit playtest <test-subreddit>
```

Upload and submit the app for review:

```bash
npx devvit publish
```

The default publish mode is unlisted. It is intended for the developer to install in communities they moderate and does not list the app in the public App Directory. Public listing requires the separate --public option and approval.

After the app is approved, install it in a subreddit you moderate:

```bash
npx devvit install <subreddit>
```

## Permissions

The app requests:

- Redis: to persist faculty, course, request, and rating data.
- Reddit: to identify the current Reddit user, check moderator permissions, and evaluate rating eligibility using Reddit account information.

Moderator-only operations are protected by server-side moderator permission checks.

## Privacy and data handling

The app uses Reddit-provided identity and community context for app functionality, moderator authorization, and rating eligibility. User-submitted ratings and requests are stored in the app's Redis data for the relevant subreddit installation.

Do not submit passwords, authentication secrets, or other sensitive personal information through the app.

## Support and feedback

For questions, issues, or feedback about the app, contact the app developer or the moderators of the community where it is installed.
