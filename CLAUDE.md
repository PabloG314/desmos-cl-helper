# Desmos CL Helper

A static web page that helps a teacher generate Desmos Activity Builder Computation Layer (CL) code from a map of their activity. **Read DESIGN.md before making changes.** It is the source of truth for behaviour, data model, and build order.

## Commands
- `npm install`
- `npm run dev` (Vite dev server)
- `npm test` (Vitest)
- `npm run build` (static output in `dist/`)

## Hard rules
- No network calls at runtime and no AI features. Everything is deterministic and works offline.
- No server code. The build output must be plain static files.
- Never read, modify, or automate the Desmos website. The tool only produces text to copy.
- Do not invent CL syntax. Generated code must follow the tested templates in DESIGN.md section 11. Anything marked UNTESTED stays behind a dev flag until the author confirms it in a real Desmos activity.
- Behaviours reference components by hidden id, never by name.
- Code generation lives in pure functions (`src/codegen/`) with no DOM access, covered by tests.

## Conventions
- TypeScript strict mode. Plain `.js` is acceptable where it is clearly simpler.
- Libraries: SortableJS (drag and drop), lz-string (share links), Vitest (tests). Ask before adding others.
- Follow the milestone order in DESIGN.md section 15 and keep tests passing at each step.
- When a design question isn't answered in DESIGN.md, ask rather than guess, and add the decision to DESIGN.md once made.
