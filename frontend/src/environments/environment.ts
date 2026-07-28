export const environment = {
  production: false,
  apiUrl: '/api',
  vapidPublicKey: 'BCFE0JBOa0yvIGNDnlTiDop_jxrNGRqTwN4ESmo_0A68vyhW-XhxFRS1yKlV1AzcteOvZJlubiIU_HaCp0LQSoA',

  // ── Public marketing-site advertising (DISABLED by default) ───────────────
  // Ads render ONLY on the public marketing site (home, Learn hub, Learn
  // articles) — never in the native app or on any authenticated/auth route.
  // The AdSense script is loaded lazily by MarketingAdScriptLoader and only when
  // a MarketingAdUnit mounts on an approved route. Flip `enabled` to true and
  // fill in clientId + slot ids once advertising is approved and configured.
  marketingAds: {
    enabled: false,                          // ADS_ENABLED
    clientId: 'ca-pub-XXXXXXXXXXXXXXXX',      // ADSENSE_CLIENT_ID
    devPlaceholders: true,                   // ADS_DEV_PLACEHOLDERS (show neutral placeholders locally)
    requireConsent: false,                   // off in dev — no real clientId to load Google's CMP against
    slots: {
      homeDesktop: 'XXXXXXXXXX',             // ADSENSE_SLOT_HOME_DESKTOP
      homeMobile:  'XXXXXXXXXX',             // ADSENSE_SLOT_HOME_MOBILE
      learnFeed:   'XXXXXXXXXX',             // ADSENSE_SLOT_LEARN_FEED
      learnInline: 'XXXXXXXXXX',             // ADSENSE_SLOT_LEARN_INLINE
      learnBottom: 'XXXXXXXXXX',             // ADSENSE_SLOT_LEARN_BOTTOM
    },
    placements: {
      homeSidebarEnabled:        true,
      homeMobileBannerEnabled:   true,
      learnFeedEnabled:          true,
      learnArticleInlineEnabled: true,
      learnArticleBottomEnabled: true,
    },
  },
};
