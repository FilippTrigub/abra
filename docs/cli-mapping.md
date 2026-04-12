# Marketing CLI Mapping to Bundles

> Mapping of which CLIs each execution bundle should use for immediate agent execution.

## CLI Categories

### Social Media & Publishing
| CLI | Use Case | Bundle |
|-----|----------|--------|
| `buffer.js` | Social scheduling | `post-scheduler` |
| `buffer.js` | Buffer queue management | `post-scheduler` |

### Email & Newsletters
| CLI | Use Case | Bundle |
|-----|----------|--------|
| `resend.js` | Send transactional emails | `email-campaigner` |
| `mailchimp.js` | Campaign management | `email-campaigner` |
| `sendgrid.js` | Bulk email sending | `email-campaigner` |
| `kit.js` | Newsletter (creator) | `email-campaigner` |
| `beehiiv.js` | Newsletter platform | `email-campaigner` |
| `klaviyo.js` | E-commerce email/SMS | `email-campaigner` |
| `brevo.js` | Email + SMS | `email-campaigner` |
| `postmark.js` | Transactional email | `email-campaigner` |

### Analytics & Measurement
| CLI | Use Case | Bundle |
|-----|----------|--------|
| `ga4.js` | Google Analytics reporting | `ads-manager` |
| `ga4.js` | Conversion tracking | `funnel-optimizer` |
| `google-ads.js` | Campaign data | `ads-manager` |
| `mixpanel.js` | Product analytics | `funnel-optimizer` |
| `amplitude.js` | Cohort analysis | `funnel-optimizer` |
| `plausible.js` | Privacy analytics | `seo-researcher` |
| `segment.js` | CDP data routing | `revenue-manager` |
| `google-search-console.js` | Search data | `seo-researcher` |

### SEO Tools
| CLI | Use Case | Bundle |
|-----|----------|--------|
| `semrush.js` | Keyword research | `seo-researcher` |
| `ahrefs.js` | Backlink analysis | `seo-researcher` |
| `dataforseo.js` | SERP data | `seo-researcher` |
| `keywords-everywhere.js` | Quick keyword lookup | `seo-researcher` |

### Advertising
| CLI | Use Case | Bundle |
|-----|----------|--------|
| `google-ads.js` | Google Ads management | `ads-manager` |
| `meta-ads.js` | Facebook/Instagram ads | `ads-manager` |
| `linkedin-ads.js` | LinkedIn ads | `ads-manager` |
| `tiktok-ads.js` | TikTok ads | `ads-manager` |

### CRM & Revenue Ops
| CLI | Use Case | Bundle |
|-----|----------|--------|
| `hubspot.js` | CRM contacts/deals | `revenue-manager` |
| `salesforce.js` | Enterprise CRM | `revenue-manager` |
| `close.js` | SMB CRM | `revenue-manager` |
| `outreach.js` | Sales engagement | `revenue-manager` |
| `crossbeam.js` | Partner data | `revenue-manager` |
| `apollo.js` | Lead enrichment | `revenue-manager` |
| `clearbit.js` | Company data | `revenue-manager` |

### Data Enrichment
| CLI | Use Case | Bundle |
|-----|----------|--------|
| `zoominfo.js` | B2B contact data | `revenue-manager` |
| `clay.js` | Data enrichment | `revenue-manager` |

### Experiments & CRO
| CLI | Use Case | Bundle |
|-----|----------|--------|
| `hotjar.js` | Heatmaps/recordings | `funnel-optimizer` |
| `optimizely.js` | A/B testing | `funnel-optimizer` |

### Referrals & Partners
| CLI | Use Case | Bundle |
|-----|----------|--------|
| `rewardful.js` | Stripe affiliate | `parked` |
| `tolt.js` | SaaS affiliates | `parked` |
| `partnerstack.js` | Enterprise partners | `revenue-manager` |
| `dub.js` | Link tracking | `email-campaigner` |

### Scheduling
| CLI | Use Case | Bundle |
|-----|----------|--------|
| `calendly.js` | Meeting booking | `email-campaigner` |
| `savvycal.js` | Personalized booking | `email-campaigner` |

---

## Bundle → Required CLIs

### marketing-email-content
**Output:** Content calendars, email sequences, social posts, copy

**Required CLIs:**
- `resend.js` - Send email campaigns
- `mailchimp.js` - Manage Mailchimp campaigns
- `sendgrid.js` - Alternative email sending
- `kit.js` - Creator newsletter
- `dub.js` - UTM/link tracking

### seo-researcher
**Output:** SEO audits, topic clusters, pSEO briefs, schema recommendations

**Required CLIs:**
- `google-search-console.js` - Search performance data
- `semrush.js` - Keyword & competitive research
- `ahrefs.js` - Backlink & content analysis
- `dataforseo.js` - Programmatic SERP data
- `keywords-everywhere.js` - Quick keyword lookups
- `plausible.js` - Privacy-focused analytics

### funnel-optimizer
**Output:** CRO audits, experiment designs, retention playbooks

**Required CLIs:**
- `ga4.js` - Conversion tracking
- `mixpanel.js` - Product analytics
- `amplitude.js` - Cohort analysis
- `hotjar.js` - Session recordings & heatmaps
- `optimizely.js` - A/B test execution
- `rewardful.js` - Affiliate program tracking
- `tolt.js` - Referral tracking

### ads-manager
**Output:** Ad campaign plans, creative briefs, tracking specs

**Required CLIs:**
- `ga4.js` - Analytics reporting
- `google-ads.js` - Campaign management
- `meta-ads.js` - Facebook/Instagram
- `linkedin-ads.js` - LinkedIn campaigns
- `tiktok-ads.js` - TikTok campaigns

### revenue-manager
**Output:** Lead lifecycle maps, CRM workflows, partner motions

**Required CLIs:**
- `hubspot.js` - Marketing/sales CRM
- `salesforce.js` - Enterprise CRM
- `close.js` - SMB CRM
- `outreach.js` - Sales engagement
- `crossbeam.js` - Partner ecosystem
- `apollo.js` - Lead enrichment
- `clearbit.js` - Company data
- `zoominfo.js` - B2B contacts
- `clay.js` - Data enrichment
- `segment.js` - Data platform

---

## Integration Status

| Bundle | Has CLIs Connected | Status |
|--------|---------------------|--------|
| `email-campaigner` | ✅ Scoped | Has: resend, mailchimp, sendgrid, kit, dub |
| `seo-researcher` | ✅ Scoped | Has: gsc, semrush, ahrefs, dataforseo, plausible |
| `funnel-optimizer` | ✅ Scoped | Has: ga4, mixpanel, amplitude, hotjar, optimizely |
| `ads-manager` | ✅ Scoped | Has: ga4, google-ads |
| `revenue-manager` | ✅ Scoped | Has: hubspot, salesforce, outreach, apollo, segment |

---

## Next Steps

1. Copy relevant CLIs to `lib/marketing-cli/` for each bundle
2. Update bundle scripts to import from `lib/marketing-cli/`
3. Move strategy bundles into `brand-manager/` as sub-bundles
4. Keep execution bundles separate but CLI-connected
