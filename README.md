<p>
  <a href="https://stellarhex.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/stellarhex-dark.svg" />
      <img src="docs/stellarhex-light.svg" alt="StellarHex - research and technology" width="420" />
    </picture>
  </a>
</p>

# Out of many · one light

```text
┌─ PURPOSE ───────────────────────────────────────────────────┐
│                                                             │
│  Understanding complex systems.                             │
│  Making that understanding useful.                          │
│                                                             │
│  StellarHex is an independent research and technology       │
│  company working across disciplines.                        │
│                                                             │
│  This repository is the source for stellarhex.com and its   │
│  procedural visual identity.                                │
│                                                             │
├─ PRINCIPLES ────────────────────────────────────────────────┤
│                                                             │
│  Connections  Understand the relationships that shape a     │
│               system.                                       │
│                                                             │
│  Rigor        Keep explanations open to evidence and        │
│               challenge.                                    │
│                                                             │
│  Capability   Turn understanding into methods, software,    │
│               and technology.                               │
│                                                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │
┌─ THE IDENTITY, IN SOURCE ────┴──────────────────────────────┐
│                                                             │
│  A segmented mirror gives the idea a visible form:          │
│  separate elements brought into focus.                      │
│                                                             │
│  Eighteen segments · three rings · three struts             │
│                                                             │
│  The mark and its animated counterpart share the same       │
│  geometry.                                                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    SHARED GEOMETRY                    │  │
│  │              tools/core/ + tools/identity/            │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│                ┌─────────────┴──────────────┐               │
│                ▼                            ▼               │
│  ┌───────────────────────────┐ ┌─────────────────────────┐  │
│  │         IDENTITY          │ │         OPTICS          │  │
│  │                           │ │                         │  │
│  │  SVG embedded at build    │ │  tools/optics/          │  │
│  │  SVG + PNG exported       │ │  Live mirror + halo     │  │
│  │  together as a ZIP kit    │ │  in the browser         │  │
│  └───────────────────────────┘ └─────────────────────────┘  │
│                                                             │
│  Development  The browser draws the identity live.          │
│                                                             │
│  Build        Headless Chrome measures and renders the      │
│               artwork; Vite assembles the pages into        │
│               dist/.                                        │
│                                                             │
│  Production   Identity SVGs are embedded in HTML. The hero  │
│               remains animated as an illustration of        │
│               alignment.                                    │
│                                                             │
│  Colours      Page SVGs follow the theme. Kit files         │
│               contain their own colours.                    │
│                                                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │
┌─ WORK LOCALLY ───────────────┴──────────────────────────────┐
│                                                             │
│  Use the Node version in .nvmrc. Builds and local kit       │
│  downloads also need Chrome or Chromium.                    │
│                                                             │
│  Set CHROME_PATH for a custom browser executable.           │
│                                                             │
│  npm ci                                                     │
│  npm run dev       # live development                       │
│  npm run preview   # build and preview production           │
│  npm run check     # run all checks                         │
│                                                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │
┌─ VERIFICATION ───────────────┴──────────────────────────────┐
│                                                             │
│  Formatting · JavaScript/CSS lint · build · HTML            │
│  validation · local links                                   │
│                                                             │
│  CI runs the checks on pull requests and before deploying   │
│  main to GitHub Pages.                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Explore

- [Website](https://stellarhex.com/) - the company overview.
- [Identity guide](https://stellarhex.com/brand/) - logo construction and the downloadable brand kit.
- [Page components](src/components/) - website copy and component styles.
- [Design tokens](src/styles/tokens.css) - colours, typography and theme variables.
- [Geometry and optics](tools/) - identity drawings and the animated hero.

## License

Copyright (c) 2026 StellarHex. All rights reserved. See [LICENSE](LICENSE).

For the StellarHex name and logos, see [brand usage](public/BRAND.txt).

## Contributors

- [Giorgi Kishmareia](https://github.com/q1sh101)
- [Batu Dere](https://github.com/Null4d)
