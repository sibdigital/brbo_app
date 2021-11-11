#broker_bot_app

Run in dev mode:

npm run serve

set webhooks:\
npx bottender telegram webhook set \
npx bottender viber webhook set

Or run as deamon:

start: pm2 start src/server.js \
stop: pm2 stop src/server.js \
restart: pm2 restart src/server.js \

npx bottender telegram webhook set \
npx bottender viber webhook set


Brokerbot API:

1. GET /api/ping - просто проверялка, надо бы удалить, да так и остался)
ответ: {
    "ping": "ok"
}

2. POST /api/message - отправка сообщений от целевых систем

примеры запроса:
 {"messages": [
    { "event_type": "EVENT_1", "user_id": "login1", "text": "message_text"}
]}

или

 {"messages": [
    { "event_type": "EVENT_1", "user_id": "login1", "text": "message_text", "id_incom_request": "1dc32d90-f016-11ea-b3c6-22000bcf0161"}
]}

или 
{ "messages": [{"event_type": "EVENT_1", "user_id": "login1", 
 "text": "На сервере развернута обновленная версия broker_bot",
 "attached_file": "MS4gR0VUIC9hcGkvcGluZyAtINC/0YDQvtGB0YLQviDQv9GA0L7QstC10YDRj9C70LrQsCwg0L3QsNC00L4g0LHRiyDRg9C00LDQu9C40YLRjCwg0LTQsCDRgtCw0Log0Lgg0L7RgdGC0LDQu9GB0Y8pCtC+0YLQstC10YI6IHsKICAgICJwaW5nIjogIm9rIgp9Cg==",
 "attached_file_type": "test.txt",
 "attached_file_size": 148,
 "attached_file_hash": "b7e996830861d76246508173fabc380f"
 }]}
 
ответ: 
[
    {
        "status": "fulfilled",
        "value": {
            "event_type": "EVENT_1",
            "user_id": "login1",
            "text": "message_text",
            "idEventType": "fa5529f8-f015-11ea-b3c6-22000bcf0161",
            "idTargetSystem": "bab4c906-ef30-11ea-b2dd-22000bcf0161",
            "idUser": "128851c6-f016-11ea-b3c6-22000bcf0161"
        }
    }
]


3. POST /api/request  - запрос запросов
пример запроса: 
{ "target_system_code": "TARGET_1", "event_type_code": "EVENT_1" }

ответ: 

4. POST /api/event_type - отправка типа события
{
"event_types":[
    {"code": "EVENT_3", "parent_code": "EVENT_1", "target_system_code": "TARGET3", "name": "event 3", "is_deleted": true, "type": 0}
]
}

Как развернуть проект broker_bot:
1.Заменить папку node_modules/bottender/dist на папку dist приложенную в redmine 
2.После замены не изменять npm(install/update/...).Если нужно то, до замены dist папки
3.Версия node должна быть 12+ (nvm use v12)
4.Добавить если нужен .env файл в root проекта. Файл приложен в redmine
5.Подключить бд данными из env файла
6.Если необходимо, то для создания пользователя нужно 4скрипта, приложены в redmine. 
identificator в телеграмме userId
              в viber message
Во view обязательно должна добавиться запись
