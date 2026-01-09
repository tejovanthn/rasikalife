# OpenCode DHH-Style Architecture Setup

This setup provides a complete workflow for developing high-quality specifications using a multi-agent approach inspired by DHH's philosophy, adapted for JavaScript/TypeScript, Remix, and SST.dev.

## What's Included

### Agents

Six specialized agents for different aspects of development:

**Core Architecture Agents:**

1. **dhh-code-reviewer** - An elite code reviewer channeling DHH's exacting standards
   - Reviews specs and code against framework best practices
   - Provides direct, constructive feedback
   - Ensures code is elegant, simple, and framework-idiomatic

2. **application-architect** - Designs comprehensive technical specifications
   - Analyzes requirements and existing codebase
   - Creates detailed technical designs
   - Plans implementation steps

3. **docs-fetcher** - Retrieves and summarizes external documentation
   - Fetches docs from URLs, GitHub, npm packages
   - Creates concise, actionable summaries
   - Organizes documentation for easy reference

**Specialized Agents:**

4. **technical-writer** - Creates and reviews documentation
   - Writes clear, comprehensive documentation
   - Reviews docs for clarity and completeness
   - Specializes in README files, API docs, and guides

5. **test-engineer** - Writes comprehensive tests
   - Unit tests with Vitest
   - Integration tests for routes and components
   - E2E tests with Playwright
   - Ensures code quality through testing

6. **frontend-designer** - UI/UX design and review
   - Creates beautiful, accessible interfaces
   - Reviews designs for usability and accessibility
   - Expert in modern design patterns and best practices

### Commands

**architecture** - Orchestrates the multi-agent workflow:
1. Clarifies requirements with the user
2. Fetches necessary documentation
3. Creates first spec iteration with Application Architect
4. Reviews with DHH Code Reviewer
5. Iterates 2 more times (architect → reviewer → architect)
6. Provides clear summary of final spec

### Skills

Ten comprehensive skill documents that agents can reference:

**Core Stack Skills:**

1. **sst-dev** - SST.dev best practices and patterns
   - Resource bindings and type safety
   - Infrastructure as code patterns
   - Integration with Remix
   - Common gotchas and solutions

2. **remix-patterns** - Remix framework conventions
   - Loaders and actions
   - Form handling with progressive enhancement
   - Nested routes and layouts
   - Error boundaries

3. **javascript-excellence** - JavaScript/TypeScript best practices
   - DHH's philosophy adapted for JavaScript
   - Modern language features
   - TypeScript patterns
   - Code organization principles

4. **react-engineering** - React best practices
   - Component patterns and composition
   - Hooks and state management
   - Performance optimization
   - Testing React components

**Infrastructure & Data Skills:**

5. **dynamodb-single-table** - Single table design for DynamoDB
   - Key design patterns
   - Access pattern modeling
   - GSI strategies
   - Best practices and common pitfalls

6. **aws-optimization-sst** - AWS optimization with SST
   - Lambda function optimization
   - DynamoDB performance tuning
   - S3 and CloudFront setup
   - Cost monitoring and reduction

**Development Tools:**

7. **biome-tooling** - Biome for formatting and linting
   - Setup and configuration
   - Migration from ESLint/Prettier
   - CI/CD integration
   - VSCode integration

8. **testing-practices** - Comprehensive testing strategies
   - Unit testing with Vitest
   - Integration testing patterns
   - E2E testing with Playwright
   - Testing Remix routes and SST functions

**Quality & Documentation:**

9. **documentation-writing** - Creating great documentation
   - README files and API docs
   - Architecture documentation
   - Guides and tutorials
   - Code comments and examples

10. **frontend-design** - UI/UX design principles
    - Visual design and typography
    - Accessibility guidelines
    - Responsive design patterns
    - Animation and interaction design

## Installation

1. Copy the `.opencode` directory to your project root:

```bash
cp -r .opencode-setup .opencode
```

2. The structure will be:

```
your-project/
├── .opencode/
│   ├── agent/
│   │   ├── dhh-code-reviewer.md
│   │   ├── application-architect.md
│   │   ├── docs-fetcher.md
│   │   ├── technical-writer.md
│   │   ├── test-engineer.md
│   │   └── frontend-designer.md
│   ├── command/
│   │   └── architecture.md
│   └── skill/
│       ├── sst-dev/
│       │   └── SKILL.md
│       ├── remix-patterns/
│       │   └── SKILL.md
│       ├── javascript-excellence/
│       │   └── SKILL.md
│       ├── react-engineering/
│       │   └── SKILL.md
│       ├── dynamodb-single-table/
│       │   └── SKILL.md
│       ├── aws-optimization-sst/
│       │   └── SKILL.md
│       ├── biome-tooling/
│       │   └── SKILL.md
│       ├── testing-practices/
│       │   └── SKILL.md
│       ├── documentation-writing/
│       │   └── SKILL.md
│       └── frontend-design/
│           └── SKILL.md
```

3. Create documentation directories if they don't exist:

```bash
mkdir -p docs/requirements docs/plans docs/stack
```

## Usage

### Creating a New Feature

1. **Write a requirements document** in `docs/requirements/`:

```bash
# Create a requirements doc
cat > docs/requirements/$(date +%y%m%d)-01-feature-name.md << 'EOF'
# Feature Name

## Goal
What are we building and why?

## Requirements
- Requirement 1
- Requirement 2

## Out of Scope
- What we're NOT doing
EOF
```

2. **Run the architecture command** in OpenCode:

```
/architecture @docs/requirements/250102-01-feature-name.md
```

3. **Answer clarifying questions** when prompted

4. **Review the iterations**:
   - First spec: `docs/plans/250102-01a-feature-name.md`
   - DHH feedback: `docs/plans/250102-01a-feature-name-dhh-feedback.md`
   - Second spec: `docs/plans/250102-01b-feature-name.md`
   - DHH feedback: `docs/plans/250102-01b-feature-name-dhh-feedback.md`
   - Final spec: `docs/plans/250102-01c-feature-name.md`

5. **Review and approve** the final spec before implementation

### Using Individual Agents

You can invoke agents directly during conversations:

**Architecture and code review:**
```
@dhh-code-reviewer review this component for framework violations
```

```
@application-architect design a database schema for this feature
```

**Documentation:**
```
@docs-fetcher get me info on the Remix defer API
```

```
@technical-writer create a README for this feature
```

**Testing:**
```
@test-engineer write unit tests for this function
```

```
@test-engineer create integration tests for this route
```

**Design:**
```
@frontend-designer review this component for accessibility issues
```

```
@frontend-designer design a card layout for these products
```

### Using Skills

Agents automatically have access to the skills. You can also reference them:

```
Based on the remix-patterns skill, how should I handle this form?
```

```
Following the dynamodb-single-table skill, design keys for this data model
```

```
Apply the frontend-design skill principles to improve this component
```

## Customization

### Adjusting DHH's Intensity

The DHH code reviewer is intentionally direct and demanding. If you prefer a gentler tone, edit `.opencode/agent/dhh-code-reviewer.md` and adjust the feedback style section.

### Adding More Skills

Create new skills in `.opencode/skill/`:

```bash
mkdir .opencode/skill/your-skill-name
cat > .opencode/skill/your-skill-name/SKILL.md << 'EOF'
---
name: your-skill-name
description: Description of what this skill covers
---

# Skill Content
EOF
```

### Customizing the Workflow

Edit `.opencode/command/architecture.md` to:
- Change the number of iterations
- Adjust the clarification process
- Modify the summary format
- Add additional review steps

### Using Different Models

Change the model in any agent file:

```markdown
---
name: dhh-code-reviewer
model: anthropic/claude-opus-4-1  # Use Opus for deeper analysis
---
```

Or set different models for different tasks:
- Opus for architecture and review (slower, more thoughtful)
- Sonnet for docs fetching (faster, still accurate)

## Workflow Tips

### Best Practices

1. **Write detailed requirements**: The better your requirements, the better the spec
2. **Answer clarifying questions thoroughly**: This prevents wrong assumptions
3. **Read the DHH feedback**: Even if harsh, it's educational
4. **Review before implementing**: The spec is a starting point, adjust as needed
5. **Commit specs to git**: Track your architectural decisions

### Common Patterns

**For Database Features:**
```
/architecture I need to add user profiles with avatar uploads
```

**For API Integration:**
```
/architecture Integrate Stripe payments with subscription management
```

**For UI Components:**
```
/architecture Create a data table with sorting, filtering, and pagination
```

### Iterating on Specs

If you're not happy with the final spec, you can:

1. Add more clarifications and run again
2. Manually edit the spec and ask DHH to review it
3. Use the architect agent directly for specific sections

## Common Usage Patterns

### Writing Documentation

```
@technical-writer create a README for this authentication system
```

The technical writer will create clear documentation with:
- Quick start guide
- API reference
- Code examples
- Troubleshooting tips

### Adding Tests

```
@test-engineer write comprehensive tests for src/lib/users.ts
```

The test engineer will create:
- Unit tests for individual functions
- Integration tests for database operations
- Edge case coverage
- Proper mocking strategies

### Improving UI/UX

```
@frontend-designer review this checkout flow for accessibility and usability
```

The frontend designer will check:
- Color contrast ratios
- Keyboard navigation
- Touch target sizes
- Loading and error states
- Visual hierarchy

### Working with DynamoDB

```
Based on the dynamodb-single-table skill, design keys for a blog with:
- Users
- Posts (with many comments)
- Tags (many-to-many with posts)

Then have @dhh-code-reviewer review the design.
```

### Optimizing AWS Resources

```
Review my Lambda functions using the aws-optimization-sst skill and suggest improvements for cost and performance
```

### Setting Up Biome

```
Using the biome-tooling skill, help me migrate from ESLint and Prettier to Biome
```

## Philosophy

This setup embodies DHH's development philosophy:

- **Convention over Configuration**: Work with frameworks, not against them
- **Simplicity**: The simplest solution that works
- **Programmer Happiness**: Code should be a joy to work with
- **No Premature Optimization**: Solve today's problems, not tomorrow's
- **Progressive Enhancement**: Build on solid foundations

## Examples

See the original blog post for detailed examples:
https://danieltenner.com/dhh-is-immortal-and-costs-200-m/

## Troubleshooting

**Agent not found:**
- Ensure `.opencode` directory is in your project root
- Check that agent files have the correct `.md` extension

**Command not working:**
- Verify `docs/requirements/` and `docs/plans/` directories exist
- Check that command file is properly formatted

**Skills not being used:**
- Agents load skills automatically when needed
- Verify skill directories have `SKILL.md` files

## Further Customization

You can extend this setup with:
- More specialized agents (security reviewer, performance optimizer, etc.)
- Additional skills (database patterns, testing strategies, etc.)
- Custom commands for common tasks (refactor, review-pr, etc.)

## Credits

Inspired by:
- Daniel Tenner's article: "DHH is immortal, and costs $200/m"
- DHH's Rails philosophy
- Anthropic's Claude Code sub-agents pattern
- The OpenCode agent and skill system
