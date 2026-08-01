FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY services/agent-server/pyproject.toml services/agent-server/uv.lock ./
RUN uv sync --directory /app --no-dev --extra '' || true
COPY services/agent-server ./
EXPOSE 2024
CMD ["uv", "run", "--directory", ".", "langgraph", "dev", "--host", "0.0.0.0", "--port", "2024", "--no-reload"]
