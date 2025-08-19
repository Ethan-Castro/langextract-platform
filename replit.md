# Overview

This is a web application that provides a user-friendly interface for LangExtract, a Python library that uses Large Language Models (LLMs) to extract structured information from unstructured text documents. The application allows users to define extraction tasks, provide examples, and process documents to extract entities like characters, emotions, relationships, locations, and other structured data based on custom prompts and examples.

The platform serves as a bridge between the powerful LangExtract Python library and users who want an intuitive web interface to perform text extraction tasks without directly writing Python code.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Radix UI primitives with custom styling via shadcn/ui component library
- **Styling**: Tailwind CSS with CSS variables for theming support (light/dark modes)
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod schema validation for type-safe form management

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints for extraction job management
- **Storage**: In-memory storage implementation with interface design for future database integration
- **External Integration**: Python subprocess execution for LangExtract library integration

## Data Storage Solutions
- **Current**: In-memory storage using Maps for development and testing
- **Database Schema**: Drizzle ORM configured for PostgreSQL with predefined schemas for users and extraction jobs
- **Migration System**: Drizzle Kit for schema migrations and database management

## Authentication and Authorization
- **Current State**: Basic user schema defined but not fully implemented
- **Design**: User-based job isolation with optional authentication system
- **Session Management**: Prepared for PostgreSQL session storage using connect-pg-simple

## External Service Integrations

### LangExtract Python Library
- **Integration Method**: Python subprocess execution via Node.js child_process
- **Communication**: JSON-based configuration and result exchange
- **Script Location**: `/scripts/langextract_runner.py` handles the Python bridge
- **Supported Models**: Google Gemini family, OpenAI models, and local Ollama models

### Large Language Model APIs
- **Google Gemini**: Primary integration with Google's GenAI SDK
- **API Key Management**: Environment variable and runtime configuration support
- **Model Selection**: Configurable model selection (gemini-1.5-flash, gemini-1.5-pro, etc.)

### Database Integration
- **Provider**: Neon Database (serverless PostgreSQL)
- **ORM**: Drizzle ORM for type-safe database operations
- **Connection**: PostgreSQL dialect with connection pooling support

### Development Tools
- **Replit Integration**: Custom Vite plugins for Replit development environment
- **Hot Reload**: Vite HMR with custom middleware setup
- **Error Handling**: Runtime error modal integration for development

The application follows a layered architecture with clear separation between presentation (React components), business logic (extraction job processing), and data persistence (Drizzle ORM with PostgreSQL). The system is designed to be scalable with proper abstractions for future enhancements like user authentication, job queuing, and advanced extraction features.