# Performance and Accessibility Completion Audit

## Scope

- 30-person pixel office rendering
- 10 simultaneous Run submissions
- 100-event persistence and replay throughput
- 10,000-event cursor replay and virtual scrolling
- keyboard navigation, reduced motion, high contrast, ARIA, and screen-reader semantics

## Automated gates

| Gate | Acceptance criterion | Evidence |
|---|---|---|
| Office render | 30 visible staff and at least 30 FPS | `npm run p5:browser-qa` |
| Virtual timeline | 500 events loaded with at most 25 DOM rows | `npm run p5:browser-qa` |
| Keyboard | End key advances the virtual list | `npm run p5:browser-qa` |
| Motion preference | animation duration is at most 0.01 ms | `npm run p5:browser-qa` |
| Screen reader | landmarks, named controls, office heading, and named event list exist in the accessibility tree | `npm run p5:browser-qa` |
| Parallel intake | 10 unique Runs persist and enqueue within 1 second | `npm run performance:smoke` |
| Event throughput | 100 ordered events persist and read within 1 minute | `npm run performance:smoke` |
| Long history | all 10,000 authoritative events replay in cursor pages | `npm run p5:office-scale-smoke` |

## Latest measured result

- Office render: 30 staff, 56.8 FPS
- Virtual timeline: 500 loaded, 19 rendered rows
- Accessibility: reduced motion `1e-05s`, 19 named ARIA elements, accessibility-tree assertions passed
- Parallel intake: 10 Runs in 6.0 ms, no loss
- Event throughput: 100 events in 7.8 ms, ordered and complete

## Completion decision

The performance and accessibility priority is complete when `npm run verify` passes on the target Windows workstation with Chrome or Edge and the local `browser-automation` skill installed.
