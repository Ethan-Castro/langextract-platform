FROM node:18-slim

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Python requirements and install Python dependencies
COPY pyproject.toml ./
RUN pip3 install --no-cache-dir \
    beautifulsoup4>=4.13.4 \
    langextract>=1.0.8 \
    openpyxl>=3.1.5 \
    pdfplumber>=0.11.7 \
    pypdf2>=3.0.1 \
    python-docx>=1.2.0 \
    python-pptx>=1.0.2 \
    requests>=2.32.5

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Build the frontend
RUN npm run build

# Create a non-root user
RUN useradd -m -u 1000 user
USER user

# Expose port
EXPOSE 7860

# Set environment variables for Hugging Face Spaces
ENV NODE_ENV=production
ENV PORT=7860

# Start the application
CMD ["npm", "start"]