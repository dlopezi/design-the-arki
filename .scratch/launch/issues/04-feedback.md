# 04 In-game Feedback (Web3Forms)

Status: needs-info (Web3Forms access key from the owner)

- Feedback dialog: one message field (5-2000 characters), hidden trap field, one message per minute.
- Attached: version, language, current level and mode, last result, browser, screen size. Short note says what is sent.
- Entry points: title menu item, the level screen (replaces "Send feedback" links), the results drawer.
- Game keys are off while typing. CSP: `connect-src https://api.web3forms.com`.
- Unit test for the payload and the limits; E2E test with the request mocked.
