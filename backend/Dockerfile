FROM python:3.12-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create model cache directory
RUN mkdir -p /app/model_cache

# Make startup script executable
RUN chmod +x /app/start.sh

EXPOSE 8000

CMD ["/bin/bash", "/app/start.sh"]
