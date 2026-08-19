export type SuggestionType = 'keyword' | 'function' | 'variable' | 'class' | 'method' | 'property' | 'snippet' | 'type';

export interface CodeSuggestion {
  label: string;
  insertText: string;
  type: SuggestionType;
  detail?: string;
  documentation?: string;
}

// Built-in keywords, functions, and standard libraries by language
const LANGUAGE_BUILTINS: Record<string, CodeSuggestion[]> = {
  python: [
    // Built-in functions
    { label: 'print', insertText: 'print(${1:})', type: 'function', detail: 'print(*args, sep=" ", end="\\n")' },
    { label: 'len', insertText: 'len(${1:})', type: 'function', detail: 'len(object) -> int' },
    { label: 'range', insertText: 'range(${1:start}, ${2:stop})', type: 'function', detail: 'range(stop) or range(start, stop[, step])' },
    { label: 'enumerate', insertText: 'enumerate(${1:iterable})', type: 'function', detail: 'enumerate(iterable, start=0)' },
    { label: 'zip', insertText: 'zip(${1:iter1}, ${2:iter2})', type: 'function', detail: 'zip(*iterables)' },
    { label: 'sum', insertText: 'sum(${1:iterable})', type: 'function', detail: 'sum(iterable, start=0)' },
    { label: 'min', insertText: 'min(${1:})', type: 'function', detail: 'min(iterable or *args)' },
    { label: 'max', insertText: 'max(${1:})', type: 'function', detail: 'max(iterable or *args)' },
    { label: 'abs', insertText: 'abs(${1:number})', type: 'function', detail: 'abs(number)' },
    { label: 'sorted', insertText: 'sorted(${1:iterable})', type: 'function', detail: 'sorted(iterable, key=None, reverse=False)' },
    { label: 'map', insertText: 'map(${1:func}, ${2:iterable})', type: 'function', detail: 'map(func, *iterables)' },
    { label: 'filter', insertText: 'filter(${1:func}, ${2:iterable})', type: 'function', detail: 'filter(function or None, iterable)' },
    { label: 'input', insertText: 'input("${1:Prompt: }")', type: 'function', detail: 'input(prompt=None) -> str' },
    { label: 'int', insertText: 'int(${1:x})', type: 'function', detail: 'int(x=0) -> int' },
    { label: 'float', insertText: 'float(${1:x})', type: 'function', detail: 'float(x=0.0) -> float' },
    { label: 'str', insertText: 'str(${1:object})', type: 'function', detail: 'str(object="") -> str' },
    { label: 'bool', insertText: 'bool(${1:x})', type: 'function', detail: 'bool(x=False) -> bool' },
    { label: 'list', insertText: 'list(${1:iterable})', type: 'function', detail: 'list() -> new list' },
    { label: 'dict', insertText: 'dict(${1:})', type: 'function', detail: 'dict() -> new empty dictionary' },
    { label: 'set', insertText: 'set(${1:iterable})', type: 'function', detail: 'set() -> new empty set' },
    { label: 'tuple', insertText: 'tuple(${1:iterable})', type: 'function', detail: 'tuple() -> new tuple' },
    { label: 'open', insertText: 'open("${1:file.txt}", "${2:r}")', type: 'function', detail: 'open(file, mode="r", encoding="utf-8")' },
    { label: 'round', insertText: 'round(${1:number}, ${2:ndigits})', type: 'function', detail: 'round(number, ndigits=None)' },
    { label: 'type', insertText: 'type(${1:object})', type: 'function', detail: 'type(object) -> type of object' },
    { label: 'isinstance', insertText: 'isinstance(${1:object}, ${2:classinfo})', type: 'function', detail: 'isinstance(obj, class_or_tuple)' },
    { label: 'append', insertText: 'append(${1:item})', type: 'method', detail: 'list.append(item)' },
    { label: 'extend', insertText: 'extend(${1:iterable})', type: 'method', detail: 'list.extend(iterable)' },
    { label: 'pop', insertText: 'pop(${1:index})', type: 'method', detail: 'list.pop([index]) / dict.pop(key)' },
    { label: 'keys', insertText: 'keys()', type: 'method', detail: 'dict.keys()' },
    { label: 'values', insertText: 'values()', type: 'method', detail: 'dict.values()' },
    { label: 'items', insertText: 'items()', type: 'method', detail: 'dict.items()' },
    { label: 'get', insertText: 'get(${1:key}, ${2:default})', type: 'method', detail: 'dict.get(key, default=None)' },
    { label: 'split', insertText: 'split("${1: }")', type: 'method', detail: 'str.split(sep=None, maxsplit=-1)' },
    { label: 'join', insertText: 'join(${1:iterable})', type: 'method', detail: 'str.join(iterable)' },
    { label: 'strip', insertText: 'strip()', type: 'method', detail: 'str.strip([chars])' },
    { label: 'replace', insertText: 'replace("${1:old}", "${2:new}")', type: 'method', detail: 'str.replace(old, new[, count])' },
    { label: 'startswith', insertText: 'startswith("${1:prefix}")', type: 'method', detail: 'str.startswith(prefix)' },
    { label: 'endswith', insertText: 'endswith("${1:suffix}")', type: 'method', detail: 'str.endswith(suffix)' },

    // Keywords
    { label: 'def', insertText: 'def ${1:func_name}(${2:params}):\n    ${3:pass}', type: 'keyword', detail: 'Определение функции' },
    { label: 'class', insertText: 'class ${1:ClassName}:\n    def __init__(self${2:}):\n        ${3:pass}', type: 'keyword', detail: 'Определение класса' },
    { label: 'if', insertText: 'if ${1:condition}:\n    ${2:pass}', type: 'keyword', detail: 'Условный оператор' },
    { label: 'elif', insertText: 'elif ${1:condition}:\n    ${2:pass}', type: 'keyword', detail: 'Ветка elif' },
    { label: 'else', insertText: 'else:\n    ${1:pass}', type: 'keyword', detail: 'Ветка else' },
    { label: 'for', insertText: 'for ${1:item} in ${2:iterable}:\n    ${3:pass}', type: 'keyword', detail: 'Цикл for' },
    { label: 'while', insertText: 'while ${1:condition}:\n    ${2:pass}', type: 'keyword', detail: 'Цикл while' },
    { label: 'return', insertText: 'return ${1:}', type: 'keyword', detail: 'Возврат значения из функции' },
    { label: 'import', insertText: 'import ${1:module}', type: 'keyword', detail: 'Импорт модуля' },
    { label: 'from', insertText: 'from ${1:module} import ${2:name}', type: 'keyword', detail: 'Импорт из модуля' },
    { label: 'try', insertText: 'try:\n    ${1:pass}\nexcept Exception as e:\n    ${2:print(e)}', type: 'keyword', detail: 'Обработка исключений' },
    { label: 'except', insertText: 'except ${1:Exception} as ${2:e}:', type: 'keyword', detail: 'Блок except' },
    { label: 'finally', insertText: 'finally:\n    ${1:pass}', type: 'keyword', detail: 'Блок finally' },
    { label: 'with', insertText: 'with ${1:open("file.txt", "r")} as ${2:f}:\n    ${3:pass}', type: 'keyword', detail: 'Контекстный менеджер' },
    { label: 'async', insertText: 'async def ${1:func_name}():\n    ${2:pass}', type: 'keyword', detail: 'Асинхронная функция' },
    { label: 'await', insertText: 'await ${1:coroutine}', type: 'keyword', detail: 'Ожидание корутины' },
    { label: 'lambda', insertText: 'lambda ${1:x}: ${2:x}', type: 'keyword', detail: 'Анонимная функция' },
    { label: 'yield', insertText: 'yield ${1:value}', type: 'keyword', detail: 'Генератор yield' },
    { label: 'break', insertText: 'break', type: 'keyword', detail: 'Прерывание цикла' },
    { label: 'continue', insertText: 'continue', type: 'keyword', detail: 'Следующая итерация' },
    { label: 'pass', insertText: 'pass', type: 'keyword', detail: 'Пустая инструкция' },
    { label: 'True', insertText: 'True', type: 'keyword', detail: 'Булево True' },
    { label: 'False', insertText: 'False', type: 'keyword', detail: 'Булево False' },
    { label: 'None', insertText: 'None', type: 'keyword', detail: 'Значение None' },
    { label: 'self', insertText: 'self', type: 'variable', detail: 'Ссылка на экземпляр класса' },
    { label: '__init__', insertText: '__init__(self${1:}):', type: 'method', detail: 'Конструктор класса' },
    { label: '__main__', insertText: 'if __name__ == "__main__":\n    ${1:main()}', type: 'snippet', detail: 'Точка входа скрипта' },
    { label: 'math', insertText: 'import math', type: 'keyword', detail: 'Модуль математики' },
    { label: 'random', insertText: 'import random', type: 'keyword', detail: 'Модуль случайных чисел' },
    { label: 'json', insertText: 'import json', type: 'keyword', detail: 'Модуль работы с JSON' },
    { label: 'time', insertText: 'import time', type: 'keyword', detail: 'Модуль времени' },
    { label: 'datetime', insertText: 'from datetime import datetime', type: 'keyword', detail: 'Модуль даты и времени' },
    { label: 'sys', insertText: 'import sys', type: 'keyword', detail: 'Системный модуль' },
    { label: 'os', insertText: 'import os', type: 'keyword', detail: 'Модуль операционной системы' },
  ],

  javascript: [
    { label: 'console.log', insertText: 'console.log(${1:});', type: 'function', detail: 'console.log(...data)' },
    { label: 'console.error', insertText: 'console.error(${1:});', type: 'function', detail: 'console.error(...data)' },
    { label: 'console.warn', insertText: 'console.warn(${1:});', type: 'function', detail: 'console.warn(...data)' },
    { label: 'function', insertText: 'function ${1:name}(${2:params}) {\n  ${3:}\n}', type: 'keyword', detail: 'Объявление функции' },
    { label: 'const', insertText: 'const ${1:name} = ${2:value};', type: 'keyword', detail: 'Константа' },
    { label: 'let', insertText: 'let ${1:name} = ${2:value};', type: 'keyword', detail: 'Переменная' },
    { label: 'var', insertText: 'var ${1:name} = ${2:value};', type: 'keyword', detail: 'Переменная var' },
    { label: 'return', insertText: 'return ${1:};', type: 'keyword', detail: 'Возврат значения' },
    { label: 'async', insertText: 'async function ${1:name}() {\n  ${2:}\n}', type: 'keyword', detail: 'Асинхронная функция' },
    { label: 'await', insertText: 'await ${1:promise}', type: 'keyword', detail: 'Ожидание промиса' },
    { label: 'import', insertText: 'import ${1:name} from "${2:module}";', type: 'keyword', detail: 'Импорт модуля' },
    { label: 'export', insertText: 'export const ${1:name} = ${2:};', type: 'keyword', detail: 'Экспорт' },
    { label: 'class', insertText: 'class ${1:ClassName} {\n  constructor(${2:}) {\n    ${3:}\n  }\n}', type: 'keyword', detail: 'Класс' },
    { label: 'if', insertText: 'if (${1:condition}) {\n  ${2:}\n}', type: 'keyword', detail: 'Условие if' },
    { label: 'else', insertText: 'else {\n  ${1:}\n}', type: 'keyword', detail: 'Блок else' },
    { label: 'for', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n  ${3:}\n}', type: 'keyword', detail: 'Цикл for' },
    { label: 'for...of', insertText: 'for (const ${1:item} of ${2:iterable}) {\n  ${3:}\n}', type: 'keyword', detail: 'Цикл for...of' },
    { label: 'while', insertText: 'while (${1:condition}) {\n  ${2:}\n}', type: 'keyword', detail: 'Цикл while' },
    { label: 'try', insertText: 'try {\n  ${1:}\n} catch (${2:error}) {\n  console.error(${2:error});\n}', type: 'keyword', detail: 'Обработка try/catch' },
    { label: 'forEach', insertText: 'forEach((${1:item}, ${2:index}) => {\n  ${3:}\n})', type: 'method', detail: 'Array.prototype.forEach' },
    { label: 'map', insertText: 'map((${1:item}) => ${2:item})', type: 'method', detail: 'Array.prototype.map' },
    { label: 'filter', insertText: 'filter((${1:item}) => ${2:condition})', type: 'method', detail: 'Array.prototype.filter' },
    { label: 'reduce', insertText: 'reduce((${1:acc}, ${2:cur}) => ${3:acc + cur}, ${4:0})', type: 'method', detail: 'Array.prototype.reduce' },
    { label: 'find', insertText: 'find((${1:item}) => ${2:condition})', type: 'method', detail: 'Array.prototype.find' },
    { label: 'includes', insertText: 'includes(${1:item})', type: 'method', detail: 'Array/String.includes()' },
    { label: 'push', insertText: 'push(${1:item})', type: 'method', detail: 'Array.prototype.push' },
    { label: 'pop', insertText: 'pop()', type: 'method', detail: 'Array.prototype.pop' },
    { label: 'slice', insertText: 'slice(${1:start}, ${2:end})', type: 'method', detail: 'Array/String.slice' },
    { label: 'splice', insertText: 'splice(${1:start}, ${2:deleteCount})', type: 'method', detail: 'Array.prototype.splice' },
    { label: 'join', insertText: 'join("${1:, }")', type: 'method', detail: 'Array.prototype.join' },
    { label: 'length', insertText: 'length', type: 'property', detail: 'Длина строки или массива' },
    { label: 'Promise', insertText: 'new Promise((${1:resolve}, ${2:reject}) => {\n  ${3:}\n})', type: 'class', detail: 'Объект Promise' },
    { label: 'setTimeout', insertText: 'setTimeout(() => {\n  ${1:}\n}, ${2:1000});', type: 'function', detail: 'setTimeout(callback, ms)' },
    { label: 'setInterval', insertText: 'setInterval(() => {\n  ${1:}\n}, ${2:1000});', type: 'function', detail: 'setInterval(callback, ms)' },
    { label: 'JSON.stringify', insertText: 'JSON.stringify(${1:obj}, null, 2)', type: 'function', detail: 'Сериализация в JSON' },
    { label: 'JSON.parse', insertText: 'JSON.parse(${1:jsonString})', type: 'function', detail: 'Парсинг JSON' },
    { label: 'Math.floor', insertText: 'Math.floor(${1:x})', type: 'function', detail: 'Округление вниз' },
    { label: 'Math.ceil', insertText: 'Math.ceil(${1:x})', type: 'function', detail: 'Округление вверх' },
    { label: 'Math.round', insertText: 'Math.round(${1:x})', type: 'function', detail: 'Математическое округление' },
    { label: 'Math.max', insertText: 'Math.max(${1:a}, ${2:b})', type: 'function', detail: 'Максимум чисел' },
    { label: 'Math.min', insertText: 'Math.min(${1:a}, ${2:b})', type: 'function', detail: 'Минимум чисел' },
    { label: 'Math.random', insertText: 'Math.random()', type: 'function', detail: 'Случайное число [0, 1)' },
    { label: 'Math.abs', insertText: 'Math.abs(${1:x})', type: 'function', detail: 'Модуль числа' },
    { label: 'Object.keys', insertText: 'Object.keys(${1:obj})', type: 'function', detail: 'Массив ключей объекта' },
    { label: 'Object.values', insertText: 'Object.values(${1:obj})', type: 'function', detail: 'Массив значений объекта' },
    { label: 'Object.entries', insertText: 'Object.entries(${1:obj})', type: 'function', detail: 'Массив пар [ключ, значение]' },
    { label: 'Array.isArray', insertText: 'Array.isArray(${1:obj})', type: 'function', detail: 'Проверка на массив' },
    { label: 'fetch', insertText: 'fetch("${1:url}").then(res => res.json())', type: 'function', detail: 'HTTP-запрос fetch' },
    { label: 'true', insertText: 'true', type: 'keyword', detail: 'true' },
    { label: 'false', insertText: 'false', type: 'keyword', detail: 'false' },
    { label: 'null', insertText: 'null', type: 'keyword', detail: 'null' },
    { label: 'undefined', insertText: 'undefined', type: 'keyword', detail: 'undefined' },
  ],

  typescript: [
    { label: 'interface', insertText: 'interface ${1:Name} {\n  ${2:}\n}', type: 'keyword', detail: 'TypeScript Interface' },
    { label: 'type', insertText: 'type ${1:Name} = ${2:};', type: 'keyword', detail: 'TypeScript Type Alias' },
    { label: 'enum', insertText: 'enum ${1:Name} {\n  ${2:}\n}', type: 'keyword', detail: 'TypeScript Enum' },
    { label: 'string', insertText: 'string', type: 'keyword', detail: 'Тип string' },
    { label: 'number', insertText: 'number', type: 'keyword', detail: 'Тип number' },
    { label: 'boolean', insertText: 'boolean', type: 'keyword', detail: 'Тип boolean' },
    { label: 'void', insertText: 'void', type: 'keyword', detail: 'Тип void' },
    { label: 'any', insertText: 'any', type: 'keyword', detail: 'Тип any' },
    { label: 'unknown', insertText: 'unknown', type: 'keyword', detail: 'Тип unknown' },
    { label: 'never', insertText: 'never', type: 'keyword', detail: 'Тип never' },
    { label: 'Record', insertText: 'Record<${1:string}, ${2:any}>', type: 'keyword', detail: 'Record<K, V>' },
    { label: 'Array', insertText: 'Array<${1:string}>', type: 'keyword', detail: 'Array<T>' },
    { label: 'Partial', insertText: 'Partial<${1:T}>', type: 'keyword', detail: 'Partial<T>' },
  ],

  cpp: [
    { label: '#include <iostream>', insertText: '#include <iostream>\n', type: 'keyword', detail: 'Заголовок ввода/вывода' },
    { label: '#include <vector>', insertText: '#include <vector>\n', type: 'keyword', detail: 'Вектор std::vector' },
    { label: '#include <string>', insertText: '#include <string>\n', type: 'keyword', detail: 'Строка std::string' },
    { label: '#include <algorithm>', insertText: '#include <algorithm>\n', type: 'keyword', detail: 'Алгоритмы std::sort, min, max' },
    { label: '#include <cmath>', insertText: '#include <cmath>\n', type: 'keyword', detail: 'Математические функции' },
    { label: '#include <map>', insertText: '#include <map>\n', type: 'keyword', detail: 'Ассоциативный массив std::map' },
    { label: '#include <set>', insertText: '#include <set>\n', type: 'keyword', detail: 'Множество std::set' },
    { label: 'using namespace std;', insertText: 'using namespace std;\n', type: 'keyword', detail: 'Пространство имен std' },
    { label: 'std::cout', insertText: 'cout << ${1:value} << endl;', type: 'function', detail: 'Вывод в консоль' },
    { label: 'std::cin', insertText: 'cin >> ${1:variable};', type: 'function', detail: 'Ввод из консоли' },
    { label: 'std::endl', insertText: 'endl', type: 'keyword', detail: 'Конец строки и сброс буфера' },
    { label: 'std::vector', insertText: 'vector<${1:int}> ${2:v};', type: 'class', detail: 'Динамический массив vector<T>' },
    { label: 'std::string', insertText: 'string ${1:str};', type: 'class', detail: 'Строка std::string' },
    { label: 'push_back', insertText: 'push_back(${1:value});', type: 'method', detail: 'Добавление элемента в конец' },
    { label: 'pop_back', insertText: 'pop_back();', type: 'method', detail: 'Удаление последнего элемента' },
    { label: 'size', insertText: 'size()', type: 'method', detail: 'Размер контейнера' },
    { label: 'empty', insertText: 'empty()', type: 'method', detail: 'Проверка на пустоту' },
    { label: 'int', insertText: 'int ${1:name} = 0;', type: 'keyword', detail: 'Целое число' },
    { label: 'double', insertText: 'double ${1:name} = 0.0;', type: 'keyword', detail: 'Вещественное число двойной точности' },
    { label: 'float', insertText: 'float ${1:name} = 0.0f;', type: 'keyword', detail: 'Вещественное число' },
    { label: 'char', insertText: 'char ${1:c} = \'a\';', type: 'keyword', detail: 'Символ' },
    { label: 'bool', insertText: 'bool ${1:flag} = true;', type: 'keyword', detail: 'Логический тип' },
    { label: 'void', insertText: 'void', type: 'keyword', detail: 'Тип void' },
    { label: 'auto', insertText: 'auto ${1:name} = ${2:value};', type: 'keyword', detail: 'Автовывод типа' },
    { label: 'return', insertText: 'return ${1:0};', type: 'keyword', detail: 'Возврат значения' },
    { label: 'struct', insertText: 'struct ${1:Name} {\n    ${2:}\n};', type: 'keyword', detail: 'Структура' },
    { label: 'class', insertText: 'class ${1:Name} {\npublic:\n    ${2:}\n};', type: 'keyword', detail: 'Класс' },
    { label: 'for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${3:}\n}', type: 'keyword', detail: 'Цикл for' },
    { label: 'while', insertText: 'while (${1:condition}) {\n    ${2:}\n}', type: 'keyword', detail: 'Цикл while' },
    { label: 'if', insertText: 'if (${1:condition}) {\n    ${2:}\n}', type: 'keyword', detail: 'Условие if' },
    { label: 'else', insertText: 'else {\n    ${1:}\n}', type: 'keyword', detail: 'Блок else' },
    { label: 'main', insertText: 'int main() {\n    ${1:cout << "Hello, World!" << endl;}\n    return 0;\n}', type: 'snippet', detail: 'Главная функция main()' },
  ],

  sql: [
    { label: 'SELECT', insertText: 'SELECT ${1:*} FROM ${2:table_name};', type: 'keyword', detail: 'Выборка данных' },
    { label: 'FROM', insertText: 'FROM ${1:table_name}', type: 'keyword', detail: 'Указание таблицы' },
    { label: 'WHERE', insertText: 'WHERE ${1:condition}', type: 'keyword', detail: 'Фильтрация записей' },
    { label: 'JOIN', insertText: 'JOIN ${1:other_table} ON ${2:condition}', type: 'keyword', detail: 'Объединение таблиц' },
    { label: 'LEFT JOIN', insertText: 'LEFT JOIN ${1:table} ON ${2:condition}', type: 'keyword', detail: 'Левое внешнее соединение' },
    { label: 'GROUP BY', insertText: 'GROUP BY ${1:column}', type: 'keyword', detail: 'Группировка' },
    { label: 'ORDER BY', insertText: 'ORDER BY ${1:column} ASC', type: 'keyword', detail: 'Сортировка' },
    { label: 'HAVING', insertText: 'HAVING ${1:condition}', type: 'keyword', detail: 'Условие для агрегатов' },
    { label: 'INSERT INTO', insertText: 'INSERT INTO ${1:table} (${2:cols}) VALUES (${3:vals});', type: 'keyword', detail: 'Вставка записей' },
    { label: 'UPDATE', insertText: 'UPDATE ${1:table} SET ${2:col} = ${3:val} WHERE ${4:condition};', type: 'keyword', detail: 'Обновление' },
    { label: 'DELETE FROM', insertText: 'DELETE FROM ${1:table} WHERE ${2:condition};', type: 'keyword', detail: 'Удаление' },
    { label: 'CREATE TABLE', insertText: 'CREATE TABLE ${1:table_name} (\n    id INT PRIMARY KEY AUTO_INCREMENT,\n    ${2:name} VARCHAR(255) NOT NULL\n);', type: 'snippet', detail: 'Создание таблицы' },
    { label: 'COUNT', insertText: 'COUNT(${1:*})', type: 'function', detail: 'Количество строк' },
    { label: 'SUM', insertText: 'SUM(${1:column})', type: 'function', detail: 'Сумма значений' },
    { label: 'AVG', insertText: 'AVG(${1:column})', type: 'function', detail: 'Среднее значение' },
    { label: 'MIN', insertText: 'MIN(${1:column})', type: 'function', detail: 'Минимум' },
    { label: 'MAX', insertText: 'MAX(${1:column})', type: 'function', detail: 'Максимум' },
  ],
};

// Clean snippet placeholders ${1:text} -> text
export function cleanInsertText(text: string): string {
  return text.replace(/\$\{\d+:?([^}]*)\}/g, '$1');
}

// Dynamically extract user-defined functions, classes, methods, and variables from the code
export function extractUserSymbols(code: string, language: string): CodeSuggestion[] {
  const suggestions: CodeSuggestion[] = [];
  const seen = new Set<string>();

  const add = (label: string, type: SuggestionType, detail?: string) => {
    const clean = label.trim();
    if (!clean || clean.length < 2 || seen.has(clean)) return;
    // Don't add numeric-only or basic punctuation
    if (/^\d+$/.test(clean)) return;
    seen.add(clean);
    suggestions.push({
      label: clean,
      insertText: clean,
      type,
      detail: detail || `пользовательский ${type === 'function' ? 'метод / функция' : type === 'class' ? 'класс' : 'идентификатор'}`,
    });
  };

  // 1. Python specific patterns
  if (language === 'python' || language === 'py') {
    // Functions: def my_function(...)
    const funcRegex = /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
      add(match[1], 'function', `def ${match[1]}(${match[2].trim()})`);
    }

    // Classes: class MyClass(...)
    const classRegex = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = classRegex.exec(code)) !== null) {
      add(match[1], 'class', `class ${match[1]}`);
    }

    // Variables: var_name = ...
    const varRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=[^=]/g;
    while ((match = varRegex.exec(code)) !== null) {
      add(match[1], 'variable', `переменная ${match[1]}`);
    }
  }

  // 2. JavaScript / TypeScript specific patterns
  if (language === 'javascript' || language === 'typescript' || language === 'js' || language === 'ts') {
    // Functions: function myFunc(...), const myFunc = (...) =>
    const funcRegex = /(?:function\s+([a-zA-Z_][a-zA-Z0-9_]*)|(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:\([^)]*\)|async\s*\([^)]*\)|function)\s*=>)/g;
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
      const name = match[1] || match[2];
      if (name) add(name, 'function', `функция ${name}()`);
    }

    // Classes / Interfaces / Types
    const classRegex = /(?:class|interface|type|enum)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = classRegex.exec(code)) !== null) {
      add(match[1], 'class', `тип / класс ${match[1]}`);
    }

    // Variables: const x = ..., let y = ..., var z = ...
    const varRegex = /(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
    while ((match = varRegex.exec(code)) !== null) {
      add(match[1], 'variable', `переменная ${match[1]}`);
    }
  }

  // 3. C++ specific patterns
  if (language === 'cpp' || language === 'c') {
    // Functions: type func_name(...) {
    const funcRegex = /(?:void|int|double|float|bool|char|string|auto|vector<[^>]+>)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
      if (match[1] !== 'if' && match[1] !== 'while' && match[1] !== 'for' && match[1] !== 'switch') {
        add(match[1], 'function', `${match[1]}(${match[2].trim()})`);
      }
    }

    // Classes / Structs
    const classRegex = /(?:class|struct)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = classRegex.exec(code)) !== null) {
      add(match[1], 'class', `структура / класс ${match[1]}`);
    }

    // Variables: type var_name = ... or type var_name;
    const varRegex = /(?:int|double|float|bool|char|string|auto|vector<[^>]+>)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(=|;)/g;
    while ((match = varRegex.exec(code)) !== null) {
      add(match[1], 'variable', `переменная ${match[1]}`);
    }
  }

  // 4. General identifier token extractor: catches any other declared names/words
  const identifierRegex = /\b([a-zA-Z_][a-zA-Z0-9_]{2,})\b/g;
  let wordMatch;
  while ((wordMatch = identifierRegex.exec(code)) !== null) {
    const word = wordMatch[1];
    if (!seen.has(word)) {
      add(word, 'variable', `идентификатор ${word}`);
    }
  }

  return suggestions;
}

// Get suggestions matching the current word prefix
export function getSuggestions(
  code: string,
  cursorIndex: number,
  language: string
): { prefix: string; wordStart: number; suggestions: CodeSuggestion[] } | null {
  if (cursorIndex < 0 || cursorIndex > code.length) return null;

  // Find the word before cursor
  let start = cursorIndex;
  while (start > 0 && /[a-zA-Z0-9_.]/.test(code[start - 1])) {
    start--;
  }

  const prefix = code.substring(start, cursorIndex);
  if (!prefix || prefix.length < 1) {
    return null;
  }

  const cleanLang = language.toLowerCase();
  const builtins = [
    ...(LANGUAGE_BUILTINS[cleanLang] || LANGUAGE_BUILTINS['javascript'] || []),
    ...(cleanLang === 'typescript' ? LANGUAGE_BUILTINS['typescript'] : []),
  ];

  const userSymbols = extractUserSymbols(code, cleanLang);

  // Combine and deduplicate
  const allSuggestions: CodeSuggestion[] = [];
  const seenLabels = new Set<string>();

  // Prioritize user symbols first, then builtins
  for (const item of [...userSymbols, ...builtins]) {
    if (!seenLabels.has(item.label)) {
      seenLabels.add(item.label);
      allSuggestions.push(item);
    }
  }

  const lowerPrefix = prefix.toLowerCase();

  // Filter matching suggestions
  const matched = allSuggestions.filter((item) => {
    const lowerLabel = item.label.toLowerCase();
    // Exclude exact match if it's the only word
    if (lowerLabel === lowerPrefix && item.label === prefix) return false;
    return lowerLabel.startsWith(lowerPrefix) || lowerLabel.includes(lowerPrefix);
  });

  // Sort: prefix matches first, shorter names first, user symbols boosted
  matched.sort((a, b) => {
    const aLower = a.label.toLowerCase();
    const bLower = b.label.toLowerCase();
    const aStarts = aLower.startsWith(lowerPrefix);
    const bStarts = bLower.startsWith(lowerPrefix);

    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // User variable/function vs keyword
    if (a.type !== 'keyword' && b.type === 'keyword') return -1;
    if (a.type === 'keyword' && b.type !== 'keyword') return 1;

    return a.label.length - b.label.length || a.label.localeCompare(b.label);
  });

  if (matched.length === 0) return null;

  return {
    prefix,
    wordStart: start,
    suggestions: matched.slice(0, 15), // Top 15 suggestions
  };
}
