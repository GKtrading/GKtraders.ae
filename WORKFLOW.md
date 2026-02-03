# Git Flow Workflow - GKtraders.ae

## Структура веток

```
main (production)    → Только стабильные релизы с тегами
develop (staging)    → Текущая разработка и тестирование
feature/*            → Новые фичи
hotfix/*             → Срочные исправления для production
```

## Semantic Versioning (SemVer)

- **v1.0.0** - Первый релиз
- **v1.0.1** - Hotfix (багфиксы, мелкие исправления)
- **v1.1.0** - Minor (новые фичи, обратная совместимость)
- **v2.0.0** - Major (breaking changes, крупные изменения)

## Рабочий процесс

### 1. Новая фича

```bash
# Создать ветку от develop
git checkout develop
git pull origin develop
git checkout -b feature/название-фичи

# Работать над фичей
git add .
git commit -m "Описание изменений

Co-Authored-By: Warp <agent@warp.dev>"

# Запушить и создать PR в develop
git push origin feature/название-фичи
```

### 2. Hotfix (срочное исправление)

```bash
# Создать ветку от main
git checkout main
git pull origin main
git checkout -b hotfix/название-бага

# Исправить баг
git add .
git commit -m "Fix: описание бага

Co-Authored-By: Warp <agent@warp.dev>"

# Мержить в main И develop
git checkout main
git merge hotfix/название-бага
git tag -a v1.0.1 -m "Hotfix: описание"
git push origin main --tags

git checkout develop
git merge hotfix/название-бага
git push origin develop
```

### 3. Релиз в production

```bash
# Когда develop готов к релизу
git checkout main
git merge develop
git tag -a v1.1.0 -m "Release v1.1.0: список фич"
git push origin main --tags
git push origin develop
```

## Текущий статус

- ✅ **main** - production (v1.0.0)
- ✅ **develop** - staging
- 📍 Вы сейчас на ветке: **develop**

## Быстрые команды

```bash
# Проверить текущую ветку
git branch

# Посмотреть все ветки
git branch -a

# Посмотреть теги
git tag

# Переключиться на develop
git checkout develop

# Переключиться на main
git checkout main
```
