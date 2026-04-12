/**
 * Tracking Task
 * 
 * Configure analytics and conversion tracking across platforms
 * 
 * Usage:
 *   uv run node run.mjs --task tracking --ga4-measurement-id G-XXXXXXXXXX
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GA4 } from '../../../_providers/marketing/ga4.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Configure analytics and tracking
 */
export async function main(options = {}) {
  const config = await loadConfig();

  const tracking = {
    ga4: await configureGA4(options, config),
    googleAds: await configureGoogleAds(options, config),
    meta: await configureMeta(options, config),
    linkedin: await configureLinkedIn(options, config),
    global: {
      consentMode: options.consent !== 'false',
      cookielessMode: options.cookieless !== 'false'
    }
  };

  // Validate configuration
  const validation = validateTracking(tracking);

  // Write configuration
  const outputDir = options.outputDir || config.output_dir || './output';
  await mkdir(outputDir, { recursive: true });

  const outputFile = join(outputDir, 'tracking-config.json');
  await writeFile(outputFile, JSON.stringify(tracking, null, 2));

  console.log(`Tracking configuration generated: ${outputFile}`);
  console.log(JSON.stringify(tracking, null, 2));

  // Generate tracking code snippets if requested
  if (options['output-snippets'] || options.snippets) {
    const snippetsDir = options.snippetsDir || join(outputDir, 'tracking-code');
    await generateTrackingSnippets(tracking, snippetsDir);
  }

  return { tracking, validation };
}

/**
 * Configure GA4 tracking
 */
async function configureGA4(options, config) {
  const enabled = config.tracking?.ga4?.enabled !== false && (options['ga4-enabled'] !== 'false');
  
  if (!enabled) {
    return { enabled: false };
  }

  const measurementId = options['ga4-measurement-id'] || config.tracking?.ga4?.measurement_id;

  if (!measurementId) {
    return {
      enabled: true,
      measurementId: null,
      status: 'MISSING_ID',
      message: 'GA4 measurement ID required'
    };
  }

  const events = options.events?.split(',') || config.tracking?.ga4?.events || ['view_item', 'add_to_cart', 'purchase', 'lead'];

  // Test GA4 connection if ID is provided
  let status = 'CONFIGURED';
  let message = 'GA4 configuration ready';

  if (!options['dry-run']) {
    try {
      const testReport = await GA4.realtimeReport([{ name: 'activeUsers' }]);
      if (testReport.status === 401) {
        status = 'AUTH_ERROR';
        message = 'Invalid GA4 credentials';
      } else if (testReport.status === 403) {
        status = 'PERMISSION_ERROR';
        message = 'GA4 property access denied';
      } else {
        status = 'CONNECTED';
      }
    } catch (error) {
      status = 'CONNECTION_ERROR';
      message = error.message;
    }
  }

  return {
    enabled: true,
    measurementId,
    status,
    message,
    events,
    dataRetention: '2_months',
    dataProcessing: 'EUROPEAN_EEA',
    googleSignals: true,
    enhancedMeasurement: {
      scrollThreshold: 90,
      outboundClicks: true,
      fileDownloads: true,
      siteSearch: true,
      videoEngagement: true
    }
  };
}

/**
 * Configure Google Ads conversion tracking
 */
async function configureGoogleAds(options, config) {
  const enabled = config.tracking?.google_ads?.enabled !== false && (options['google-ads-enabled'] !== 'false');

  if (!enabled) {
    return { enabled: false };
  }

  const conversionId = options['google-ads-conversion-id'] || config.tracking?.google_ads?.conversion_id;
  const conversionLabel = options['google-ads-conversion-label'] || config.tracking?.google_ads?.conversion_label;

  if (!conversionId && !conversionLabel) {
    return {
      enabled: true,
      conversionId: null,
      conversionLabel: null,
      status: 'MISSING_ID',
      message: 'Google Ads conversion ID or label required'
    };
  }

  const autoConversion = options['auto-conversion'] !== 'false';

  return {
    enabled: true,
    conversionId,
    conversionLabel,
    status: 'CONFIGURED',
    message: 'Google Ads conversion tracking configured',
    autoConversionTracking: autoConversion,
    sendMatchedData: false,
    events: [
      { name: 'purchase', value: 'transaction_id' },
      { name: 'lead', value: 'lead_id' },
      { name: 'page_view', value: null }
    ]
  };
}

/**
 * Configure Meta Pixel tracking
 */
async function configureMeta(options, config) {
  const enabled = config.tracking?.meta?.enabled !== false && (options['meta-enabled'] !== 'false');

  if (!enabled) {
    return { enabled: false };
  }

  const pixelId = options['meta-pixel-id'] || config.tracking?.meta?.pixel_id;

  if (!pixelId) {
    return {
      enabled: true,
      pixelId: null,
      status: 'MISSING_ID',
      message: 'Meta Pixel ID required'
    };
  }

  const events = options.metaEvents?.split(',') || config.tracking?.meta?.events || ['ViewContent', 'AddToCart', 'Purchase', 'Lead'];

  return {
    enabled: true,
    pixelId,
    status: 'CONFIGURED',
    message: 'Meta Pixel configured',
    events,
    advancedMatching: true,
    useDataPolicy: true,
    dataProcessing: {
      options: ['IP', 'UA']
    },
    automaticPageViews: true
  };
}

/**
 * Configure LinkedIn Insight Tag tracking
 */
async function configureLinkedIn(options, config) {
  const enabled = config.tracking?.linkedin?.enabled !== false && (options['linkedin-enabled'] !== 'false');

  if (!enabled) {
    return { enabled: false };
  }

  const tagId = options['linkedin-tag-id'] || config.tracking?.linkedin?.tag_id;

  if (!tagId) {
    return {
      enabled: true,
      tagId: null,
      status: 'MISSING_ID',
      message: 'LinkedIn Insight Tag ID required'
    };
  }

  const events = options.linkedinEvents?.split(',') || config.tracking?.linkedin?.events || ['page_visit', 'lead_form_submit', 'website_conversion'];

  return {
    enabled: true,
    tagId,
    status: 'CONFIGURED',
    message: 'LinkedIn Insight Tag configured',
    events,
    optOut: false,
    pageVisitEvent: {
      name: 'PageVisit',
      value: null
    },
    customEvents: []
  };
}

/**
 * Validate tracking configuration
 */
function validateTracking(tracking) {
  const issues = [];
  const warnings = [];
  const recommendations = [];

  // GA4 validation
  if (tracking.ga4.enabled && !tracking.ga4.measurementId) {
    issues.push({
      service: 'ga4',
      severity: 'critical',
      message: 'GA4 measurement ID is required for tracking to work'
    });
  }

  // Google Ads validation
  if (tracking.googleAds.enabled && !tracking.googleAds.conversionId && !tracking.googleAds.conversionLabel) {
    issues.push({
      service: 'google-ads',
      severity: 'high',
      message: 'Google Ads conversion ID or label is required'
    });
  }

  // Meta validation
  if (tracking.meta.enabled && !tracking.meta.pixelId) {
    issues.push({
      service: 'meta',
      severity: 'high',
      message: 'Meta Pixel ID is required'
    });
  }

  // LinkedIn validation
  if (tracking.linkedin.enabled && !tracking.linkedin.tagId) {
    issues.push({
      service: 'linkedin',
      severity: 'medium',
      message: 'LinkedIn Insight Tag ID is recommended'
    });
  }

  // Cross-service warnings
  if (tracking.googleAds.enabled && tracking.meta.enabled) {
    warnings.push({
      message: 'Multiple conversion tracking services configured. Consider consolidating for easier attribution'
    });
  }

  // Recommendations
  if (!tracking.global.consentMode) {
    recommendations.push({
      priority: 'high',
      message: 'Enable consent mode for GDPR/CCPA compliance'
    });
  }

  if (!tracking.global.cookielessMode && tracking.googleAds.enabled) {
    recommendations.push({
      priority: 'medium',
      message: 'Enable cookieless mode for improved privacy'
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    recommendations,
    coverage: {
      ga4: tracking.ga4.enabled,
      googleAds: tracking.googleAds.enabled,
      meta: tracking.meta.enabled,
      linkedin: tracking.linkedin.enabled
    }
  };
}

/**
 * Generate tracking code snippets
 */
async function generateTrackingSnippets(tracking, outputDir) {
  await mkdir(outputDir, { recursive: true });

  // GA4 snippet
  if (tracking.ga4.enabled && tracking.ga4.measurementId) {
    const ga4Snippet = `
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${tracking.ga4.measurementId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${tracking.ga4.measurementId}');
  
  // Custom event tracking
  window.trackEvent = function(name, params) {
    gtag('event', name, params);
  };
</script>
    `.trim();

    await writeFile(join(outputDir, 'ga4.html'), ga4Snippet);
  }

  // Google Ads snippet
  if (tracking.googleAds.enabled && tracking.googleAds.conversionId) {
    const googleAdsSnippet = `
<!-- Google Ads Conversion Tracking -->
<script>
  window.google_conversion_id = ${tracking.googleAds.conversionId};
  ${tracking.googleAds.conversionLabel ? `window.google_conversion_label = '${tracking.googleAds.conversionLabel}';` : ''}
  
  window.gtag_event = function(value, currency, transaction_id) {
    gtag('event', 'conversion', {
      'send_to': '${tracking.googleAds.conversionId}/${tracking.googleAds.conversionLabel || ''}',
      'value': value,
      'currency': currency,
      'transaction_id': transaction_id
    });
  };
</script>
    `.trim();

    await writeFile(join(outputDir, 'google-ads.html'), googleAdsSnippet);
  }

  // Meta Pixel snippet
  if (tracking.meta.enabled && tracking.meta.pixelId) {
    const metaSnippet = `
<!-- Meta Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  
  fbq('init', '${tracking.meta.pixelId}');
  fbq('track', 'PageView');
  
  window.trackMetaEvent = function(event, params) {
    fbq('track', event, params);
  };
</script>
    `.trim();

    await writeFile(join(outputDir, 'meta-pixel.html'), metaSnippet);
  }

  // LinkedIn Insight Tag snippet
  if (tracking.linkedin.enabled && tracking.linkedin.tagId) {
    const linkedinSnippet = `
<!-- LinkedIn Insight Tag -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.luAnalytics)return;f.luAnalytics={};
  f.luAnalytics.queue=[];
  n=f.luAnalytics.callMethod=function(e){
    f.luAnalytics.queue.push([e,arguments])
  };
  t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}
  (window, document,'script','https://snap.licdn.com/li.lms-analytics/insight.min.js');
  
  (new Image()).src ='https://pixel.ads.linkedin.com/collect/?pi=' + encodeURIComponent('${tracking.linkedin.tagId}');
  
  window.trackLinkedInEvent = function(event, params) {
    window.luAnalytics.callMethod('track', event, params);
  };
</script>
    `.trim();

    await writeFile(join(outputDir, 'linkedin.html'), linkedinSnippet);
  }

  console.log(`Tracking code snippets generated in: ${outputDir}`);
}

/**
 * Load configuration from config.json
 */
async function loadConfig() {
  const configPath = join(__dirname, '..', 'config.json');
  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

// Export for module usage
export { main };
