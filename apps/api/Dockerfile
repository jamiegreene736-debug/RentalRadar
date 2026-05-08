FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc libpq-dev xvfb xauth fonts-liberation fonts-noto fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .
RUN playwright install --with-deps chromium

COPY app ./app

CMD ["sh", "-c", "xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24 -ac +extension RANDR +render -noreset' celery -A app.workers.celery_app.celery_app worker --loglevel=info --queues=scraping --concurrency=${BROWSER_WORKER_MAX_CONCURRENT_BROWSERS:-1} --max-tasks-per-child=20 & uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
