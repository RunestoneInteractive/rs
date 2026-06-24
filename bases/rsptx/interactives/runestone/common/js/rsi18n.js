/*
 * rsi18n.js — lightweight, dependency-free i18n for Runestone interactives.
 *
 * Replaces the vendored Wikimedia jquery.i18n plugin for components that have
 * been migrated off jQuery. The catalog format is unchanged: messages are
 * keyed by name within a locale object and use positional $1, $2, ...
 * placeholders, so existing *-i18n.<locale>.js catalog files only need their
 * `$.i18n().load(...)` call swapped for `load(...)`.
 *
 * Usage:
 *   import { load, t } from "../../common/js/rsi18n.js";
 *   load({ en: { greeting: "Hello $1" } });
 *   t("greeting", "World");      // -> "Hello World"
 *   t("unknown_key");            // -> "unknown_key" (matches jquery.i18n)
 */
"use strict";

const FALLBACK = "en";
const catalogs = {};

function normalize(locale) {
    return String(locale || "").toLowerCase();
}

// Default locale from the document, falling back to the browser, then English.
// jquery.i18n derived the locale the same way, so behavior is preserved.
let currentLocale = normalize(
    (typeof document !== "undefined" && document.documentElement.lang) ||
        (typeof navigator !== "undefined" && navigator.language) ||
        FALLBACK,
);

export function setLocale(locale) {
    currentLocale = normalize(locale);
}

export function getLocale() {
    return currentLocale;
}

/**
 * Register messages. Accepts the same shape as $.i18n().load():
 *   { "en": { key: "msg $1" }, "pt-br": { key: "..." } }
 * Locale keys are normalized to lower-case so lookups are case-insensitive
 * (e.g. a "sr-Cyrl" catalog matches a document lang of "sr-cyrl").
 */
export function load(messages) {
    for (const [locale, msgs] of Object.entries(messages)) {
        const key = normalize(locale);
        catalogs[key] = Object.assign(catalogs[key] || {}, msgs);
    }
}

// Lookup order: exact locale, then its primary subtag, then the fallback.
// e.g. "pt-br" -> "pt" -> "en".
function localeChain(locale) {
    const chain = [];
    if (locale) {
        chain.push(locale);
        const primary = locale.split("-")[0];
        if (primary && primary !== locale) {
            chain.push(primary);
        }
    }
    if (chain.indexOf(FALLBACK) === -1) {
        chain.push(FALLBACK);
    }
    return chain;
}

function lookup(key) {
    for (const locale of localeChain(currentLocale)) {
        const catalog = catalogs[locale];
        if (catalog && catalog[key] !== undefined) {
            return catalog[key];
        }
    }
    return undefined;
}

/**
 * Translate a message key, substituting positional $1, $2, ... arguments.
 * Unknown keys are returned verbatim, matching jquery.i18n's behavior.
 */
export function t(key, ...args) {
    const msg = lookup(key);
    if (msg === undefined) {
        return key;
    }
    return msg.replace(/\$(\d+)/g, (match, n) => {
        const arg = args[Number(n) - 1];
        return arg === undefined ? match : String(arg);
    });
}

export default { load, t, setLocale, getLocale };
