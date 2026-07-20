# Project and Company Navigation UX Audit

## Completed flow

- Company and Project IDs restore from URL query parameters.
- Successful lookup persists the last Company or Project for the next visit.
- Pixel Office links to the current Company and active Project.
- Company Command Center lists linked Projects with progress, priority, and risk counts.
- Project War Room keeps Company context and links back to its Company.
- Sidebar labels are valid Korean text with no encoding corruption.

## Browser acceptance path

`Pixel Office (qa-company) → Company Command Center → QA Project → Project War Room`

The automated browser gate verifies both entity IDs in the URL and confirms that the Project input is restored as `p1` after navigation.

## Verification

- `npm run typecheck`
- `npm run web:build`
- `npm run p5:browser-qa`
- `npm run verify`
