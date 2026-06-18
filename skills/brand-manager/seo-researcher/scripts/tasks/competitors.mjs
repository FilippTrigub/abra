#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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
 * Competitor Analysis Task
 * Discovers organic competitors via Semrush and DataForSEO. When explicit
 * competitor domains are given, compares keyword overlap (and, at
 * analysis-depth=deep, domain authority) against them.
 */
export default async function competitorsTask(args) {
  const config = { ...defaultConfig };

  if (args.domain) config.domain = args.domain;

  const namedCompetitors = (args.competitors || '').split(',').map(c => c.trim()).filter(Boolean);
  const competitorCount = parseInt(args['competitor-count'] || args.competitorCount || config.competitor_count || 5, 10);
  const analysisDepth = args['analysis-depth'] || args.analysisDepth || 'medium';

  // Validation
  if (!config.domain) {
    console.error('Error: --domain is required for competitor-alternatives');
    console.error('Usage: node scripts/run.mjs --task competitors --domain example.com');
    process.exit(1);
  }

  const domain = config.domain;
  const outputDir = config.output_dir || './output';

  console.log(`🥊 Starting Competitor Analysis for: ${domain}`);
  console.log(`   Named competitors: ${namedCompetitors.length > 0 ? namedCompetitors.join(', ') : 'none (auto-discover)'}`);
  console.log(`   Auto-discover count: ${competitorCount}`);
  console.log(`   Analysis depth: ${analysisDepth}`);
  console.log('');

  console.log('📊 Discovering organic competitors (Semrush)...');
  const semrushCompetitors = await tryProvider(() => Semrush.domainCompetitors(domain, { limit: competitorCount }));

  let dataforseoCompetitors = { status: 'skipped', reason: 'analysis-depth=shallow' };
  if (analysisDepth !== 'shallow') {
    console.log('📊 Cross-checking competitors (DataForSEO)...');
    dataforseoCompetitors = await tryProvider(() => DataForSEO.labsCompetitors(domain, { limit: competitorCount }));
  }

  let overlap = { status: 'skipped', reason: 'no --competitors provided' };
  if (namedCompetitors.length > 0 && analysisDepth !== 'shallow') {
    console.log('📊 Comparing keyword overlap with named competitors (DataForSEO)...');
    overlap = await tryProvider(() => DataForSEO.labsDomainIntersection([domain, ...namedCompetitors], {}));
  }

  let domainAuthority = { status: 'skipped', reason: 'analysis-depth != deep' };
  if (analysisDepth === 'deep') {
    console.log('📊 Comparing domain authority (Ahrefs)...');
    const targets = [domain, ...namedCompetitors];
    const ratings = await Promise.all(targets.map(t => tryProvider(() => Ahrefs.domainRatingGet(t, {}))));
    domainAuthority = targets.reduce((acc, t, i) => ({ ...acc, [t]: ratings[i] }), {});
  }
  console.log('');

  const discovered = [
    ...(semrushCompetitors.status === 'ok' && Array.isArray(semrushCompetitors.data) ? semrushCompetitors.data : []),
    ...(dataforseoCompetitors.status === 'ok'
      ? (dataforseoCompetitors.data?.tasks?.[0]?.result?.[0]?.items ?? dataforseoCompetitors.data?.tasks?.[0]?.result ?? [])
      : [])
  ];

  const competitorsResults = {
    task: 'competitor-alternatives',
    domain,
    timestamp: new Date().toISOString(),
    config: {
      competitorCount,
      analysisDepth,
      namedCompetitors
    },
    competitors: {
      discovered,
      named: namedCompetitors
    },
    overlap: overlap.status === 'ok' ? (overlap.data?.tasks?.[0]?.result ?? overlap.data) : null,
    domainAuthority: analysisDepth === 'deep' ? domainAuthority : null,
    providers: {
      semrush: semrushCompetitors,
      dataforseo: { discovery: dataforseoCompetitors, overlap },
      ahrefs: domainAuthority
    }
  };

  console.log(`✅ Competitor analysis complete for ${domain}`);
  console.log('');

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `competitors-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(competitorsResults, null, 2));
  console.log(`📁 Output written to: ${outputPath}`);

  return competitorsResults;
}
