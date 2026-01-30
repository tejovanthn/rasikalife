# Rasika.life Documentation

This directory contains technical documentation for the Rasika.life music application architecture and implementation patterns.

## Documentation Structure

### 1. [SST-V3-IMPORT-GUIDE](./SST-V3-IMPORT-GUIDE.md)
**Purpose**: SST v3 migration and setup guide
**Covers**:
- SST v3 configuration patterns
- Import/export conventions
- Component linking strategies

### 2. [Fuse.js Search Service](./fusejs.md)
**Purpose**: Client-side search implementation
**Covers**:
- Fuse.js integration patterns
- Search indexing strategies
- Performance optimization

### 3. [Infrastructure Components](./)
**Purpose**: SST infrastructure patterns
**Available components**:
- SST Bucket configuration
- SST Cron jobs setup
- SST Function deployment patterns

## Implementation Guides

### Authentication
- **Authentication Specification**: See `../plans/250127-01c-openauth-authentication.md` for the final approved authentication implementation using SST Auth
- **DHH Feedback**: Review `../plans/250127-01c-openauth-authentication-dhh-feedback.md` for architectural decisions and simplicity principles

### Search Implementation
- **Fuse.js Integration**: Client-side search patterns and indexing strategies
- **Performance Optimization**: Search result caching and debouncing techniques

### Infrastructure Patterns
- **SST Component Architecture**: Reusable infrastructure patterns
- **DynamoDB Single Table**: Data modeling and access patterns
- **Serverless Functions**: Function composition and error handling

## Quick Start

1. **Set up SST**: Follow `SST-V3-IMPORT-GUIDE.md` for environment setup
2. **Implement Search**: Use `fusejs.md` for search functionality
3. **Add Authentication**: Review the approved authentication specification in plans/
4. **Deploy**: Use SST deployment patterns from component documentation

## Architecture Principles

- **Framework-aligned**: Use SST, Remix, and tRPC patterns as intended
- **Progressive Enhancement**: Core functionality works without authentication
- **Simple Solutions**: Start minimal, add complexity only when needed
- **Convention over Configuration**: Follow established patterns from the codebase