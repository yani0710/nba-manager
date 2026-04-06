# NBA Manager

Това е подробно ръководство на български за инсталация и стартиране на проекта на чист Windows компютър.

Идеята е човек с малко опит да може да мине през всичко стъпка по стъпка без да търси допълнителни решения.

Проектът е `monorepo` с:

- `apps/web` - React + Vite frontend
- `apps/api` - Express + TypeScript backend
- PostgreSQL база данни през Docker
- Prisma за схема и връзка към базата

## 1. Какво трябва да се изтегли предварително

Преди да правиш каквото и да е по проекта, инсталирай следните програми:

### Задължително

1. `Visual Studio Code`
   Линк: https://code.visualstudio.com/

2. `Node.js LTS`
   Линк: https://nodejs.org/

   Препоръка:
   инсталирай LTS версията.

3. `Docker Desktop`
   Линк: https://www.docker.com/products/docker-desktop/

### Какво не е нужно

- Не е нужно да инсталираш PostgreSQL отделно на Windows.
- Не е нужно да инсталираш Prisma отделно глобално.
- Не е нужно да стартираш терминал като Administrator за нормалната работа по проекта.

## 2. Кои програми трябва да са отворени

Когато работиш по проекта, е добре да са отворени:

1. `Docker Desktop`
   Той трябва да е стартиран и да е напълно зареден.

2. `Visual Studio Code`
   Проектът се отваря оттук и най-удобно командите се пишат в терминала вътре в VS Code.

### Важна препоръка

Използвай терминала във `VS Code`.

Можеш да ползваш и `Windows PowerShell`, но най-лесно е всичко да се прави от:

- `Terminal` в VS Code

Командите в това README работят и в:

- VS Code Terminal
- Windows PowerShell

Не е нужно да стартираш VS Code като Administrator.

## 3. Как да отвориш проекта

### Ако проектът е изтеглен като ZIP

Разархивирай проекта например тук:

```powershell
D:\nba-manager
```

### Ако проектът е в Git

Клонирай го на удобно място.

Пример:

```powershell
cd D:\
git clone <URL-НА-REPO-ТО> nba-manager
cd nba-manager
```

## 4. Как да отвориш папката във VS Code

1. Стартирай `Visual Studio Code`
2. Избери `File -> Open Folder`
3. Избери папката:

```powershell
D:\nba-manager
```

4. Отвори терминал във VS Code:

```text
Terminal -> New Terminal
```

След това трябва да виждаш, че си в root папката на проекта.

Ако не си, изпълни:

```powershell
cd D:\nba-manager
```

## 5. Проверка дали всичко необходимо е инсталирано

Изпълни тези команди в терминала:

```powershell
node -v
npm -v
docker -v
docker compose version
```

Ако всичко е наред, ще видиш версии.

Ако някоя команда не работи:

- затвори и отвори пак VS Code
- затвори и отвори пак терминала
- ако пак не стане, провери дали съответната програма е инсталирана успешно

## 6. Най-важното: от коя папка се пускат командите

### По подразбиране

Почти всички команди в това README се пускат от root папката:

```powershell
D:\nba-manager
```

Тоест:

```powershell
cd D:\nba-manager
```

### Кога се влиза в `apps/api`

Само ако изрично е написано в README.

### Кога се влиза в `apps/web`

Само ако изрично е написано в README.

## 7. Първоначален setup на чист компютър

Това е най-важната секция.

Следвай стъпките в този ред.

### Стъпка 1: отиди в root папката

```powershell
cd D:\nba-manager
```

### Стъпка 2: инсталирай root зависимостите

Това е важно, защото root проектът използва `concurrently` за `npm run dev`.

```powershell
npm install
```

### Стъпка 3: стартирай Docker Desktop

Преди да продължиш:

- отвори `Docker Desktop`
- изчакай да е напълно стартиран

Ако Docker не е пуснат, базата няма да стартира.

### Стъпка 4: стартирай базата

От root папката:

```powershell
npm run db:up
```

Това пуска PostgreSQL контейнера през Docker.

### Стъпка 5: създай `.env` за API

От root папката:

```powershell
npm run api:env
```

Тази команда създава:

```powershell
apps/api/.env
```

ако файлът още не съществува.

### Стъпка 6: инсталирай зависимостите на API и Web

От root папката:

```powershell
npm run install:all
```

Това инсталира:

- `apps/api/node_modules`
- `apps/web/node_modules`

### Стъпка 7: генерирай Prisma client

От root папката:

```powershell
npm run prisma:generate
```

### Стъпка 8: създай/обнови схемата на базата

От root папката:

```powershell
npm run prisma:push
```

Това качва схемата от:

```powershell
apps/api/prisma/schema.prisma
```

към PostgreSQL базата.

### Стъпка 9: seed на началните данни

От root папката:

```powershell
npm run seed
```

Това попълва начални данни, нужни на приложението.

## 8. Най-бързият вариант: автоматичен setup с една команда

След като си направил само:

- `npm install`
- стартирал си `Docker Desktop`

можеш да пуснеш:

```powershell
cd D:\nba-manager
npm run setup
```

`npm run setup` прави автоматично:

1. `npm run db:up`
2. `npm run api:env`
3. `npm run install:all`
4. `npm run prisma:generate`
5. `npm run prisma:push`
6. `npm run seed`

### Препоръка

Ако искаш максимално ясно и контролирано първо пускане, използвай ръчните стъпки от секция 7.

Ако искаш по-бързо, използвай:

```powershell
npm run setup
```

## 9. Настройване на базата данни чрез CSV файловете

Тази секция е много важна, ако искаш базата да се напълни по начина, по който е настроена тук.

### Къде трябва да са CSV файловете

CSV файловете трябва да са в:

```powershell
apps/api/data
```

Провери дали папката съществува и има данни вътре.

### Важно

За CSV import не ти трябва външен API ключ.

Тоест:

```powershell
BALLDONTLIE_API_KEY
```

може да си остане празен.

### Препоръчителна последователност за CSV import

След като вече си направил:

- `npm install`
- `npm run db:up`
- `npm run api:env`
- `npm run install:all`
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run seed`

изпълни от root папката:

```powershell
cd D:\nba-manager
npm --prefix apps/api run etl:run
npm --prefix apps/api run compute:ratings
```

Това е най-подробният и ясен вариант.

### Какво прави `etl:run`

Командата:

```powershell
npm --prefix apps/api run etl:run
```

пуска поредица от import-и:

1. players
2. advanced stats
3. impact stats
4. salaries
5. cleaned players
6. jerseys
7. game logs

### След това

Пусни:

```powershell
npm --prefix apps/api run compute:ratings
```

за да се преизчислят rating-ите и формата.

### По-кратък вариант

Вместо двете отделни команди, може да пуснеш:

```powershell
cd D:\nba-manager
npm --prefix apps/api run sync:csv
```

Тази команда прави:

1. `import:csv:unified`
2. `compute:ratings`

### Кой вариант да използваш

Ако искаш максимално близък процес до този, описан по-горе:

използвай:

```powershell
npm --prefix apps/api run etl:run
npm --prefix apps/api run compute:ratings
```

## 10. Допълнителни полезни import / repair команди

Всички тези команди се пускат от root папката:

```powershell
cd D:\nba-manager
```

### Синхронизиране на jersey номера

```powershell
npm run import:jerseys
```

### Поправка на липсващи номера от CSV

```powershell
npm run import:fix-jerseys-csv
```

### Поправка на липсващи заплати от CSV

```powershell
npm run import:fix-salaries-csv
```

### Импорт на cleaned players

```powershell
npm run import:players-cleaned
```

### Премахване на дублирани играчи в squads

```powershell
npm run import:dedupe-squads
```

### Проверка за играчи без заплата

```powershell
npm run export:missing-salary
```

### Проверка за играчи без номер

```powershell
npm run export:missing-number
```

## 11. Prisma команди

Всички тези команди се пускат от root папката:

```powershell
cd D:\nba-manager
```

### Генериране на Prisma client

```powershell
npm run prisma:generate
```

### Качване на схемата към базата

```powershell
npm run prisma:push
```

### Ако искаш да работиш директно в `apps/api`

Можеш и така:

```powershell
cd D:\nba-manager
cd apps
cd api
npm run prisma:generate
npx prisma db push --accept-data-loss
```

Но препоръчителният вариант е от root:

```powershell
cd D:\nba-manager
npm run prisma:generate
npm run prisma:push
```

## 12. Стартиране на проекта след като setup-ът е готов

### Най-лесен вариант

От root папката:

```powershell
cd D:\nba-manager
npm run db:up
npm run dev
```

Това е ежедневният начин за стартиране.

### Какво прави това

`npm run db:up`

- пуска PostgreSQL базата през Docker

`npm run dev`

- пуска API
- пуска Web

### Адреси

След стартиране:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## 13. Ръчен старт по отделно

Ако искаш да стартираш backend и frontend по отделно:

### Терминал 1 - база

От root папката:

```powershell
cd D:\nba-manager
npm run db:up
```

### Терминал 2 - API

Може от root:

```powershell
cd D:\nba-manager
npm run dev:api
```

или директно от `apps/api`:

```powershell
cd D:\nba-manager
cd apps
cd api
npm run dev
```

### Терминал 3 - Web

Може от root:

```powershell
cd D:\nba-manager
npm run dev:web
```

или директно от `apps/web`:

```powershell
cd D:\nba-manager
cd apps
cd web
npm run dev
```

## 14. Кога коя команда в коя папка

### Root папка `D:\nba-manager`

Пускат се:

```powershell
npm install
npm run db:up
npm run db:down
npm run db:logs
npm run api:env
npm run install:all
npm run prisma:generate
npm run prisma:push
npm run seed
npm run setup
npm run dev
npm run dev:api
npm run dev:web
npm run import:jerseys
npm run import:players-cleaned
npm run import:dedupe-squads
npm run import:fix-jerseys-csv
npm run import:fix-salaries-csv
npm run export:missing-salary
npm run export:missing-number
```

### Папка `D:\nba-manager\apps\api`

Пускат се:

```powershell
npm run dev
npm run seed
npm run prisma:generate
npm run sync:csv
npm run etl:run
npm run compute:ratings
```

### Папка `D:\nba-manager\apps\web`

Пуска се:

```powershell
npm run dev
```

## 15. Спиране на проекта

### Спиране на dev процесите

В терминала натисни:

```text
Ctrl + C
```

### Спиране на базата

От root папката:

```powershell
cd D:\nba-manager
npm run db:down
```

## 16. Най-често използваният реален сценарий

### Първо пускане на нов компютър

```powershell
cd D:\nba-manager
npm install
npm run db:up
npm run api:env
npm run install:all
npm run prisma:generate
npm run prisma:push
npm run seed
npm --prefix apps/api run etl:run
npm --prefix apps/api run compute:ratings
npm run dev
```

### Всекидневно пускане след това

```powershell
cd D:\nba-manager
npm run db:up
npm run dev
```

## 17. Ако искаш всичко да стане максимално автоматично

След като си инсталирал:

- VS Code
- Node.js
- Docker Desktop

и Docker е пуснат, използвай:

```powershell
cd D:\nba-manager
npm install
npm run setup
npm --prefix apps/api run etl:run
npm --prefix apps/api run compute:ratings
npm run dev
```

## 18. Troubleshooting

### Проблем: `docker compose` не работи

Провери:

- дали Docker Desktop е отворен
- дали е зареден напълно

После пробвай пак:

```powershell
docker compose version
```

### Проблем: `npm run dev` не работи

Най-честата причина е, че не е пуснато:

```powershell
npm install
```

в root папката.

Направи:

```powershell
cd D:\nba-manager
npm install
npm run install:all
```

### Проблем: няма `.env`

Пусни:

```powershell
cd D:\nba-manager
npm run api:env
```

### Проблем: Prisma грешка или липсващи таблици

Пусни:

```powershell
cd D:\nba-manager
npm run prisma:generate
npm run prisma:push
npm run seed
```

### Проблем: CSV import не намира файловете

Провери дали CSV файловете са в:

```powershell
apps/api/data
```

## 19. Полезни файлове в проекта

### Root

```text
package.json
README.md
docker-compose.yml
```

### API

```text
apps/api/.env.example
apps/api/prisma/schema.prisma
apps/api/prisma/seed.ts
apps/api/data/
```

### Web

```text
apps/web/package.json
```

## 20. Кратка версия за copy/paste

Ако искаш само най-важното:

```powershell
cd D:\nba-manager
npm install
npm run db:up
npm run api:env
npm run install:all
npm run prisma:generate
npm run prisma:push
npm run seed
npm --prefix apps/api run etl:run
npm --prefix apps/api run compute:ratings
npm run dev
```

След това отваряш:

```text
http://localhost:5173
```
