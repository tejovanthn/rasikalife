# Rasika.life - Project Overview for AI Coding Assistants

## Project Summary
**Rasika.life** is a web-based community platform for discovering, documenting, and discussing Indian classical art and music. It addresses fragmentation in the classical arts world by providing a comprehensive resource for both connoisseurs and newcomers.

## Core Mission
- Create a structured digital space for artists, events, and enthusiasts
- Enable discovery of classical arts events and performances
- Provide centralized documentation for performance details and compositions
- Build a knowledge base for ragas, talas, and compositions
- Foster community engagement through forums and discussions

## Target Users
- **Serious Rasikas**: Dedicated connoisseurs of classical music (35-65)
- **Casual Enthusiasts**: People with interest but limited knowledge (25-45)
- **Artists & Performers**: Musicians, dancers, classical arts practitioners
- **Venues & Event Organizers**: Concert halls, cultural centers, festivals
- **Global Indian Diaspora**: Seeking cultural connections
- **Cultural Newcomers**: Non-Indians and younger Indians exploring traditional arts

## Key Features
- **Knowledge Compendium**: Wiki-style database of compositions, ragas, talas
- **Events Tracker**: Comprehensive calendar with detailed metadata
- **Artist Profiles**: AI-curated and artist-verified biographies
- **RSVP & Attendance**: Users can mark attendance for events; counts are denormalized on the event
- **Concert Book**: Personal log of concerts a user has attended, with optional private notes; atomically tracks `attendedCount` on each event
- **Crowd-sourced Concert Setlists**: Rasikas log ordered compositions performed at concerts; contributions are reconciled into a canonical public setlist per event. Feeds performance counts on composition, raga, and artist pages. Free-text items enter a moderation queue for linking. See `ConcertLogItem` and `EventSetlist` entities.
- **Instagram Event Discovery**: Automated scraper extracts event details from Instagram posts using Gemini AI
- **Community Forums**: StackOverflow-inspired Q&A and discussions (planned)
- **WhatsApp Integration**: Bot interface for artist updates (planned)
- **Performance Tracking**: Link artists, compositions, and events via logged setlists
- **Karma System**: Community self-regulation through reputation (planned)
- **Direct Artist Support**: Patreon-style patronage platform (planned)

## Business Model
- Freemium with premium subscriptions ($3-5/month)
- Contextual advertising for music schools and instruments
- Artist support platform (5-8% commission)
- Event marketing partnerships (3-5% commission)
- Educational partnerships with music schools

## Technology Philosophy
- Single-table DynamoDB design for performance and cost efficiency (ADR-001)
- Domain-driven development with collocated tests (ADR-009)
- Versioned content for wiki-style collaboration (ADR-006)
- Karma-based access control for community management (ADR-007)
- Event sourcing for audit trails and analytics (ADR-009)
- Comprehensive testing strategy (ADR-008)
- Type-safe API layer with tRPC (ADR-003)
- React Router v7 full-stack framework (ADR-004)
- SST v3 serverless infrastructure (ADR-002)