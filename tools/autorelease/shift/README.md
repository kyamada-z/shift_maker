# Shift Maker verification

This frozen verifier is for the approved PDF.js 4 module runtime and the initial
range, failure-reporting, configuration-state and ZIP fixes. It makes no live AI
requests and changes no application files.

1. Independently obtain the current and candidate `index.html` at exact Git SHAs.
   Run `node validate-source.cjs SOURCE_HTML`. It accepts only the two matching
   stable 4.x PDF.js version tokens and rejects a downgrade below 4.10.38. An
   unchanged initial baseline is accepted. A runtime/HTML/CSS/provider change
   requires separate review and a new frozen baseline, not a verifier edit.
2. Check current official security advisories and fixed-version eligibility.
   For each baseline/candidate PDF.js version, download the official npm tarball,
   verify registry SHA512 integrity, and compare the exact main/worker CDN bytes
   against the corresponding official package files. A self-written asset record
   alone is not proof. Keep inherited proxy/CA policy; stop on an explicit denial.
3. In a temporary vendor directory put verified assets at
   `pdfjs/VERSION/pdf.min.mjs`, `pdfjs/VERSION/pdf.worker.min.mjs`, and the unchanged
   JSZip 3.10.1 fixture at `jszip.min.js`. Do not commit downloaded vendor assets.
4. Run the browser helper with seven explicit arguments (paths may contain spaces):

   `node verify-browser.cjs SOURCE_HTML BASELINE_HTML OUT_DIR VENDOR_DIR CSS_FILE PLAYWRIGHT_MODULE CHROMIUM_EXECUTABLE`

   Use this bundle's `production-tailwind.css` and `synthetic-two-page.pdf`.
   Source remains empty-key/unconfigured and must visibly reject analysis without
   any AI call. Only the local `/configured` test response substitutes the literal
   `synthetic-fixture-not-a-real-key` to run intercepted synthetic AI cases. This
   is not an application credential or a deployed source change. All external
   requests are intercepted; unrecognized destinations are aborted and fail the
   run. The source file must retain exactly one empty-key literal and its existing
   provider/model URL. Output includes expected synthetic API400 errors separately
   from unexpected console/page errors.

The 15 cases check empty-key blocking, real PDF worker rendering with a synthetic
two-page PDF, two successful tables/ten rows, two BOM CSV ZIP entries for identical
staff metadata, inclusive/deduplicated ranges, nine invalid/out-of-bounds inputs
rejected before AI, partial success50%, all failure0%, and malformed-PDF rejection.
Initial layouts are checked at1280px and390px without horizontal overflow.

The CSS fixture is the exact10808-byte initial DOM Tailwind style from the existing
public Pages URL on2026-10-29 (SHA25641c480e8f9b70f50da54ce464b8300aa7fd22dc6f32ede389850044225de89e0).
It proves initial layout under those captured styles. It does not prove current
Tailwind CDN availability, Google font delivery, or generated result-table styles.
Verify the final public initial screen separately after publication. No real AI,
production PDF, browser localStorage, or business data is used by this helper.

The deployed empty-key app intentionally says that AI connection setup is missing.
Do not claim real OCR readiness until a separately authorized secure provider
integration exists. Do not insert a real key into this public static HTML.

Initial verified PDF.js4.10.38 main352645bytes SHA256
`27fc2a057a00f92a4334ad06e17dbd7259912954e9fb7f76400bcca5fd190a9c`;
worker1375838bytes SHA256
`1baa1844c89c80a5b2797c916e75ab29254be46d8e9cb53cb6364d7aad84be36`.
Both matched official npm integrity
`sha512-/Y3fcFrXEAsMjJXeL9J8+ZG9U01LbuWaYypvDW2ycW1jL269L3js3DVBjDJ0Up9Np1uqDXsDrRihHANhZOlwdQ==`.
Use newly verified official package/CDN comparisons for later eligible versions.

Release with a lease from the verified current main. Observe Pages build source
SHA and served exact index Git hash before declaring success. For the initial
pilot, rollback and republish use forward commits with original and candidate
trees respectively. Never force or move a ref backwards. Finish on the tested
candidate tree, and freeze that successful main SHA as the next baseline.
