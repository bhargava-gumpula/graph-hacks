# Team notes (demo repo)

A tiny synthetic TypeScript app: login, notes, users, and settings. It is the fixture Switchboard parses for conflict, blast-radius, hub, and scheduling tests, and for the demo video.

Planted traps:

- Chain: `ui/LoginForm.tsx` → `api/login.ts` → `auth/session.ts` → `lib/crypto.ts` (value imports).
- Hub: `lib/utils.ts` is imported by exactly 20 other files and imports nothing.
- Alias: four `@lib/...` imports, including `@lib/crypto` and `@lib/utils`. Other imports are relative and extensionless.
- Type-only: exactly three type-only imports, all from `lib/types.ts`.
- Leaf: `ui/AboutPage.tsx` imports only the hub and has no dependents.
- Island: `ui/SettingsPanel.tsx` → `api/settings.ts` → `lib/prefs.ts` shares no file with the login chain except the hub and `lib/types.ts`.

No import cycles. Nothing is imported from outside this folder. The code is synthetic, written for Switchboard's tests and demo.
