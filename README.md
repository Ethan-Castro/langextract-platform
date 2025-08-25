---
title: LangExtract Platform
emoji: 🧠
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# LangExtract Platform

A web application that provides a user-friendly interface for LangExtract, a Python library that uses Large Language Models (LLMs) to extract structured information from unstructured text documents.

## Features

- **Multi-format Support**: Process PDF, Word, Excel, PowerPoint documents and web URLs
- **AI-Powered Extraction**: Uses Google Gemini and OpenAI models for intelligent data extraction
- **Web Scraping**: Integrated FireCrawl for URL content extraction
- **Custom Prompts**: Define your own extraction tasks with examples
- **Real-time Processing**: Live status updates and result visualization

## How to Use

1. **Choose Input Method**: Upload a file, paste text, or provide a URL
2. **Configure Extraction**: Set your prompt description and choose an AI model
3. **Add Examples** (optional): Provide example extractions to improve accuracy
4. **Start Processing**: Submit your job and watch real-time progress
5. **View Results**: Explore extracted data and export as needed

## Supported File Types

- PDF documents
- Microsoft Word (.docx)
- Microsoft Excel (.xlsx)
- Microsoft PowerPoint (.pptx)
- Plain text
- Web URLs (via FireCrawl)

## AI Models

- Google Gemini 2.5 Flash
- Google Gemini 1.5 Pro
- OpenAI GPT-4o
- OpenAI GPT-4o Mini

## Environment Variables

To run this application, you may need to set the following environment variables:

- `GOOGLE_API_KEY`: Your Google AI API key for Gemini models
- `OPENAI_API_KEY`: Your OpenAI API key
- `FIRECRAWL_API_KEY`: Your FireCrawl API key for web scraping

*Note: The application will work with available APIs and gracefully handle missing credentials.*