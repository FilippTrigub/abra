/**
 * Free Tools Strategy Discovery
 * 
 * Discovers and recommends free marketing tools across various categories
 * to enhance marketing strategies without increasing costs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Comprehensive list of free marketing tools by category
 */
const FREE_TOOLS_DATABASE = {
  social_media: [
    {
      name: 'Buffer',
      category: 'social_media',
      features: ['Schedule posts', 'Analytics', 'Team collaboration'],
      free_tier: '3 channels, 10 scheduled posts per channel',
      best_for: 'Small businesses starting with social media',
      url: 'https://buffer.com',
      rating: 4.5
    },
    {
      name: 'Canva',
      category: 'social_media',
      features: ['Design templates', 'Brand kit', 'Content calendar'],
      free_tier: 'Unlimited designs, 5GB storage',
      best_for: 'Creating professional social media graphics',
      url: 'https://canva.com',
      rating: 4.7
    },
    {
      name: 'Later',
      category: 'social_media',
      features: ['Visual calendar', 'Link in bio', 'User-generated content'],
      free_tier: '5 posts per platform per month',
      best_for: 'Instagram-focused marketing',
      url: 'https://later.com',
      rating: 4.3
    },
    {
      name: 'Hootsuite',
      category: 'social_media',
      features: ['Multi-platform scheduling', 'Social listening', 'Reports'],
      free_tier: '2 social accounts, 5 scheduled posts',
      best_for: 'Managing multiple social accounts',
      url: 'https://hootsuite.com',
      rating: 4.2
    }
  ],
  analytics: [
    {
      name: 'Google Analytics',
      category: 'analytics',
      features: ['Traffic analysis', 'User behavior', 'Conversion tracking'],
      free_tier: 'Unlimited data collection',
      best_for: 'Comprehensive website analytics',
      url: 'https://analytics.google.com',
      rating: 4.6
    },
    {
      name: 'Google Search Console',
      category: 'analytics',
      features: ['SEO monitoring', 'Keyword rankings', 'Index coverage'],
      free_tier: 'Unlimited',
      best_for: 'Understanding search engine performance',
      url: 'https://searchconsole.google.com',
      rating: 4.5
    },
    {
      name: 'Hotjar',
      category: 'analytics',
      features: ['Heatmaps', 'Session recordings', 'Feedback polls'],
      free_tier: '100 pageviews/day, 3 heatmaps',
      best_for: 'Understanding user behavior on site',
      url: 'https://hotjar.com',
      rating: 4.4
    },
    {
      name: 'Microsoft Clarity',
      category: 'analytics',
      features: ['Heatmaps', 'Session recordings', 'Duration filtering'],
      free_tier: 'Unlimited',
      best_for: 'Complementary analytics to Google Analytics',
      url: 'https://clarity.microsoft.com',
      rating: 4.3
    }
  ],
  design: [
    {
      name: 'Canva',
      category: 'design',
      features: ['Templates', 'Brand kit', 'Resize tool'],
      free_tier: 'Unlimited designs, 5GB storage',
      best_for: 'All-in-one design platform',
      url: 'https://canva.com',
      rating: 4.7
    },
    {
      name: 'GIMP',
      category: 'design',
      features: ['Photo editing', 'Retouching', 'Custom workflows'],
      free_tier: 'Full featured, open source',
      best_for: 'Advanced image editing without cost',
      url: 'https://gimp.org',
      rating: 4.1
    },
    {
      name: 'Inkscape',
      category: 'design',
      features: ['Vector graphics', 'Illustration', 'Logo design'],
      free_tier: 'Full featured, open source',
      best_for: 'Vector-based design work',
      url: 'https://inkscape.org',
      rating: 4.0
    },
    {
      name: 'Figma',
      category: 'design',
      features: ['UI/UX design', 'Prototyping', 'Team collaboration'],
      free_tier: '3 projects, unlimited files',
      best_for: 'Web and app design collaboration',
      url: 'https://figma.com',
      rating: 4.8
    }
  ],
  automation: [
    {
      name: 'Zapier',
      category: 'automation',
      features: ['Workflow automation', 'App integrations', 'Multi-step zaps'],
      free_tier: '100 tasks/month, 5 zaps',
      best_for: 'Connecting apps without coding',
      url: 'https://zapier.com',
      rating: 4.6
    },
    {
      name: 'Make (Integromat)',
      category: 'automation',
      features: ['Visual automation', 'Complex workflows', 'Error handling'],
      free_tier: '1,000 operations/month',
      best_for: 'Complex automation scenarios',
      url: 'https://make.com',
      rating: 4.5
    },
    {
      name: 'n8n',
      category: 'automation',
      features: ['Self-hostable', 'Node-based workflow', 'Custom code'],
      free_tier: 'Free for self-hosted',
      best_for: 'Technical teams wanting full control',
      url: 'https://n8n.io',
      rating: 4.4
    },
    {
      name: 'Automattic',
      category: 'automation',
      features: ['Email automation', 'Campaign management', 'Subscriber segmentation'],
      free_tier: 'Limited free tier available',
      best_for: 'Newsletter and email marketing',
      url: 'https://automattic.com',
      rating: 4.2
    }
  ],
  content: [
    {
      name: 'Grammarly',
      category: 'content',
      features: ['Grammar checking', 'Tone detection', 'Plagiarism detection'],
      free_tier: 'Basic grammar and spelling',
      best_for: 'Improving writing quality',
      url: 'https://grammarly.com',
      rating: 4.6
    },
    {
      name: 'Hemingway App',
      category: 'content',
      features: ['Readability scoring', 'Complex sentence highlighting', 'Passive voice detection'],
      free_tier: 'Web version free',
      best_for: 'Making content more readable',
      url: 'https://hemingwayapp.com',
      rating: 4.3
    },
    {
      name: 'Unsplash',
      category: 'content',
      features: ['Free stock photos', 'High-resolution images', 'Commercial use allowed'],
      free_tier: 'Unlimited free downloads',
      best_for: 'Finding professional-quality images',
      url: 'https://unsplash.com',
      rating: 4.8
    },
    {
      name: 'Pexels',
      category: 'content',
      features: ['Free stock photos & videos', 'No attribution required', 'Commercial use'],
      free_tier: 'Unlimited free downloads',
      best_for: 'Video and image content creation',
      url: 'https://pexels.com',
      rating: 4.7
    }
  ],
  email: [
    {
      name: 'Mailchimp',
      category: 'email',
      features: ['Email campaigns', 'Audience management', 'Marketing automation'],
      free_tier: 'Up to 500 contacts, 1,000 sends/month',
      best_for: 'Email marketing beginners',
      url: 'https://mailchimp.com',
      rating: 4.3
    },
    {
      name: 'MailerLite',
      category: 'email',
      features: ['Drag-and-drop builder', 'Automation workflows', 'Landing pages'],
      free_tier: 'Up to 1,000 subscribers, 12,000 emails/month',
      best_for: 'Cost-effective email marketing',
      url: 'https://mailerlite.com',
      rating: 4.5
    },
    {
      name: 'Sendinblue',
      category: 'email',
      features: ['Email marketing', 'SMS marketing', 'CRM'],
      free_tier: 'Unlimited contacts, 300 emails/day',
      best_for: 'Growing businesses with contact lists',
      url: 'https://sendinblue.com',
      rating: 4.4
    },
    {
      name: 'Brevo',
      category: 'email',
      features: ['Email campaigns', 'Transactional emails', 'SMS marketing'],
      free_tier: 'Unlimited contacts, 300 emails/day',
      best_for: 'Marketing automation on a budget',
      url: 'https://brevo.com',
      rating: 4.3
    }
  ]
};

/**
 * Tool matching logic based on needs
 */
function matchToolsToNeeds(needs, categories) {
  const matchedTools = [];
  
  Object.entries(FREE_TOOLS_DATABASE).forEach(([category, tools]) => {
    if (!categories || categories.includes(category)) {
      tools.forEach(tool => {
        const relevanceScore = calculateRelevance(tool, needs);
        if (relevanceScore > 0.5) {
          matchedTools.push({
            ...tool,
            relevance_score: relevanceScore
          });
        }
      });
    }
  });

  return matchedTools.sort((a, b) => b.relevance_score - a.relevance_score);
}

function calculateRelevance(tool, needs) {
  let score = 0.5;
  
  // Match by best_for keywords
  const keywords = ['small', 'beginner', 'team', 'marketing', 'design', 'analytics'];
  keywords.forEach(keyword => {
    if (tool.best_for.toLowerCase().includes(keyword) && 
        needs.some(n => n.toLowerCase().includes(keyword))) {
      score += 0.15;
    }
  });

  // Bonus for high ratings
  if (tool.rating >= 4.5) score += 0.1;
  
  return Math.min(score, 1.0);
}

/**
 * Generate tool recommendations
 */
export async function generateToolRecommendations(config) {
  const {
    tools_categories = ['social_media', 'analytics', 'design', 'automation'],
    output_format = 'markdown'
  } = config;

  const matchedTools = matchToolsToNeeds([], tools_categories);

  const recommendations = {
    success: true,
    data: {
      configuration: { tools_categories },
      total_tools: matchedTools.length,
      tools_by_category: {},
      top_picks: matchedTools.slice(0, 5),
      all_tools: matchedTools
    }
  };

  // Group by category
  matchedTools.forEach(tool => {
    if (!recommendations.data.tools_by_category[tool.category]) {
      recommendations.data.tools_by_category[tool.category] = [];
    }
    recommendations.data.tools_by_category[tool.category].push(tool);
  });

  return recommendations;
}

/**
 * Format recommendations as markdown
 */
export function formatRecommendationsAsMarkdown(result) {
  const { configuration, total_tools, tools_by_category, top_picks } = result.data;

  let markdown = `# Free Marketing Tools Recommendations

**Categories Explored**: ${configuration.tools_categories.join(', ')}
**Total Tools Found**: ${total_tools}

---

## 🏆 Top Picks

`;

  top_picks.forEach((tool, index) => {
    markdown += `### ${index + 1}. ${tool.name} ⭐ ${tool.rating}/5

**Category**: ${tool.category}
**Best For**: ${tool.best_for}
**Free Tier**: ${tool.free_tier}

[${tool.name} - Visit Website](${tool.url})

---

`;
  });

  markdown += `## 📂 Tools by Category

`;

  Object.entries(tools_by_category).forEach(([category, tools]) => {
    markdown += `### ${formatCategoryTitle(category)}

`;
    tools.forEach(tool => {
      markdown += `#### ${tool.name} ⭐ ${tool.rating}/5

**Features**: ${tool.features.join(', ')}

**Free Tier**: ${tool.free_tier}

**Best For**: ${tool.best_for}

[${tool.name} - Visit Website](${tool.url})

`;
    });
  });

  markdown += `## 💡 Implementation Tips

1. **Start with 2-3 tools** - Don't overwhelm yourself with too many options
2. **Test the free tiers** - Most tools offer generous free plans
3. **Create a tool stack** - Combine complementary tools (e.g., Canva + Buffer + Google Analytics)
4. **Set up tracking** - Use analytics tools to measure tool effectiveness
5. **Review quarterly** - Reassess if free tiers still meet your needs

---

## 🔄 Free to Paid Upgrade Paths

| Tool | When to Consider Paid | Starting Price |
|------|----------------------|----------------|
| Buffer | Need more than 3 channels | ~$6/month |
| Canva | Need Brand Kit Pro | ~$12.99/month |
| Mailchimp | Surpassing 500 contacts | ~$13/month |
| Hotjar | Need more than 100 pageviews/day | ~$39/month |
| Zapier | Need unlimited tasks | ~$20/month |

`;

  return markdown;
}

function formatCategoryTitle(category) {
  return category.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

/**
 * Execute the freetools task
 */
export async function executeFreetoolsTask(config) {
  const result = await generateToolRecommendations(config);
  const markdown = formatRecommendationsAsMarkdown(result);
  
  result.output = markdown;
  return result;
}

export default executeFreetoolsTask;
