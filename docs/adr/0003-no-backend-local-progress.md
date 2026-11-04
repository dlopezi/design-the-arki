# No backend: static hosting and local progress

The game is a static single-player web app; player progress lives in `localStorage` and there are no accounts. Monetisation is deferred, so cloud saves, logins and payments are deliberately out of scope until there is evidence of demand. Revisit this ADR before adding any feature that needs server state.
