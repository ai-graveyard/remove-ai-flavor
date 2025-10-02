docker run -d --restart=always \
  --name postgres-local \
  -p 5432:5432 \
  -v $HOME/data/postgres:/var/lib/postgresql/data \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=123456 \
  -e POSTGRES_DB=remove-ai-flavor \
  postgres:17.4-bookworm