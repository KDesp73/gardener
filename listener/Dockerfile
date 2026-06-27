FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the listener package
COPY __init__.py __main__.py main.py db.py /app/listener/

# Run as non-root
RUN useradd -m gardener
USER gardener

CMD ["python", "-m", "listener"]
