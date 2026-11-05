This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## CI & quality checks

Workflows live in `.github/workflows/`; every pull request runs them.

| Check      | Workflow    | Required to merge | What it does                                                                                                                                                             |
| ---------- | ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `validate` | `ci.yml`    | **yes**           | typecheck, lint, test, build (`pnpm install --frozen-lockfile` first)                                                                                                    |
| `sonar`    | `sonar.yml` | no                | SonarQube Cloud analysis with vitest coverage (`pnpm run test:coverage` writes `coverage/lcov.info`). Warning-only for the first week. **Skipped until Sonar is set up** |

Run the same checks locally before pushing: `pnpm run validate`.

**Setting up SonarQube Cloud** (repository admin, once):

1. Import the repository in SonarQube Cloud (organization `kltn-fa26`). The project key must be
   `KLTN-FA26_fe-backoffice-stockflow-commerce`, which is what `sonar-project.properties` expects.
2. Repository secret `SONAR_TOKEN`: the project's analysis token.
3. Repository variable `SONAR_ORGANIZATION`: `kltn-fa26`.
4. Turn off "Automatic Analysis" for the project in SonarQube Cloud, otherwise it conflicts with the
   CI analysis.

Until both exist the job prints a notice and does nothing, and the PR stays green. The quality gate
is not awaited, so Sonar never blocks a merge.

**Dependabot** (`.github/dependabot.yml`) opens pull requests against `develop` every Monday at
08:00 Vietnam time for npm (pnpm) and GitHub Actions. Minor and patch updates are grouped into one
pull request per ecosystem, majors are separate, at most 5 open at a time, titled `chore(deps): ...`
and labelled `dependencies`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
