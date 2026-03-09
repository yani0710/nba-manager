# NBA Manager

NBA Manager е monorepo проект с:
- Web: React + Vite
- API: Express + TypeScript
- База: PostgreSQL + Prisma

## Структура

```text
nba-manager/
  apps/
    api/
      data/           # CSV файлове (вече са в ZIP архива)
    web/
  docker-compose.yml
  package.json
```

## Инсталация на нов компютър (от ZIP, от нулата)

### 1) Инсталирай нужните технологии

Свали и инсталирай:
1. Node.js LTS (18+): https://nodejs.org/
2. Docker Desktop: https://www.docker.com/products/docker-desktop/

След инсталация:
- стартирай Docker Desktop
- изчакай да е готов (Docker Engine running)

### 2) Разархивирай проекта

Разархивирай ZIP архива, например в:
- `D:\nba-manager`

Отвори терминал в папката на проекта:

```powershell
cd D:\nba-manager
```

### 3) Провери инсталациите

```powershell
node -v
npm -v
docker -v
docker compose version
```

Ако някоя команда липсва, рестартирай терминала и провери пак.

### 4) Първоначален setup

```powershell
npm install
npm run setup
```

`npm run setup` прави:
- пуска PostgreSQL контейнера
- създава `apps/api/.env` (ако липсва)
- инсталира зависимости за `apps/api` и `apps/web`
- генерира Prisma client
- синхронизира схемата към базата
- seed на начални данни (вкл. отбори)

## Зареждане на данните от CSV (без външно API)

Важно:
- CSV файловете вече са в архива и трябва да стоят в `apps/api/data`
- за този flow не се ползва `BALLDONTLIE_API_KEY`

Изпълни:

```powershell
npm --prefix apps/api run etl:run
npm --prefix apps/api run compute:ratings
```

Алтернативно (по-кратко):

```powershell
npm --prefix apps/api run sync:csv
```

## Стартиране на приложението

```powershell
npm run dev
```

Локални адреси:
- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## Ежедневно пускане след първата инсталация

```powershell
npm run db:up
npm run dev
```

Спиране на базата:

```powershell
npm run db:down
```

## Проверка, че CSV импортът е успешен

След ETL провери файловете в `apps/api/data`:
- `import_health.json`
- `import_report.json`
- `missed_players.json`

Ако липсва CSV, ще получиш грешка:
- `CSV not found: ...`

## Важно за API импорта

Ако искаш данните да са само от CSV, не пускай:
- `npm --prefix apps/api run import:nba`
- `npm --prefix apps/api run sync:nba`

