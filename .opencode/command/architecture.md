---
description: Develop a comprehensive spec for a new feature using multi-agent iteration
agent: build
model: anthropic/claude-sonnet-4-5
---

You will receive a requirements document for a new feature, and use the Docs Fetcher, Application Architect, and DHH Code Reviewer subagents to develop a great spec for it.

## Requirements Document

$ARGUMENTS

## Process Overview

This command orchestrates a multi-agent workflow to create production-ready specifications through iterative refinement. Each agent brings specialized expertise, and the DHH Code Reviewer ensures the result meets the highest standards.

## Steps

### 1. Clarify the Requirements

First, evaluate whether the requirements document requires any clarification. If it does, ask the user before proceeding, and append the clarifications to the requirements document.

Unless the requirements are extremely clear upfront, you should always ask at least 3 clarifying questions - ideally, select the ones which are most likely to reduce ambiguity and result in a great spec, and, later, a great, tight implementation that does what it needs to do and nothing more.

Wait for the user's response before continuing.

### 2. Fetch Documentation

Once you are happy with the basic requirements, decide whether it requires documentation beyond what is present in the `/docs/` folder.

If external documentation is needed:
1. Invoke the `@docs-fetcher` subagent with:
   - The requirements document
   - List of specific documentation to fetch (URLs, packages, etc.)
   - What information is needed from each source

2. The docs-fetcher will create new documentation files in `/docs/stack/` if needed

3. Review the created documentation summaries

Note: Don't fetch documentation for tools/frameworks that are already well-documented in `/docs/stack/`. Just reference what's there and let other subagents fetch more if they need to.

### 3. First Iteration of the Spec

Use the `@application-architect` subagent to create a first iteration of the spec.

Pass it:
- The clarified requirements document
- References to relevant documentation in `/docs/`
- Any existing codebase patterns to follow

The spec should be created as: `/docs/plans/YYMMDD-XXa-feature-name.md`
- YYMMDD: Today's date
- XX: Sequential number (01, 02, etc.)
- a: First iteration

For example: `/docs/plans/250102-01a-user-authentication.md`

The Application Architect will likely create a comprehensive spec, which is good for a first draft.

### 4. DHH Code Review - Round 1

Pass the first iteration of the spec to the `@dhh-code-reviewer` subagent.

Ask the reviewer to:
- Evaluate the spec against DHH's standards
- Look for over-engineering, unnecessary complexity, or framework violations
- Write detailed feedback with specific suggestions

The feedback should be saved to: `/docs/plans/YYMMDD-XXa-feature-name-dhh-feedback.md`

Check if the reviewer actually saved the feedback file. If not, save it yourself.

### 5. Second Iteration of the Spec

Take all context from the first iteration and pass it to the `@application-architect` subagent:
- Original requirements with clarifications
- First iteration spec
- DHH feedback
- Relevant documentation

Ask the architect to create a revised spec that addresses DHH's concerns.

Save this as: `/docs/plans/YYMMDD-XXb-feature-name.md`

### 6. DHH Code Review - Round 2

Repeat the review process with the `@dhh-code-reviewer`:
- Review the second iteration
- Check if previous concerns were addressed
- Identify any remaining issues
- Provide constructive feedback

Save feedback to: `/docs/plans/YYMMDD-XXb-feature-name-dhh-feedback.md`

### 7. Third Iteration of the Spec

One more round with the `@application-architect`:
- All previous context
- Second iteration spec
- Latest DHH feedback

Create the third (and usually final) iteration: `/docs/plans/YYMMDD-XXc-feature-name.md`

### 8. Summary and Notification

Once the third iteration is complete, pause and notify the user with:

1. **High-level summary** of the final spec (2-3 paragraphs max):
   - What the feature does
   - Key technical decisions
   - Main components/changes

2. **Evolution summary** (2-3 paragraphs max):
   - Key improvements from DHH's feedback
   - What was simplified or refined
   - Why the final approach is better

Use paragraphs, not bullet points, for a natural conversational tone.

3. **File locations**:
   - Link to the final spec
   - Link to feedback documents
   - Note that user should review before implementation

## Guidelines

### For Clarifying Questions:
- Ask about ambiguities, not obvious details
- Focus on questions that prevent wrong assumptions
- Ask about scope boundaries
- Ask about integration points with existing code
- Ask about user experience expectations

### For Documentation Fetching:
- Only fetch what's not already documented
- Be specific about what information is needed
- Create focused summaries, not exhaustive docs

### For Working with Subagents:
- Provide clear, complete context
- Be explicit about what you want from each agent
- Check that files were created where expected
- Pass forward all relevant context between iterations

### For DHH Reviews:
- Expect blunt, direct feedback
- Don't be defensive about first drafts
- Use feedback to genuinely improve the spec
- The goal is a spec you'd be proud to implement

### For Summaries:
- Be concise but informative
- Focus on what matters to the developer
- Use natural language, not lists
- Highlight the evolution and improvements

## Success Criteria

A successful architecture command run produces:
1. ✅ Clear, unambiguous requirements
2. ✅ Necessary documentation fetched and summarized
3. ✅ Three iterations of progressively better specs
4. ✅ Detailed feedback from DHH reviewer for each iteration
5. ✅ Final spec that's ready for implementation
6. ✅ Clear summary for the user

## Remember

This is an iterative refinement process. The first spec is supposed to be imperfect - that's why we review and iterate. The goal is to end up with a spec that:
- Is elegant and simple
- Works with frameworks, not against them
- Can be implemented by following clear steps
- Would make DHH proud if he saw it
