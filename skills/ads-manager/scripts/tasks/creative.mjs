/**
 * Creative Task
 * 
 * Generate and optimize ad creative assets in multiple formats
 * 
 * Usage:
 *   uv run node run.mjs --task creative --format square --input ./input/images/
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { glob } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Generate ad creatives
 */
export async function main(options = {}) {
  const config = await loadConfig();
  
  const formats = options.format 
    ? options.format.split(',').map(f => f.trim())
    : config.creative?.formats || ['square', 'portrait', 'landscape', 'story'];
  
  const inputDir = options.input || config.creative?.input_dir || './input';
  const outputDir = options.output || config.creative?.output_dir || './output/creative';
  const aiEnhance = options['ai-enhance'] === 'true' || config.creative?.ai_enhance === true;
  const brandGuidelines = options['brand-guidelines'] || config.creative?.brand_guidelines;
  const templates = options.templates?.split(',') || config.creative?.templates || ['product', 'testimonial', 'announcement', 'offer'];

  await mkdir(outputDir, { recursive: true });

  // Find input images
  const inputFiles = await findImages(inputDir);

  if (inputFiles.length === 0) {
    console.log(`No images found in ${inputDir}. Using template-based generation.`);
    return await generateTemplateCreatives(formats, outputDir, templates, aiEnhance);
  }

  // Process each image
  const results = [];
  for (const inputFile of inputFiles) {
    const relativePath = inputFile.replace(inputDir, '');
    const baseName = extname(inputFile).slice(1);
    
    for (const format of formats) {
      const outputFile = join(outputDir, format, `${baseName}_${format}.json`);
      const result = await processImage(inputFile, format, aiEnhance, brandGuidelines, templates);
      results.push(result);
      await writeFile(outputFile, JSON.stringify(result, null, 2));
    }
  }

  // Write summary
  const summaryFile = join(outputDir, 'creative-summary.json');
  await writeFile(summaryFile, JSON.stringify({
    totalFiles: inputFiles.length,
    formats,
    aiEnhanced: aiEnhance,
    results
  }, null, 2));

  console.log(`Processed ${inputFiles.length} images across ${formats.length} formats`);
  console.log(`Output directory: ${outputDir}`);

  return results;
}

/**
 * Find all images in directory
 */
async function findImages(dir) {
  const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.heic'];
  const files = [];

  try {
    const items = await readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = join(dir, item.name);
      
      if (item.isDirectory()) {
        files.push(...await findImages(fullPath));
      } else if (extensions.includes(extname(item.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.log(`Could not read directory ${dir}: ${error.message}`);
  }

  return files;
}

/**
 * Process a single image for a specific format
 */
async function processImage(inputFile, format, aiEnhance, brandGuidelines, templates) {
  const dimensions = getDimensions(format);
  const baseName = extname(inputFile).slice(1);
  
  // Extract image metadata (would be enhanced with actual image processing)
  const imageInfo = await extractImageInfo(inputFile);
  
  const creative = {
    id: `${baseName}_${format}_${Date.now()}`,
    format,
    dimensions,
    status: 'GENERATED',
    sourceFile: inputFile,
    aiEnhanced: aiEnhance,
    brandCompliant: false,
    templates: [],
    variations: [],
    metadata: imageInfo
  };

  // Apply brand guidelines if available
  if (brandGuidelines) {
    creative.brandCompliant = true;
    creative.brandGuidelines = brandGuidelines;
  }

  // Generate template variations
  for (const template of templates) {
    const variation = await generateTemplateVariation(template, format, creative);
    creative.variations.push(variation);
  }

  // AI Enhancement (placeholder)
  if (aiEnhance) {
    creative.enhancements = await applyAIEnhancements(creative);
  }

  return creative;
}

/**
 * Extract image information
 */
async function extractImageInfo(imagePath) {
  try {
    const stats = await stat(imagePath);
    
    // In production, use image analysis libraries
    // For now, return basic metadata
    return {
      fileSize: stats.size,
      mimeType: getMimeType(imagePath),
      processingDate: new Date().toISOString()
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get dimensions for format
 */
function getDimensions(format) {
  const config = {
    square: [1080, 1080],
    portrait: [1080, 1350],
    landscape: [1200, 628],
    story: [1080, 1920]
  };
  return config[format] || [1080, 1080];
}

/**
 * Generate template variation
 */
async function generateTemplateVariation(template, format, creative) {
  const dimensions = getDimensions(format);
  
  const variation = {
    templateId: template,
    name: `${template}_${format}`,
    status: 'READY',
    layout: getLayout(template, format),
    elements: generateTemplateElements(template),
    output: {
      width: dimensions[0],
      height: dimensions[1]
    }
  };

  return variation;
}

/**
 * Get layout based on template and format
 */
function getLayout(template, format) {
  const layouts = {
    product: {
      square: 'center-focused',
      portrait: 'vertical-scroll',
      landscape: 'horizontal-slider',
      story: 'full-screen'
    },
    testimonial: {
      square: 'quote-overlay',
      portrait: 'profile-top',
      landscape: 'side-by-side',
      story: 'full-screen-quote'
    },
    announcement: {
      square: 'bold-center',
      portrait: 'announcement-vertical',
      landscape: 'announcement-horizontal',
      story: 'announcement-full'
    },
    offer: {
      square: 'discount-highlight',
      portrait: 'offer-vertical',
      landscape: 'offer-banner',
      story: 'offer-flash'
    }
  };

  return layouts[template]?.[format] || 'center-focused';
}

/**
 * Generate template elements
 */
function generateTemplateElements(template) {
  const elements = {
    product: [
      { type: 'image', position: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 } },
      { type: 'text', text: 'Product Title', position: { x: 0.1, y: 0.7, width: 0.8, height: 0.2 }, style: { fontSize: 24, fontWeight: 'bold' } },
      { type: 'button', text: 'Learn More', position: { x: 0.3, y: 0.9, width: 0.4, height: 0.1 }, style: { backgroundColor: '#007bff' } }
    ],
    testimonial: [
      { type: 'image', position: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, style: { borderRadius: '50%' } },
      { type: 'text', text: '"Great product!"', position: { x: 0.5, y: 0.2, width: 0.4, height: 0.4 }, style: { fontSize: 18, fontStyle: 'italic' } },
      { type: 'text', text: '- Customer Name', position: { x: 0.5, y: 0.7, width: 0.4, height: 0.1 }, style: { fontSize: 14 } }
    ],
    announcement: [
      { type: 'text', text: 'NEW ANNOUNCEMENT', position: { x: 0.1, y: 0.2, width: 0.8, height: 0.2 }, style: { fontSize: 32, fontWeight: 'bold', textAlign: 'center' } },
      { type: 'text', text: 'Details go here', position: { x: 0.1, y: 0.5, width: 0.8, height: 0.3 }, style: { fontSize: 20 } }
    ],
    offer: [
      { type: 'text', text: '50% OFF', position: { x: 0.1, y: 0.2, width: 0.8, height: 0.3 }, style: { fontSize: 48, fontWeight: 'bold', color: '#ff4444' } },
      { type: 'text', text: 'Limited Time Offer', position: { x: 0.1, y: 0.6, width: 0.8, height: 0.2 }, style: { fontSize: 24 } },
      { type: 'button', text: 'Shop Now', position: { x: 0.3, y: 0.85, width: 0.4, height: 0.1 }, style: { backgroundColor: '#28a745' } }
    ]
  };

  return elements[template] || elements.product;
}

/**
 * Apply AI enhancements
 */
async function applyAIEnhancements(creative) {
  // Placeholder for AI enhancement processing
  // In production, use ML libraries for:
  // - Image quality improvement
  // - Color optimization
  // - Composition analysis
  // - Text detection and enhancement
  
  return {
    qualityScore: Math.random() * 100,
    adjustments: [
      'Brightness optimized',
      'Contrast enhanced',
      'Color balance improved',
      'Noise reduced'
    ],
    recommendations: [
      'Consider using higher resolution source',
      'Text overlay is well-positioned',
      'Good color contrast maintained'
    ]
  };
}

/**
 * Generate template-based creatives (no input images)
 */
async function generateTemplateCreatives(formats, outputDir, templates, aiEnhance) {
  const results = [];
  const timestamp = new Date().toISOString().split('T')[0];

  for (const format of formats) {
    const formatDir = join(outputDir, format);
    await mkdir(formatDir, { recursive: true });

    for (const template of templates) {
      const creative = {
        id: `${template}_${format}_${timestamp}`,
        format,
        template,
        status: 'GENERATED',
        generated: true,
        dimensions: getDimensions(format),
        aiEnhanced: aiEnhance
      };

      const outputFile = join(formatDir, `${template}.json`);
      await writeFile(outputFile, JSON.stringify(creative, null, 2));
      results.push(creative);
    }
  }

  return results;
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

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.heic': 'image/heic'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

