# Notes for Claude

## Unit tests

- **Never run the unit tests on your own.** Run them only when the user asks.
- **Exception: a test you just created.** Run that one test file, and only that file.
- **Exception: a test you just changed.** Run that one test file, and only that file.
- Never run the whole suite (`node --test tests/`) unless the user asks for it. Use the single-file form:

```bash
node --test tests/<name>.test.mjs
```

- Changing code that a test covers, without changing the test itself, is not a reason to run it. Say which test covers it and let the user decide.
- CI runs the whole suite on every deploy, so that is not your job either.

## File names

- File and folder names are in English by default (for example `ghost-room.js`, not `kamar-hantu.js`).
- Only use a non-English name when the user asks for it, or when it is a name that already exists. Never rename existing files or public addresses on your own.
