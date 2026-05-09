FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SCRAPER_HEADLESS=false \
    SCRAPER_STEALTH=true \
    SCRAPER_REQUIRE_RESIDENTIAL_PROXY=true \
    DISPLAY=:99

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gcc \
    gnupg \
    libpq-dev \
    xvfb \
    xauth \
    fonts-liberation \
    fonts-noto \
    fonts-noto-color-emoji \
  && install -d -m 0755 /etc/apt/keyrings \
  && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
    | gpg --dearmor -o /etc/apt/keyrings/google-linux.gpg \
  && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-chrome-stable \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .
RUN playwright install --with-deps chromium

COPY app ./app

CMD ["sh", "-c", "xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24 -ac +extension RANDR +render -noreset' celery -A app.workers.celery_app.celery_app worker --loglevel=info --queues=scraping --concurrency=${BROWSER_WORKER_MAX_CONCURRENT_BROWSERS:-1} --max-tasks-per-child=20 & uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
