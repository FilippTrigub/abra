#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { GSC } from '../../../../_providers/marketing/gsc.mjs';
import { Semrush } from '../../../../_providers/marketing/semrush.mjs';
import { Ahrefs } from '../../../../_providers/marketing/ahrefs.mjs';
import { Plausible } from '../../../../_providers/marketing/plausible.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
const configPath = join(__dirname, '..', '..', 'config.json');
const defaultConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

async function tryProvider(fn) {
  try {
    return { status: 'ok', data: await fn() };
  } catch (error) {
    return { status: 'unavailable', reason: error.message };
  }
}

/**
 * AI SEO Task
 * Generates keyword and content recommendations using Google Search Console,
 * Semrush, Ahrefs, and Plausible traffic data.
 */
export default async function aiseoTask(args) {
  const config = { ...defaultConfig };

  // Merge CLI args
  if (args.domain) config.domain = args.domain;
  if (args.keywords) config.keywords = args.keywords.split(',').map(k => k.trim());
  if (args.outputFormat) config.outputFormat = args.outputFormat;
  if (args.includeSuggestions !== undefined) config.includeSuggestions = args.includeSuggestions === 'true' || args.includeSuggestions === true;

  // Validation
  if (!config.domain) {
    console.error('Error: --domain is required for ai-seo');
    console.error('Usage: node scripts/run.mjs --task aiseo --domain example.com');
    process.exit(1);
  }

  const domain = config.domain;
  const keywords = config.keywords || [];
  const outputDir = config.output_dir || './output';

  console.log(`🤖 Starting AI SEO analysis for: ${domain}`);
  console.log(`   Keywords: ${keywords.length > 0 ? keywords.join(', ') : 'auto-discover'}`);
  console.log(`   Output format: ${config.outputFormat || 'json'}`);
  console.log(`   Include content suggestions: ${config.includeSuggestions}`);
  console.log('');

  console.log('📊 Analyzing current keyword rankings (Google Search Console)...');
  const gscQueries = await tryProvider(() => GSC.searchQuery(domain, { limit: 25 }));

  console.log('📊 Identifying keyword opportunities (Semrush)...');
  const keywordOpportunities = await tryProvider(() =>
    keywords.length > 0 ? Semrush.keywordsRelated(keywords[0], {}) : Semrush.domainOrganic(domain, {})
  );

  console.log('📊 Generating content recommendations (Ahrefs)...');
  const contentSuggestions = await tryProvider(() => Ahrefs.keywordSuggestionsGet(keywords.join(',') || domain, {}));

  console.log('📊 Optimizing URL structures (Ahrefs)...');
  const topPages = await tryProvider(() => Ahrefs.topPagesList(domain, {}));

  console.log('📊 Validating against site traffic (Plausible)...');
  const plausibleSiteId = process.env.PLAUSIBLE_SITE_ID || domain;
  const trafficStats = process.env.PLAUSIBLE_SITE_ID
    ? await tryProvider(() => Plausible.statsPages(plausibleSiteId, {}))
    : { status: 'unavailable', reason: 'PLAUSIBLE_SITE_ID not configured' };
  console.log('');

  const gscRows = gscQueries.status === 'ok' ? (gscQueries.data?.rows ?? []) : [];
  const lowCtrHighImpression = gscRows.filter(row => (row.impressions ?? 0) > 50 && (row.ctr ?? 1) < 0.03);

  const aiSeoResults = {
    task: 'ai-seo',
    domain,
    timestamp: new Date().toISOString(),
    config: {
      keywords,
      outputFormat: config.outputFormat || 'json',
      includeSuggestions: config.includeSuggestions
    },
    keywordAnalysis: {
      opportunities: keywordOpportunities.status === 'ok' && Array.isArray(keywordOpportunities.data) ? keywordOpportunities.data : [],
      gaps: gscRows,
      trends: []
    },
    contentRecommendations: contentSuggestions.status === 'ok' ? (contentSuggestions.data?.matching_terms ?? contentSuggestions.data ?? []) : [],
    metaSuggestions: lowCtrHighImpression.map(row => ({
      query: row.keys?.[0],
      impressions: row.impressions,
      ctr: row.ctr,
      suggestion: 'Low CTR for high-impression query — revisit title/meta description'
    })),
    urlOptimizations: topPages.status === 'ok' ? (topPages.data?.pages ?? (Array.isArray(topPages.data) ? topPages.data : [])) : [],
    providers: {
      gsc: gscQueries,
      semrush: keywordOpportunities,
      ahrefs: { contentSuggestions, topPages },
      plausible: trafficStats
    }
  };

  console.log(`✅ AI SEO analysis complete for ${domain}`);
  console.log('');

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `ai-seo-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(aiSeoResults, null, 2));
  console.log(`📁 Output written to: ${outputPath}`);

  return aiSeoResults;
}
