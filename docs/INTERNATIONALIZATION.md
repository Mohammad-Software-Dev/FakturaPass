# Languages

FakturaPass supports German (default) and English. The language selector is available in the top bar on every screen, including mobile. It switches the current view immediately and preserves the selected invoice, tab, filters, validation state and unsaved JSON. A first-party `fakturapass-language` cookie stores the choice for one year. The server reads that preference for the initial HTML language and page metadata; switching also updates the document title, description and `lang` attribute.

## Coverage

Navigation, headings, actions, status badges, filters, empty/loading states, import previews, fixture names, recipient profile labels, schema and API errors, validation summaries, approval/generation feedback, correction history, evidence controls, settings, notices, missing-page/error-recovery screens and accessibility labels use shared catalogs. Dates, times, decimal quantities and EUR amounts follow the selected locale. Decimal strings are formatted without conversion to floating-point numbers.

Invoice contents, source JSON, field paths, identifiers, rule IDs, version names, generated XML and saved evidence are language-independent. Supplier names and line descriptions remain exactly as supplied. Validation summaries are localized; original validator diagnostics remain available under a clearly labelled technical-details section, and the archived report is unchanged. Known official rules have specific translated explanations; additional rules receive a localized prompt to inspect their rule ID and original diagnostic.

The REST API accepts `Accept-Language` for error messages and recipient display names, including regional tags and quality weights. German is the fallback. Responses containing translated messages expose `Content-Language` and `Vary: Accept-Language`. Error codes and evidence payloads do not change with language. The browser sends its selected language explicitly for API requests.

## Adding a language

1. Copy `packages/i18n/de.json` to a new locale catalog and translate every value. Keys are stable German source messages; keep keys and named placeholders unchanged, even if German wording is later revised.
2. Register the locale's self-name and Intl locale in `packages/i18n/index.ts`, import its catalog, and add it to `dictionaries`. TypeScript requires every registered language to provide the complete catalog. The selector is generated from this registry.
3. Review number/date conventions and singular/plural count phrases for the new language. Languages with additional plural categories need corresponding count variants and selection rules.
4. Add browser acceptance coverage for that language, including navigation, import, validation, correction, errors and small screens. Run `npm run verify`.

Use `t(key, {name: value})` for translated UI text and named placeholders. Keep business data outside translation calls. `findingDescription` owns validation explanations and `apiErrorKeys` owns error-code mappings; add translations there when introducing a new finding or API error. Do not rewrite persisted findings to translate them.

## Verification

The i18n unit suite checks catalog completeness, placeholders, language negotiation, exact decimal formatting, calendar dates, validation descriptions and catalog-backed JSX/accessibility text. Browser suites exercise the full invoice workflow in both languages on Chromium and WebKit, plus switching with unsaved drafts, persisted language, server-rendered HTML, metadata, translated errors, settings, missing pages, unexpected-error recovery and mobile layout. API tests confirm localized errors/profile names and unchanged XML hashes/evidence across languages.
