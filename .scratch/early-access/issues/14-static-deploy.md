# 14: Static deployment

**What to build:** The game is built and published automatically to static hosting on our own domain on every push to the default branch.

**Blocked by:** 01

**Status:** ready-for-human

- [ ] Pipeline builds, runs the tests and deploys only when they pass
- [ ] A human chooses the host (GitHub Pages, Netlify or Cloudflare Pages), connects the domain and adds any deploy secrets
- [ ] The deployed site loads level 1 and runs it
