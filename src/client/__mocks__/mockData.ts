/**
 * Example Mock Data for MockAppSheetClient
 *
 * **IMPORTANT:** These are generic example data for quick testing purposes.
 * For production tests in your project, create a project-specific MockDataProvider
 * implementation instead of using these example data.
 *
 * Provides example test data for service portfolios, areas, and categories.
 * Uses UUIDs for IDs and generic English service names.
 *
 * @see MockDataProvider for implementing project-specific mock data
 * @module client
 * @category Client
 * @example
 * ```typescript
 * // DON'T: Use example data in production tests
 * const { services } = createDefaultMockData();
 *
 * // DO: Create project-specific mock data provider
 * class MyProjectMockData implements MockDataProvider {
 *   getTables(): Map<string, TableData> {
 *     const tables = new Map();
 *     tables.set('service_portfolio', {
 *       rows: [
 *         { service_portfolio_id: 'service-001', service: 'My Service' }
 *       ],
 *       keyField: 'service_portfolio_id'
 *     });
 *     return tables;
 *   }
 * }
 * ```
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Service Portfolio Mock Data
 *
 * Represents services in the TechDivision service portfolio.
 */
export interface ServicePortfolio {
  service_portfolio_id: string;
  service: string;
  area_id_fk: string;
  category_id_fk: string;
  flight_level?: string;
  method_toolkit?: string;
  clarifying_question?: string;
  result_deliverable?: string;
  activity_field?: string;
  teams?: string;
  type?: string;
  solution?: string;
  status: 'Akzeptiert' | 'Vorgeschlagen' | 'Deprecated';
  created_at: string;
  created_by: string;
  modified_at?: string;
  modified_by?: string;
}

/**
 * Area Mock Data
 */
export interface Area {
  area_id: string;
  name: string;
  description?: string;
}

/**
 * Category Mock Data
 */
export interface Category {
  category_id: string;
  name: string;
  description?: string;
}

/**
 * Generate mock areas (3 total)
 */
export function generateMockAreas(): Area[] {
  return [
    {
      area_id: uuidv4(),
      name: 'Consulting',
      description: 'Beratungsleistungen und Strategie',
    },
    {
      area_id: uuidv4(),
      name: 'Solutions',
      description: 'Technische Lösungsentwicklung',
    },
    {
      area_id: uuidv4(),
      name: 'Operations',
      description: 'Betrieb und Support',
    },
  ];
}

/**
 * Generate mock categories (4 total)
 */
export function generateMockCategories(): Category[] {
  return [
    {
      category_id: uuidv4(),
      name: 'Development',
      description: 'Softwareentwicklung',
    },
    {
      category_id: uuidv4(),
      name: 'Architecture',
      description: 'Systemarchitektur',
    },
    {
      category_id: uuidv4(),
      name: 'DevOps',
      description: 'CI/CD und Infrastruktur',
    },
    {
      category_id: uuidv4(),
      name: 'Quality Assurance',
      description: 'Testing und Qualitätssicherung',
    },
  ];
}

/**
 * Generate mock services (50 total)
 *
 * @param areas - Array of areas to link services to
 * @param categories - Array of categories to link services to
 */
export function generateMockServices(areas: Area[], categories: Category[]): ServicePortfolio[] {
  const services: ServicePortfolio[] = [];
  const statuses: Array<'Akzeptiert' | 'Vorgeschlagen' | 'Deprecated'> = [
    'Akzeptiert',
    'Vorgeschlagen',
    'Deprecated',
  ];
  const flightLevels = ['1', '2', '3'];

  // Service name templates
  const serviceTemplates = [
    'API Development',
    'Microservices Architecture',
    'Cloud Migration',
    'Performance Optimization',
    'Security Audit',
    'Code Review',
    'CI/CD Pipeline',
    'Database Design',
    'Frontend Development',
    'Backend Development',
    'Mobile App Development',
    'System Integration',
    'Data Migration',
    'Infrastructure Setup',
    'Monitoring Setup',
    'Logging Implementation',
    'Authentication Service',
    'Authorization Framework',
    'Payment Gateway Integration',
    'Email Service',
    'Notification System',
    'Search Implementation',
    'Caching Strategy',
    'Load Balancing',
    'Container Orchestration',
    'Serverless Functions',
    'Message Queue Setup',
    'Event Streaming',
    'GraphQL API',
    'REST API',
    'WebSocket Implementation',
    'gRPC Service',
    'Service Mesh',
    'API Gateway',
    'Rate Limiting',
    'Data Analytics',
    'Machine Learning Pipeline',
    'Report Generation',
    'Dashboard Development',
    'User Management',
    'Role-Based Access Control',
    'OAuth2 Implementation',
    'SSO Integration',
    'MFA Setup',
    'Backup Strategy',
    'Disaster Recovery',
    'High Availability Setup',
    'Multi-Region Deployment',
    'Content Delivery Network',
    'WAF Configuration',
  ];

  // Generate 50 services
  for (let i = 0; i < 50; i++) {
    const area = areas[i % areas.length];
    const category = categories[i % categories.length];
    const status = statuses[i % statuses.length];
    const flightLevel = flightLevels[i % flightLevels.length];

    services.push({
      service_portfolio_id: uuidv4(),
      service: serviceTemplates[i],
      area_id_fk: area.area_id,
      category_id_fk: category.category_id,
      flight_level: flightLevel,
      method_toolkit: `Toolkit ${i + 1}`,
      clarifying_question: `Wie implementieren wir ${serviceTemplates[i]}?`,
      result_deliverable: `Deliverable für ${serviceTemplates[i]}`,
      activity_field: `Activity ${i + 1}`,
      teams: i % 2 === 0 ? 'Team Alpha' : 'Team Beta',
      type: i % 3 === 0 ? 'Platform' : 'Application',
      solution: `Solution für ${serviceTemplates[i]}`,
      status,
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      created_by: 'mock@example.com',
      modified_at: i % 5 === 0 ? new Date(Date.now() - i * 43200000).toISOString() : undefined,
      modified_by: i % 5 === 0 ? 'modifier@example.com' : undefined,
    });
  }

  return services;
}

/**
 * Create default mock dataset.
 *
 * Generates consistent test data with:
 * - 3 areas
 * - 4 categories
 * - 50 services
 *
 * @returns Object with areas, categories, and services
 */
export function createDefaultMockData(): {
  areas: Area[];
  categories: Category[];
  services: ServicePortfolio[];
} {
  const areas = generateMockAreas();
  const categories = generateMockCategories();
  const services = generateMockServices(areas, categories);

  return { areas, categories, services };
}
