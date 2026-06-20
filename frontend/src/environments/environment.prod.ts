export const environment = {
  production: true,
  apiUrl: 'https://clarityfinancialtools.com/api',
  vapidPublicKey: 'BCFE0JBOa0yvIGNDnlTiDop_jxrNGRqTwN4ESmo_0A68vyhW-XhxFRS1yKlV1AzcteOvZJlubiIU_HaCp0LQSoA',

  // ── Public Learn advertising (DISABLED by default) ────────────────────────
  // Ads only ever render on the public marketing Learn pages, never in the
  // native app or on authenticated screens. Flip publicLearnAdsEnabled to true
  // and fill in the slot ids once advertising is approved and configured.
  publicLearnAdsEnabled: false,   // PUBLIC_LEARN_ADS_ENABLED
  adsenseClientId: '',            // ADSENSE_CLIENT_ID
  learnAdSlotInline: '',          // LEARN_AD_SLOT_INLINE
  learnAdSlotFooter: '',          // LEARN_AD_SLOT_FOOTER
};
