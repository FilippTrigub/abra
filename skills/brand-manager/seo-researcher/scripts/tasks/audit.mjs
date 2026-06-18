#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { GSC } from '../../../../_providers/marketing/gsc.mjs';
import { Semrush } from '../../../../_providers/marketing/semrush.mjs';
import { Ahrefs } from '../../../../_providers/marketing/ahrefs.mjs';
import { DataForSEO } from '../../../../_providers/marketing/dataforseo.mjs';

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
 * SEO Audit Task
 * Performs a site audit using DataForSEO (on-page), Ahrefs (top pages),
 * Semrush (domain overview), and Google Search Console (sitemaps).
 */
export default async function auditTask(args) {
  const config = { ...defaultConfig };

  // Merge CLI args
  if (args.domain) config.domain = args.domain;
  if (args.maxPages) config.maxPages = parseInt(args.maxPages, 10);
  if (args.includeSitemaps !== undefined) config.includeSitemaps = args.includeSitemaps === 'true' || args.includeSitemaps === true;
  if (args.includeRobots !== undefined) config.includeRobots = args.includeRobots === 'true' || args.includeRobots === true;

  // Validation
  if (!config.domain) {
    console.error('Error: --domain is required for seo-audit');
    console.error('Usage: node scripts/run.mjs --task audit --domain example.com');
    process.exit(1);
  }

  const domain = config.domain;
  const outputDir = config.output_dir || './output';

  console.log(`🔍 Starting SEO audit for: ${domain}`);
  console.log(`   Max pages: ${config.maxPages || 100}`);
  console.log(`   Include sitemaps: ${config.includeSitemaps}`);
  console.log(`   Include robots.txt: ${config.includeRobots}`);
  console.log('');

  console.log('📊 Auditing on-page structure and meta tags (DataForSEO)...');
  const onPage = await tryProvider(() => DataForSEO.onpageAudit(domain, {}));

  console.log('📊 Validating internal links and top pages (Ahrefs)...');
  const topPages = await tryProvider(() => Ahrefs.topPagesList(domain, { limit: config.maxPages || 100 }));

  console.log('📊 Checking domain authority and visibility (Semrush)...');
  const domainOverview = await tryProvider(() => Semrush.domainOverview(domain, {}));

  let sitemaps = { status: 'skipped', reason: 'includeSitemaps disabled' };
  if (config.includeSitemaps) {
    console.log('📊 Fetching sitemaps (Google Search Console)...');
    sitemaps = await tryProvider(() => GSC.listSitemaps(domain));
  }
  console.log('');

  const onPageResults = onPage.status === 'ok' ? (onPage.data?.tasks?.[0]?.result ?? []) : [];
  const topPagesResults = topPages.status === 'ok' ? (topPages.data?.pages ?? (Array.isArray(topPages.data) ? topPages.data : [])) : [];
  const domainOverviewResult = domainOverview.status === 'ok' && Array.isArray(domainOverview.data) ? domainOverview.data[0] ?? null : null;
  const sitemapResults = sitemaps.status === 'ok' ? (sitemaps.data?.sitemap ?? []) : [];

  const auditResults = {
    task: 'seo-audit',
    domain,
    timestamp: new Date().toISOString(),
    config: {
      maxPages: config.maxPages || 100,
      includeSitemaps: config.includeSitemaps,
      includeRobots: config.includeRobots
    },
    findings: {
      critical: [],
      warnings: [],
      info: []
    },
    pages: onPageResults.length ? onPageResults : topPagesResults,
    domainOverview: domainOverviewResult,
    sitemaps: sitemapResults,
    robots: null,
    recommendations: [],
    providers: {
      dataforseo: onPage,
      ahrefs: topPages,
      semrush: domainOverview,
      gsc: sitemaps
    }
  };

  console.log(`✅ Audit complete for ${domain}`);
  console.log('');

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `seo-audit-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(auditResults, null, 2));
  console.log(`📁 Output written to: ${outputPath}`);

  return auditResults;
}
