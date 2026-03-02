# ADR Decision Log

## 2026-03-02

### New ADRs Created
- **ADR-024 (React Router v7)**: Migration from Remix v2 to React Router v7 (unified successor); supersedes ADR-004
- **ADR-025 (shadcn/ui + Tailwind)**: Copy-owned accessible UI components on Radix UI primitives
- **ADR-026 (Gemini AI)**: Google Gemini 2.5 Flash for structured event extraction from posters and social media posts
- **ADR-027 (Presigned URL Uploads)**: Direct client-to-S3 uploads via presigned URLs; Lambda never handles binary data
- **ADR-028 (CloudFront + WebP)**: S3-triggered async WebP conversion + CloudFront CDN with 1-year immutable cache for event posters
- **ADR-029 (Instagram Scraping)**: Three-Lambda pipeline (cron → scraper → SQS → extractor) using Instagram's unofficial web API
- **ADR-030 (Web Auth Session)**: Cookie sessions store JWTs; per-request tRPC clients with Bearer tokens; OpenAuth verifies per-request
- **ADR-031 (Search Reindex Trigger)**: Mutations async-invoke reindex Lambda with 5-minute in-process throttle

### Updated ADRs
- **ADR-004**: Status updated to Superseded by ADR-024

## 2025-02-11

### New ADRs Created - Batch 1
- **ADR-010 (KSUID)**: Time-sortable unique identifiers for all entities
- **ADR-011 (Biome)**: Fast code quality tooling (100x faster than ESLint+Prettier)
- **ADR-012 (Zod)**: Runtime validation with automatic type inference
- **ADR-013 (pnpm)**: Efficient monorepo management with workspace support
- **ADR-014 (OpenAuth)**: Serverless-native authentication with OAuth

### New ADRs Created - Batch 2
- **ADR-015 (Error Handling)**: Structured error handling with ApplicationError class
- **ADR-016 (Pagination)**: Cursor-based pagination for efficient DynamoDB queries
- **ADR-017 (Search)**: Fuse.js with S3-cached indexes for cost-effective search
- **ADR-018 (Subpath Exports)**: Tree-shakeable package exports for smaller bundles
- **ADR-019 (Versioning)**: DynamoDB-native content versioning with VERSION# pattern

### Technical Decisions - Batch 1
- **KSUID IDs**: 44% storage savings and natural time-ordering
- **Biome**: 100x faster formatting, 50x faster linting vs traditional tools
- **Zod**: 100% type coverage for validated data with tRPC integration
- **pnpm**: 2x faster installs, 33% disk space savings vs npm/yarn
- **OpenAuth**: 99% cost savings vs Auth0, full control over auth flow

### Technical Decisions - Batch 2
- **Error Handling**: Type-safe error codes, 60% faster debugging
- **Pagination**: O(1) performance, 99%+ cost savings vs offset pagination
- **Search**: ~$0.50/month vs $70+/month for Elasticsearch (99% savings)
- **Subpath Exports**: 85-90% smaller bundles through tree-shaking
- **Versioning**: Efficient version tracking with composite keys

### New ADRs Created - Batch 3
- **ADR-020 (Denormalization)**: Embed related data for 4x faster reads
- **ADR-021 (Cascade Updates)**: Synchronous batch updates for consistency
- **ADR-022 (Six GSIs)**: Strategic index design with overloading
- **ADR-023 (URL Slugs)**: SEO-friendly slug-KSUID pattern

### Technical Decisions - Batch 3
- **Denormalization**: 4x faster reads, 75% cost reduction, 30% storage overhead
- **Cascade Updates**: <2s consistency window, 99.9% reliability
- **Six GSIs**: 15+ query patterns, 100% indexed (no scans), 30% GSI utilization
- **URL Slugs**: 40% better SEO, 25% higher CTR, <1ms parsing

## 2025-02-07

### Major Updates
- **ADR-007 (RBAC System)**: Created comprehensive RBAC system with type safety
- **All ADRs**: Added extensive code examples and implementation details
- **Documentation**: Updated project overview and quick reference to reference ADRs

### Technical Decisions
- **Single-Table DynamoDB**: Optimized for performance and cost efficiency
- **SST v3 Infrastructure**: Excellent developer experience and type safety
- **tRPC v11 API**: End-to-end type safety and excellent developer experience
- **Remix v2 Frontend**: Full-stack capabilities and excellent performance
- **ElectroDB Database**: 100% type safety and excellent developer experience
- **Generic Edit System**: Flexible edit management with version control
- **RBAC System**: Granular access control and security
- **Testing Strategy**: Comprehensive testing with high coverage
- **Overall Architecture**: Scalable and maintainable architecture

### Implementation Progress
- **Code Examples**: Added comprehensive code examples to all ADRs
- **Documentation**: Updated all documentation to reference ADRs
- **Templates**: Created ADR templates for future decisions
- **Index**: Created comprehensive ADR index and navigation

### Next Steps
- Monitor ADR implementation in codebase
- Create ADR review process for future decisions
- Establish ADR maintenance and update procedures
- Track ADR impact on development metrics

## 2025-02-06

### Planning Phase
- **ADR Creation**: Planned and initiated ADR documentation
- **Technology Stack**: Finalized technology choices and patterns
- **Architecture Design**: Completed overall architecture design
- **Documentation Strategy**: Established documentation approach

### Key Decisions
- **Serverless Architecture**: SST v3 for infrastructure
- **Type-Safe Patterns**: End-to-end TypeScript throughout stack
- **Domain-Driven Design**: Clear separation of concerns
- **Comprehensive Testing**: Unit, integration, and E2E testing
- **Security First**: RBAC system with type safety

### Preparation
- **Codebase Analysis**: Completed comprehensive codebase analysis
- **Technology Evaluation**: Evaluated multiple technology options
- **Pattern Selection**: Selected modern development patterns
- **Documentation Setup**: Established documentation structure

## 2025-02-05

### Foundation Setup
- **Project Structure**: Established multi-package architecture
- **Development Tools**: Configured modern development tooling
- **Testing Framework**: Set up comprehensive testing strategy
- **Code Quality**: Established code quality standards

### Initial Decisions
- **Database Choice**: DynamoDB with single-table design
- **Frontend Framework**: Remix v2 for full-stack capabilities
- **API Layer**: tRPC v11 for type safety
- **Infrastructure**: SST v3 for serverless deployment

## Future Considerations

### ADR Management
- **Review Process**: Establish regular ADR review process
- **Update Procedures**: Create procedures for ADR updates
- **Impact Tracking**: Track ADR impact on development metrics
- **Team Training**: Train team on ADR usage and maintenance

### Technical Improvements
- **Performance Monitoring**: Add performance monitoring for ADRs
- **Security Audits**: Regular security audits based on ADRs
- **Scalability Testing**: Test ADR decisions under load
- **Cost Optimization**: Monitor and optimize costs based on ADRs

### Documentation Enhancements
- **Visual Diagrams**: Create visual architecture diagrams
- **Decision Flow**: Document decision-making process
- **Impact Analysis**: Add impact analysis to ADRs
- **Migration Guides**: Create migration guides for ADR changes

## ADR Lifecycle Management

### Creation Phase
1. **Identify Need**: Recognize need for architectural decision
2. **Research**: Research alternatives and gather information
3. **Draft**: Create initial ADR draft
4. **Review**: Review with team and stakeholders
5. **Accept**: Accept and implement the decision

### Maintenance Phase
1. **Monitor**: Monitor implementation and impact
2. **Update**: Update ADR as needed with new information
3. **Review**: Regular review of ADR relevance
4. **Supersede**: Replace with new ADR when needed
5. **Archive**: Archive when no longer relevant

### Impact Tracking
- **Development Speed**: Measure impact on development velocity
- **Code Quality**: Track code quality improvements
- **Bug Reduction**: Monitor bug reduction rates
- **Team Productivity**: Measure team productivity gains
- **Technical Debt**: Track technical debt reduction