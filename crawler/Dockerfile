FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy API files only (not crawler scripts)
COPY notebooklm_service.py .
COPY notebooklm_api.py .

# Create storage directory for auth tokens
RUN mkdir -p /root/.notebooklm

EXPOSE 8000

CMD ["uvicorn", "notebooklm_api:app", "--host", "0.0.0.0", "--port", "8000"]
