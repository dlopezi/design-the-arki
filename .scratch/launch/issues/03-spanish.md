# 03 English and Spanish

Status: ready-for-agent

- `src/i18n/es.ts` with the same shape as `en.ts` (TypeScript checks it).
- Level texts (JSON) in both languages; a test checks every level has both.
- Language saved in the browser, English by default, `<html lang>` updated.
- `EN | ES` switch on the title screen footer (see sketch). A test fails on Spanish text outside the tables.
