FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY services/agent-server/pyproject.toml services/agent-server/uv.lock ./
COPY services/agent-server/agent_server ./agent_server
COPY services/agent-server/langgraph.json ./langgraph.json
COPY scripts/catalog ./catalog
ENV CATALOG_SEED_DIR=/app/catalog
RUN uv sync --directory /app --no-dev
EXPOSE 2024
CMD ["uv", "run", "--directory", ".", "langgraph", "dev", "--host", "0.0.0.0", "--port", "2024", "--no-reload"]
