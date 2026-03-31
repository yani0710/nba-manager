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

npm run db:up
npm run dev
```powershell
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

## Какво бих подобрил:
`Да изчистиш ясно границата между “base DB truth” и “save-specific truth”, защото в момента доста логика зависи от merge на Player + save.data.`
`Да намалиш зависимостта от големи JSON payload-и в save.data и да изнесеш повече save-specific неща в отделни таблици.`
`Да добавиш по-силна migration дисциплина: при pull ти се чупеше app-ът заради schema drift.`
`Да уеднаквиш generated dist файловете, за да не влизат често в конфликти.`
`Да добавиш smoke tests за най-важните user flows: load save, squad, prepare, match sim, transfers.`
`Да централизираш frontend data fetching, защото в момента има риск от stale state и тиха деградация към празни списъци.`
`Да подобриш error surfacing в UI, за да не изглежда като “няма играчи”, когато реално API-то дава 500.`
