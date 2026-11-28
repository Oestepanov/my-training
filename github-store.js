/* GitHub is the only remote service. Credentials never enter repository content. */
(function(root){
 'use strict';
 const FORMAT='my-training-encrypted-v1', STORAGE='my-training-github-v1';
 const REPO='Oestepanov/my-training', BRANCH='training-data', FILE='diary.enc.json';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const catalog=[
  {
    "id": "bench-press",
    "name": "Жим штанги лёжа",
    "muscles": "Грудь · трицепс · передние дельты",
    "description": "Горизонтальный жим штанги на скамье.",
    "hint": "Общий вес штанги вместе с грифом.",
    "group": "Грудь",
    "equipment": "Штанга и скамья"
  },
  {
    "id": "leg-press",
    "name": "Жим ногами",
    "muscles": "Квадрицепс · ягодицы",
    "description": "Разгибание ног в тренажёре с платформой.",
    "hint": "Указывай вес на тренажёре одинаковым способом каждый раз.",
    "group": "Ноги и ягодицы",
    "equipment": "Жим ногами"
  },
  {
    "id": "seated-hammer-curl",
    "name": "Молотки сидя",
    "muscles": "Бицепс · плечевая мышца · предплечья",
    "description": "Сгибание рук с гантелями нейтральным хватом сидя.",
    "hint": "Вес одной гантели.",
    "group": "Бицепс",
    "equipment": "Гантели и скамья"
  },
  {
    "id": "lying-leg-curl",
    "name": "Сгибание ног лёжа",
    "muscles": "Задняя поверхность бедра",
    "description": "Сгибание ног лёжа в тренажёре.",
    "group": "Ноги и ягодицы",
    "equipment": "Тренажёр сгибания ног лёжа"
  },
  {
    "id": "barbell-wrist-curl",
    "name": "Сгибание кистей со штангой",
    "muscles": "Сгибатели предплечья",
    "description": "Сгибание кистей со штангой с опорой для предплечий.",
    "group": "Предплечья",
    "equipment": "Штанга и скамья"
  },
  {
    "id": "incline-bench-press",
    "name": "Жим штанги на наклонной",
    "muscles": "Верх груди · трицепс · передние дельты",
    "description": "Жим штанги на наклонной скамье.",
    "hint": "Общий вес штанги вместе с грифом.",
    "group": "Грудь",
    "equipment": "Штанга и наклонная скамья"
  },
  {
    "id": "lat-pulldown",
    "name": "Вертикальная тяга",
    "muscles": "Широчайшие мышцы спины · бицепс",
    "description": "Тяга верхнего блока к груди.",
    "group": "Спина",
    "equipment": "Верхний блок"
  },
  {
    "id": "seated-cable-row",
    "name": "Нижняя тяга сидя",
    "muscles": "Широчайшие мышцы спины · средняя часть спины · бицепс",
    "description": "Горизонтальная тяга рукоятки нижнего блока к поясу сидя.",
    "group": "Спина",
    "equipment": "Нижний блок"
  },
  {
    "id": "lateral-raise",
    "name": "Махи в стороны",
    "muscles": "Средние дельты",
    "description": "Подъём гантелей через стороны.",
    "hint": "Вес одной гантели.",
    "group": "Плечи",
    "equipment": "Гантели"
  },
  {
    "id": "reverse-pec-deck",
    "name": "Обратная бабочка",
    "muscles": "Задние дельты · верх спины",
    "description": "Разведение рук в тренажёре «Бабочка» лицом к спинке.",
    "group": "Плечи",
    "equipment": "Тренажёр «Бабочка»"
  },
  {
    "id": "assisted-pull-up",
    "name": "Гравитрон (помощь)",
    "muscles": "Грудь / спина · руки — по варианту",
    "description": "Упражнение в гравитроне с противовесом. Группы мышц зависят от варианта: подтягивания или отжимания.",
    "hint": "Записывай вес помощи: меньше помощи — выше нагрузка.",
    "group": "Спина",
    "equipment": "Гравитрон"
  },
  {
    "id": "dumbbell-curl",
    "name": "Сгибание рук с гантелями",
    "muscles": "Бицепс · плечевая мышца",
    "description": "Сгибание рук с гантелями на бицепс.",
    "hint": "Вес одной гантели.",
    "group": "Бицепс",
    "equipment": "Гантели"
  },
  {
    "id": "pec-deck",
    "name": "Бабочка",
    "muscles": "Грудные мышцы",
    "description": "Сведение рук перед собой в тренажёре «Бабочка».",
    "group": "Грудь",
    "equipment": "Тренажёр «Бабочка»"
  },
  {
    "id": "machine-chest-press",
    "name": "Жим от груди в тренажёре",
    "muscles": "Грудь · трицепс · передние дельты",
    "description": "Жим рукояток вперёд от груди сидя с опорой спины.",
    "group": "Грудь",
    "equipment": "Жимовой тренажёр"
  },
  {
    "id": "triceps-pushdown",
    "name": "Разгибание рук на блоке",
    "muscles": "Трицепс",
    "description": "Разгибание рук вниз на верхнем блоке.",
    "group": "Трицепс",
    "equipment": "Верхний блок"
  },
  {
    "id": "pullover",
    "name": "Пуловер",
    "muscles": "Грудь · широчайшие мышцы спины",
    "description": "Опускание и подъём гантели за голову лёжа на скамье.",
    "hint": "Вес одной гантели.",
    "group": "Спина",
    "equipment": "Гантель и скамья"
  },
  {
    "id": "dumbbell-bench-press",
    "name": "Жим гантелей лёжа",
    "group": "Грудь",
    "muscles": "Грудь · трицепс · передние дельты",
    "equipment": "Гантели и скамья",
    "description": "Жим гантелей на горизонтальной скамье. Опускай их в контролируемой амплитуде.",
    "hint": "Записывай вес одной гантели."
  },
  {
    "id": "incline-dumbbell-press",
    "name": "Жим гантелей на наклонной",
    "group": "Грудь",
    "muscles": "Верх груди · трицепс · передние дельты",
    "equipment": "Гантели и наклонная скамья",
    "description": "Жим гантелей на умеренно наклонённой скамье с опорой спины.",
    "hint": "Записывай вес одной гантели."
  },
  {
    "id": "smith-bench-press",
    "name": "Жим лёжа в Смите",
    "group": "Грудь",
    "muscles": "Грудь · трицепс · передние дельты",
    "equipment": "Смит и скамья",
    "description": "Жим грифа в Смите на горизонтальной скамье. Перед подходом настрой упоры.",
    "hint": "Записывай нагрузку одним способом каждый раз. Сопротивление грифа зависит от модели Смита."
  },
  {
    "id": "smith-incline-press",
    "name": "Жим на наклонной в Смите",
    "group": "Грудь",
    "muscles": "Верх груди · трицепс · передние дельты",
    "equipment": "Смит и наклонная скамья",
    "description": "Жим грифа в Смите на наклонной скамье. Подстрой положение скамьи и упоры.",
    "hint": "Записывай нагрузку одним способом каждый раз. Сопротивление грифа зависит от модели Смита."
  },
  {
    "id": "cable-chest-fly",
    "name": "Сведение рук в кроссовере",
    "group": "Грудь",
    "muscles": "Грудные мышцы",
    "equipment": "Две тяги кроссовера",
    "description": "Сведение рукояток перед грудью с небольшим постоянным сгибом локтей.",
    "hint": "Записывай вес на одной стороне кроссовера.",
    "aliases": [
      "кроссовер на грудь",
      "разводка в блоках"
    ]
  },
  {
    "id": "dumbbell-fly",
    "name": "Разведение гантелей лёжа",
    "group": "Грудь",
    "muscles": "Грудные мышцы",
    "equipment": "Гантели и скамья",
    "description": "Разведение рук лёжа с немного согнутыми локтями. Выбирай амплитуду по переносимости плеч.",
    "hint": "Записывай вес одной гантели.",
    "aliases": [
      "разводка гантелей"
    ]
  },
  {
    "id": "incline-dumbbell-fly",
    "name": "Разведение гантелей на наклонной",
    "group": "Грудь",
    "muscles": "Грудные мышцы",
    "equipment": "Гантели и наклонная скамья",
    "description": "Разведение гантелей на наклонной скамье без чрезмерного уведения локтей назад.",
    "hint": "Записывай вес одной гантели."
  },
  {
    "id": "push-up",
    "name": "Отжимания от пола",
    "group": "Грудь",
    "muscles": "Грудь · трицепс · передние дельты",
    "equipment": "Собственный вес",
    "description": "Отжимания с устойчивым корпусом. При необходимости используй опору для рук.",
    "hint": "Без отягощения указывай 0 кг. С отягощением — только добавленный вес."
  },
  {
    "id": "parallel-bar-dip",
    "name": "Отжимания на брусьях",
    "group": "Грудь",
    "muscles": "Грудь · трицепс",
    "equipment": "Брусья",
    "description": "Отжимания на параллельных брусьях в переносимой для плеч амплитуде.",
    "hint": "Записывай только дополнительное отягощение. Без него — 0 кг."
  },
  {
    "id": "lat-pulldown-neutral",
    "name": "Вертикальная тяга нейтральным хватом",
    "group": "Спина",
    "muscles": "Широчайшие мышцы спины · бицепс",
    "equipment": "Верхний блок и параллельная рукоять",
    "description": "Тяга верхнего блока к груди хватом ладонями друг к другу.",
    "hint": "Держи корпус устойчивым и возвращай рукоять под контролем."
  },
  {
    "id": "lat-pulldown-underhand",
    "name": "Вертикальная тяга обратным хватом",
    "group": "Спина",
    "muscles": "Широчайшие мышцы спины · бицепс",
    "equipment": "Верхний блок",
    "description": "Тяга верхнего блока к груди хватом ладонями к себе."
  },
  {
    "id": "single-arm-lat-pulldown",
    "name": "Вертикальная тяга одной рукой",
    "group": "Спина",
    "muscles": "Широчайшие мышцы спины · бицепс",
    "equipment": "Верхний блок и одиночная рукоять",
    "description": "Тяга рукоятки сверху вниз одной рукой с устойчивым положением корпуса.",
    "hint": "Повторы указывай на одну сторону. Вес — на одной рукоятке или одной гантели."
  },
  {
    "id": "chest-supported-dumbbell-row",
    "name": "Тяга гантелей с опорой грудью",
    "group": "Спина",
    "muscles": "Широчайшие · ромбовидные · трапеции · бицепс",
    "equipment": "Гантели и наклонная скамья",
    "description": "Тяга гантелей к корпусу лёжа грудью на наклонной скамье.",
    "hint": "Записывай вес одной гантели."
  },
  {
    "id": "one-arm-dumbbell-row",
    "name": "Тяга гантели одной рукой с опорой",
    "group": "Спина",
    "muscles": "Широчайшие · средняя часть спины · бицепс",
    "equipment": "Гантель и скамья",
    "description": "Тяга гантели к тазу с опорой свободной рукой. Удерживай корпус без разворота.",
    "hint": "Повторы указывай на одну сторону. Вес — на одной рукоятке или одной гантели."
  },
  {
    "id": "seated-cable-row-wide",
    "name": "Нижняя тяга широким хватом",
    "group": "Спина",
    "muscles": "Средняя часть спины · задние дельты · бицепс",
    "equipment": "Нижний блок и широкая рукоять",
    "description": "Тяга нижнего блока к верхней части живота широким хватом с устойчивым корпусом."
  },
  {
    "id": "single-arm-cable-row",
    "name": "Нижняя тяга одной рукой",
    "group": "Спина",
    "muscles": "Широчайшие · средняя часть спины · бицепс",
    "equipment": "Нижний блок и одиночная рукоять",
    "description": "Горизонтальная тяга рукоятки одной рукой. Сохраняй устойчивое положение таза.",
    "hint": "Повторы указывай на одну сторону. Вес — на одной рукоятке или одной гантели."
  },
  {
    "id": "straight-arm-pulldown",
    "name": "Тяга верхнего блока прямыми руками",
    "group": "Спина",
    "muscles": "Широчайшие мышцы спины",
    "equipment": "Верхний блок",
    "description": "Опускание рукоятки от уровня плеч к бёдрам при почти прямых руках.",
    "hint": "Сохраняй небольшой сгиб локтей и контролируй положение корпуса.",
    "aliases": [
      "пуловер на блоке"
    ]
  },
  {
    "id": "pull-up",
    "name": "Подтягивания прямым хватом",
    "group": "Спина",
    "muscles": "Широчайшие · верх спины · бицепс",
    "equipment": "Турник",
    "description": "Подтягивания хватом ладонями от себя с контролируемым опусканием.",
    "hint": "Вес — только дополнительное отягощение. Без него — 0 кг."
  },
  {
    "id": "chin-up",
    "name": "Подтягивания обратным хватом",
    "group": "Спина",
    "muscles": "Широчайшие мышцы спины · бицепс",
    "equipment": "Турник",
    "description": "Подтягивания хватом ладонями к себе с контролируемым опусканием.",
    "hint": "Вес — только дополнительное отягощение. Без него — 0 кг."
  },
  {
    "id": "assisted-dips",
    "name": "Отжимания в гравитроне",
    "group": "Грудь",
    "muscles": "Грудь · трицепс",
    "equipment": "Гравитрон",
    "description": "Отжимания на брусьях гравитрона с помощью противовеса.",
    "hint": "Указывай вес помощи. Меньше помощи — выше нагрузка."
  },
  {
    "id": "gravitron-pull-up",
    "name": "Подтягивания в гравитроне",
    "group": "Спина",
    "muscles": "Широчайшие · верх спины · бицепс",
    "equipment": "Гравитрон",
    "description": "Подтягивания в гравитроне с помощью противовеса.",
    "hint": "Указывай вес помощи. Меньше помощи — выше нагрузка."
  },
  {
    "id": "barbell-bent-row",
    "name": "Тяга штанги в наклоне",
    "group": "Спина",
    "muscles": "Широчайшие · средняя часть спины · бицепс",
    "equipment": "Штанга",
    "description": "Тяга штанги к корпусу с удержанием положения в наклоне.",
    "hint": "Записывай общий вес штанги вместе с грифом.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "seated-dumbbell-shoulder-press",
    "name": "Жим гантелей сидя",
    "group": "Плечи",
    "muscles": "Передние и средние дельты · трицепс",
    "equipment": "Гантели и скамья со спинкой",
    "description": "Жим гантелей вверх сидя с опорой спины.",
    "hint": "Записывай вес одной гантели."
  },
  {
    "id": "machine-shoulder-press",
    "name": "Жим вверх в тренажёре",
    "group": "Плечи",
    "muscles": "Передние и средние дельты · трицепс",
    "equipment": "Многопозиционный жимовой тренажёр",
    "description": "Жим рукояток вверх. Используй положение тренажёра для жима от плеч."
  },
  {
    "id": "smith-shoulder-press",
    "name": "Жим вверх сидя в Смите",
    "group": "Плечи",
    "muscles": "Передние и средние дельты · трицепс",
    "equipment": "Смит и скамья со спинкой",
    "description": "Жим грифа перед собой вверх сидя с опорой спины. Настрой ограничители.",
    "hint": "Записывай нагрузку одним способом каждый раз. Сопротивление грифа зависит от модели Смита."
  },
  {
    "id": "cable-lateral-raise",
    "name": "Махи в сторону на нижнем блоке",
    "group": "Плечи",
    "muscles": "Средние дельты",
    "equipment": "Нижний блок и одиночная рукоять",
    "description": "Подъём руки в сторону на нижнем блоке без раскачивания корпуса.",
    "hint": "Повторы указывай на одну сторону. Вес — на одной рукоятке или одной гантели."
  },
  {
    "id": "chest-supported-rear-delt-fly",
    "name": "Разведение гантелей с опорой грудью",
    "group": "Плечи",
    "muscles": "Задние дельты · верх спины",
    "equipment": "Гантели и наклонная скамья",
    "description": "Разведение рук в стороны лёжа грудью на наклонной скамье.",
    "hint": "Записывай вес одной гантели."
  },
  {
    "id": "cable-reverse-fly",
    "name": "Обратное разведение в кроссовере",
    "group": "Плечи",
    "muscles": "Задние дельты · средняя часть спины",
    "equipment": "Две тяги кроссовера",
    "description": "Разведение рук назад на блоках на уровне плеч.",
    "hint": "Указывай вес на одной стороне кроссовера."
  },
  {
    "id": "face-pull",
    "name": "Тяга каната к лицу",
    "group": "Плечи",
    "muscles": "Задние дельты · верх спины",
    "equipment": "Верхний блок и канат",
    "description": "Тяга каната к уровню лица с разведением концов каната.",
    "hint": "Выбирай вес, при котором можно удерживать корпус устойчивым.",
    "aliases": [
      "фейс пул",
      "face pull"
    ]
  },
  {
    "id": "dumbbell-shrug",
    "name": "Шраги с гантелями",
    "group": "Плечи",
    "muscles": "Верхние пучки трапеций",
    "equipment": "Гантели",
    "description": "Подъём плеч вверх с гантелями в опущенных руках.",
    "hint": "Записывай вес одной гантели.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "barbell-curl",
    "name": "Сгибание рук со штангой",
    "group": "Бицепс",
    "muscles": "Бицепс · плечевая мышца",
    "equipment": "Штанга",
    "description": "Сгибание рук со штангой перед собой без раскачивания корпуса.",
    "hint": "Записывай общий вес штанги вместе с грифом."
  },
  {
    "id": "ez-bar-curl",
    "name": "Сгибание рук с EZ-грифом",
    "group": "Бицепс",
    "muscles": "Бицепс · плечевая мышца",
    "equipment": "EZ-гриф",
    "description": "Сгибание рук с изогнутым грифом удобным для запястий хватом.",
    "hint": "Нужен EZ-гриф. Записывай общий вес вместе с грифом."
  },
  {
    "id": "incline-dumbbell-curl",
    "name": "Сгибание гантелей на наклонной",
    "group": "Бицепс",
    "muscles": "Бицепс",
    "equipment": "Гантели и наклонная скамья",
    "description": "Сгибание рук сидя с опорой спины на наклонной скамье.",
    "hint": "Записывай вес одной гантели."
  },
  {
    "id": "concentration-curl",
    "name": "Концентрированное сгибание руки",
    "group": "Бицепс",
    "muscles": "Бицепс · плечевая мышца",
    "equipment": "Гантель и скамья",
    "description": "Сгибание одной руки сидя с опорой локтя о внутреннюю сторону бедра.",
    "hint": "Повторы указывай на одну сторону. Вес — на одной рукоятке или одной гантели."
  },
  {
    "id": "cable-curl",
    "name": "Сгибание рук на нижнем блоке",
    "group": "Бицепс",
    "muscles": "Бицепс · плечевая мышца",
    "equipment": "Нижний блок",
    "description": "Сгибание рук с рукояткой нижнего блока при устойчивом положении локтей."
  },
  {
    "id": "preacher-curl",
    "name": "Сгибание рук на скамье Скотта",
    "group": "Бицепс",
    "muscles": "Бицепс · плечевая мышца",
    "equipment": "Скамья Скотта и гриф",
    "description": "Сгибание рук с опорой плеч на наклонную подушку скамьи Скотта.",
    "hint": "Записывай общий вес грифа с отягощением. Контролируй нижнюю часть движения."
  },
  {
    "id": "standing-hammer-curl",
    "name": "Молотки стоя",
    "group": "Бицепс",
    "muscles": "Бицепс · плечевая мышца · предплечья",
    "equipment": "Гантели",
    "description": "Сгибание рук с гантелями нейтральным хватом стоя.",
    "hint": "Записывай вес одной гантели."
  },
  {
    "id": "rope-triceps-pushdown",
    "name": "Разгибание рук с канатом",
    "group": "Трицепс",
    "muscles": "Трицепс",
    "equipment": "Верхний блок и канат",
    "description": "Разгибание рук вниз с канатом при устойчивом положении плеч."
  },
  {
    "id": "overhead-cable-triceps-extension",
    "name": "Разгибание рук над головой на блоке",
    "group": "Трицепс",
    "muscles": "Трицепс",
    "equipment": "Блок и канат",
    "description": "Разгибание локтей с рукояткой за головой. Удерживай положение корпуса."
  },
  {
    "id": "single-arm-triceps-pushdown",
    "name": "Разгибание одной руки на блоке",
    "group": "Трицепс",
    "muscles": "Трицепс",
    "equipment": "Верхний блок и одиночная рукоять",
    "description": "Разгибание локтя одной руки вниз на блоке.",
    "hint": "Повторы указывай на одну сторону. Вес — на одной рукоятке или одной гантели."
  },
  {
    "id": "lying-triceps-extension",
    "name": "Французский жим лёжа",
    "group": "Трицепс",
    "muscles": "Трицепс",
    "equipment": "Штанга или EZ-гриф и скамья",
    "description": "Разгибание локтей со штангой лёжа на скамье в комфортной для локтей амплитуде.",
    "hint": "Записывай общий вес штанги вместе с грифом."
  },
  {
    "id": "seated-dumbbell-triceps-extension",
    "name": "Разгибание гантели из-за головы сидя",
    "group": "Трицепс",
    "muscles": "Трицепс",
    "equipment": "Гантель и скамья со спинкой",
    "description": "Разгибание локтей с одной гантелью, удерживаемой двумя руками за головой.",
    "hint": "Записывай вес одной общей гантели."
  },
  {
    "id": "close-grip-bench-press",
    "name": "Жим штанги узким хватом",
    "group": "Трицепс",
    "muscles": "Трицепс · грудь · передние дельты",
    "equipment": "Штанга и скамья",
    "description": "Жим лёжа хватом примерно на ширине плеч, с контролем положения запястий.",
    "hint": "Записывай общий вес штанги вместе с грифом."
  },
  {
    "id": "reverse-curl",
    "name": "Сгибание рук обратным хватом",
    "group": "Предплечья",
    "muscles": "Плечелучевая мышца · бицепс · предплечья",
    "equipment": "Штанга",
    "description": "Сгибание рук со штангой хватом ладонями вниз.",
    "hint": "Записывай общий вес штанги вместе с грифом."
  },
  {
    "id": "reverse-wrist-curl",
    "name": "Разгибание кистей со штангой",
    "group": "Предплечья",
    "muscles": "Разгибатели предплечья",
    "equipment": "Штанга и скамья",
    "description": "Разгибание кистей с опорой предплечий, ладони направлены вниз.",
    "hint": "Записывай общий вес штанги вместе с грифом."
  },
  {
    "id": "leg-extension",
    "name": "Разгибание ног сидя",
    "group": "Ноги и ягодицы",
    "muscles": "Квадрицепс",
    "equipment": "Тренажёр разгибания ног",
    "description": "Разгибание коленей сидя в тренажёре с опорой спины. Совмести ось тренажёра с коленом."
  },
  {
    "id": "hip-abduction-machine",
    "name": "Разведение ног в тренажёре",
    "group": "Ноги и ягодицы",
    "muscles": "Средние и малые ягодичные мышцы",
    "equipment": "Тренажёр разведения ног",
    "description": "Разведение бёдер сидя в тренажёре с контролируемым возвратом."
  },
  {
    "id": "hip-adduction-machine",
    "name": "Сведение ног в тренажёре",
    "group": "Ноги и ягодицы",
    "muscles": "Приводящие мышцы бедра",
    "equipment": "Тренажёр сведения ног",
    "description": "Сведение бёдер сидя в тренажёре в комфортной амплитуде."
  },
  {
    "id": "single-leg-press",
    "name": "Жим ногой поочерёдно",
    "group": "Ноги и ягодицы",
    "muscles": "Квадрицепс · ягодицы",
    "equipment": "Жим ногами",
    "description": "Жим платформы одной ногой с устойчивым положением таза.",
    "hint": "Вес — на тренажёре. Повторы — на одну ногу."
  },
  {
    "id": "goblet-squat",
    "name": "Гоблет-присед с гантелью",
    "group": "Ноги и ягодицы",
    "muscles": "Квадрицепс · ягодицы",
    "equipment": "Гантель",
    "description": "Приседание с одной гантелью перед грудью в контролируемой амплитуде.",
    "hint": "Записывай вес одной гантели.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "smith-squat",
    "name": "Приседания в Смите",
    "group": "Ноги и ягодицы",
    "muscles": "Квадрицепс · ягодицы",
    "equipment": "Смит",
    "description": "Приседания с грифом в Смите. Подстрой положение стоп и ограничители.",
    "hint": "Записывай нагрузку одним способом каждый раз. Сопротивление грифа зависит от модели Смита.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "barbell-back-squat",
    "name": "Приседания со штангой",
    "group": "Ноги и ягодицы",
    "muscles": "Квадрицепс · ягодицы · мышцы корпуса",
    "equipment": "Штанга и стойки",
    "description": "Приседания со штангой на верхней части спины с настроенными страховочными упорами.",
    "hint": "Записывай общий вес штанги вместе с грифом.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "hack-squat",
    "name": "Гакк-присед в тренажёре",
    "group": "Ноги и ягодицы",
    "muscles": "Квадрицепс · ягодицы",
    "equipment": "Гакк-тренажёр",
    "description": "Приседание в тренажёре с опорой спины и плечевыми подушками.",
    "hint": "Указывай вес нагрузки одним способом каждый раз.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "split-squat",
    "name": "Сплит-присед с гантелями",
    "group": "Ноги и ягодицы",
    "muscles": "Квадрицепс · ягодицы",
    "equipment": "Гантели",
    "description": "Приседания в разножке, обе стопы остаются на полу.",
    "hint": "Записывай вес одной гантели. Повторы — на одну ногу.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "bulgarian-split-squat",
    "name": "Болгарский сплит-присед",
    "group": "Ноги и ягодицы",
    "muscles": "Квадрицепс · ягодицы",
    "equipment": "Гантели и скамья",
    "description": "Приседания в разножке с задней стопой на устойчивой опоре.",
    "hint": "Записывай вес одной гантели. Повторы — на одну ногу.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "reverse-lunge",
    "name": "Выпады назад с гантелями",
    "group": "Ноги и ягодицы",
    "muscles": "Квадрицепс · ягодицы",
    "equipment": "Гантели",
    "description": "Выпады с шагом назад и контролируемым возвращением в исходное положение.",
    "hint": "Записывай вес одной гантели. Повторы — на одну ногу.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "dumbbell-romanian-deadlift",
    "name": "Румынская тяга с гантелями",
    "group": "Ноги и ягодицы",
    "muscles": "Задняя поверхность бедра · ягодицы",
    "equipment": "Гантели",
    "description": "Наклон за счёт отведения таза назад с немного согнутыми коленями. Гантели держи близко к ногам.",
    "hint": "Записывай вес одной гантели.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "barbell-romanian-deadlift",
    "name": "Румынская тяга со штангой",
    "group": "Ноги и ягодицы",
    "muscles": "Задняя поверхность бедра · ягодицы",
    "equipment": "Штанга",
    "description": "Наклон с отведением таза назад и контролируемым положением поясницы.",
    "hint": "Записывай общий вес штанги вместе с грифом.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "barbell-deadlift",
    "name": "Становая тяга классическая",
    "group": "Ноги и ягодицы",
    "muscles": "Ягодицы · задняя поверхность бедра · разгибатели спины",
    "equipment": "Штанга",
    "description": "Подъём штанги с пола за счёт разгибания ног и тазобедренных суставов.",
    "hint": "Записывай общий вес штанги вместе с грифом.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "barbell-hip-thrust",
    "name": "Ягодичный мост со штангой у скамьи",
    "group": "Ноги и ягодицы",
    "muscles": "Большие ягодичные мышцы",
    "equipment": "Штанга и устойчивая скамья",
    "description": "Разгибание таза со штангой на бёдрах, верх спины опирается на скамью.",
    "hint": "Записывай общий вес штанги вместе с грифом. Используй подкладку под гриф.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом.",
    "aliases": [
      "хип траст",
      "hip thrust"
    ]
  },
  {
    "id": "glute-bridge",
    "name": "Ягодичный мост на полу",
    "group": "Ноги и ягодицы",
    "muscles": "Большие ягодичные мышцы",
    "equipment": "Коврик",
    "description": "Подъём таза лёжа на спине с опорой на стопы. Контролируй положение корпуса.",
    "hint": "Без отягощения — 0 кг. При использовании гантели — её вес."
  },
  {
    "id": "cable-glute-kickback",
    "name": "Отведение ноги назад на блоке",
    "group": "Ноги и ягодицы",
    "muscles": "Большие ягодичные мышцы",
    "equipment": "Нижний блок и манжета для ноги",
    "description": "Отведение ноги назад с опорой рукой без разворота таза.",
    "hint": "Нужна манжета для ноги. Повторы указывай на одну ногу."
  },
  {
    "id": "leg-press-calf-raise",
    "name": "Подъёмы на носки в жиме ногами",
    "group": "Икры",
    "muscles": "Икроножные · камбаловидные мышцы",
    "equipment": "Жим ногами",
    "description": "Подъём платформы движением голеностопа при устойчивой опоре передней части стоп.",
    "hint": "Выполняй, если конструкция платформы позволяет надёжно удерживать стопы."
  },
  {
    "id": "smith-standing-calf-raise",
    "name": "Подъёмы на носки стоя в Смите",
    "group": "Икры",
    "muscles": "Икроножные · камбаловидные мышцы",
    "equipment": "Смит",
    "description": "Подъёмы на носки с грифом Смита на плечах и контролируемым опусканием пяток.",
    "hint": "Записывай нагрузку одним способом каждый раз. Сопротивление грифа зависит от модели Смита.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  },
  {
    "id": "seated-dumbbell-calf-raise",
    "name": "Подъёмы на носки сидя с гантелью",
    "group": "Икры",
    "muscles": "Камбаловидные · икроножные мышцы",
    "equipment": "Гантель и скамья",
    "description": "Подъёмы пяток сидя с гантелью на бедре ближе к колену. Поддерживай гантель руками.",
    "hint": "Выполняй по одной ноге. Указывай вес гантели и повторы на одну ногу."
  },
  {
    "id": "crunch",
    "name": "Скручивания на полу",
    "group": "Кор",
    "muscles": "Прямая мышца живота",
    "equipment": "Коврик",
    "description": "Небольшой подъём верхней части туловища лёжа на спине.",
    "hint": "Без отягощения — 0 кг.",
    "backNote": "Переносимость сгибания туловища при проблемах поясницы индивидуальна. Движение не должно усиливать симптомы."
  },
  {
    "id": "reverse-crunch",
    "name": "Обратные скручивания",
    "group": "Кор",
    "muscles": "Прямая мышца живота",
    "equipment": "Коврик",
    "description": "Контролируемое подкручивание таза лёжа на спине с согнутыми коленями.",
    "hint": "Без отягощения — 0 кг.",
    "backNote": "Переносимость сгибания поясницы индивидуальна. Подбирай амплитуду по симптомам."
  },
  {
    "id": "dead-bug",
    "name": "Мёртвый жук",
    "group": "Кор",
    "muscles": "Мышцы живота · стабилизаторы корпуса",
    "equipment": "Коврик",
    "description": "Поочерёдное опускание противоположных руки и ноги лёжа на спине, сохраняя устойчивое положение корпуса.",
    "hint": "Указывай 0 кг и повторы на одну сторону.",
    "aliases": [
      "dead bug"
    ]
  },
  {
    "id": "bird-dog",
    "name": "Птица-собака",
    "group": "Кор",
    "muscles": "Стабилизаторы корпуса · ягодицы · мышцы спины",
    "equipment": "Коврик",
    "description": "Вытягивание противоположных руки и ноги из положения на четвереньках с контролем таза.",
    "hint": "Указывай 0 кг и повторы на одну сторону.",
    "aliases": [
      "bird dog"
    ]
  },
  {
    "id": "pallof-press",
    "name": "Жим Палоффа на блоке",
    "group": "Кор",
    "muscles": "Косые мышцы живота · стабилизаторы корпуса",
    "equipment": "Кроссовер и рукоять",
    "description": "Выпрямление рук перед собой стоя боком к блоку с сопротивлением развороту корпуса.",
    "hint": "Указывай вес блока и повторы на одну сторону.",
    "aliases": [
      "антивращение",
      "pallof press"
    ]
  },
  {
    "id": "back-extension",
    "name": "Гиперэкстензия",
    "group": "Кор",
    "muscles": "Разгибатели спины · ягодицы · задняя поверхность бедра",
    "equipment": "Скамья для гиперэкстензии",
    "description": "Разгибание в тазобедренных суставах с опорой бёдрами на подушки. Подъём до линии корпуса.",
    "hint": "Без отягощения — 0 кг. С отягощением — вес удерживаемого диска или гантели.",
    "backNote": "С учётом грыжи поясницы вариант, амплитуду и нагрузку подбирай индивидуально с очным специалистом."
  }
];
 const catalogById=new Map(catalog.map(e=>[e.id,e]));
 const normalizeName=s=>String(s||'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const catalogByName=new Map(catalog.map(e=>[normalizeName(e.name),e]));
 for(const [alias,id] of [['Пулловер','pullover'],['Гравитрон','assisted-pull-up'],['Жим штанги на наклонной скамье','incline-bench-press']])catalogByName.set(normalizeName(alias),catalogById.get(id));
 function exerciseInfo(exercise){
  if(typeof exercise==='string')return catalogById.get(exercise)||null;
  return catalogById.get(exercise.id||exercise.exerciseId)||catalogByName.get(normalizeName(exercise.name))||null;
 }
 function exerciseKey(exercise){return exerciseInfo(exercise)?.id||(typeof exercise==='string'?exercise:exercise.id||exercise.exerciseId);}
 function normalizeExercises(items){
  const ids=new Set();return items.map(e=>{const known=exerciseInfo(e);return known?{id:known.id,name:known.name}:clone(e);}).filter(e=>{if(ids.has(e.id))return false;ids.add(e.id);return true;});
 }
 function normalizePrograms(doc){
  for(const w of doc.workouts){w.exercises=normalizeExercises(w.exercises);if(w.archivedExercises)w.archivedExercises=normalizeExercises(w.archivedExercises).filter(e=>!w.exercises.some(x=>x.id===e.id));}
  return doc;
 }
 const sameExercises=(a,b)=>JSON.stringify(a.map(e=>({id:e.id,name:e.name})))===JSON.stringify(b.map(e=>({id:e.id,name:e.name})));
 function validateExercises(items){
  if(!Array.isArray(items)||items.length<1||items.length>catalog.length)throw new Error('Выбери хотя бы одно упражнение из списка.');
  const ids=new Set();return items.map(e=>{
   const known=catalogById.get(e.id);
   if(!known||ids.has(e.id)||(e.name!=null&&e.name!==known.name))throw new Error('Выбирай упражнения из списка. Одно упражнение можно добавить в тренировку один раз.');
   ids.add(e.id);return {id:known.id,name:known.name};
  });
 }
 function applyProgram(workout,exercises){
  const archived=new Map([...(workout.archivedExercises||[]),...workout.exercises].map(e=>[e.id,clone(e)]));
  exercises.forEach(e=>archived.delete(e.id));
  workout.archivedExercises=[...archived.values()];workout.exercises=clone(exercises);
 }
 const bytesTo64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
 const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const keyBytes=s=>from64(s.replace(/-/g,'+').replace(/_/g,'/'));
 function empty(workouts){return {schemaVersion:3,workouts:clone(workouts),entries:[]};}
 function validateDoc(doc){
  if(doc?.schemaVersion!==3||!Array.isArray(doc.workouts)||!Array.isArray(doc.entries))throw new Error('Неподдерживаемый формат дневника. Данные не изменены.');
  const ids=new Set();
  for(const e of doc.entries){if(typeof e.id!=='string'||ids.has(e.id)||!Number.isInteger(e.version)||e.version<0||!Array.isArray(e.exercises))throw new Error('Повреждённый файл дневника. Данные не изменены.');ids.add(e.id);}
  return doc;
 }
 async function encrypt(doc,key,cryptoApi=root.crypto){
  const raw=keyBytes(key);if(raw.length!==32)throw new Error('Код восстановления должен содержать 32 байта.');
  const imported=await cryptoApi.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
  const iv=cryptoApi.getRandomValues(new Uint8Array(12));
  const data=new TextEncoder().encode(JSON.stringify(validateDoc(doc)));
  const encrypted=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv},imported,data);
  return {format:FORMAT,iv:bytesTo64(iv),ciphertext:bytesTo64(new Uint8Array(encrypted))};
 }
 async function decrypt(envelope,key,cryptoApi=root.crypto){
  if(envelope?.format!==FORMAT)throw new Error('Неподдерживаемый зашифрованный файл.');
  try{
   const raw=keyBytes(key);if(raw.length!==32)throw new Error();
   const imported=await cryptoApi.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
   const plain=await cryptoApi.subtle.decrypt({name:'AES-GCM',iv:from64(envelope.iv)},imported,from64(envelope.ciphertext));
   return validateDoc(JSON.parse(new TextDecoder().decode(plain)));
  }catch{throw new Error('Код восстановления не подходит или файл повреждён. Данные не изменены.');}
 }
 class GitHubStore{
  constructor(options={}){
   this.storage=options.storage||root.localStorage;this.fetch=options.fetch||root.fetch.bind(root);this.crypto=options.crypto||root.crypto;
   this.workouts=options.workouts||[];this.lock=options.lock||((fn)=>root.navigator?.locks?root.navigator.locks.request(STORAGE,fn):fn());
   this.chain=Promise.resolve();this.status={kind:'disconnected',message:'Подключи GitHub для общей истории.'};this.conflicts=[];this.load();
  }
  load(){
   let saved;try{saved=JSON.parse(this.storage.getItem(STORAGE)||'null');}catch{throw new Error('Не удалось прочитать память браузера. Сохранённые данные не заменены.');}
   this.settings=saved?.settings||null;this.doc=normalizePrograms(saved?.doc?validateDoc(saved.doc):empty(this.workouts));this.pending=saved?.pending||[];this.pendingPrograms=saved?.pendingPrograms||[];this.lastSynced=saved?.lastSynced||null;
   for(const op of this.pendingPrograms){op.baseExercises=normalizeExercises(op.baseExercises);op.exercises=normalizeExercises(op.exercises);}
  }
  persist(){
   try{this.storage.setItem(STORAGE,JSON.stringify({settings:this.settings,doc:this.doc,pending:this.pending,pendingPrograms:this.pendingPrograms,lastSynced:this.lastSynced}));}
   catch{throw new Error('Память браузера недоступна или заполнена. Запись не подтверждена; скачай резервную копию.');}
  }
  run(fn){const next=this.chain.then(()=>this.lock(async()=>{this.load();return fn();}));this.chain=next.catch(()=>{});return next;}
  get connected(){return Boolean(this.settings?.token&&this.settings?.key);}
  get pendingCount(){return this.pending.length+this.pendingPrograms.length;}
  data(){
   const entries=this.doc.entries.filter(e=>!e.deleted).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)));
   return {schemaVersion:2,workouts:clone(this.doc.workouts),history:clone(entries),trash:clone(this.doc.entries.filter(e=>e.deleted)),editable:this.connected};
  }
  async api(path,options={}){
   let res;try{res=await this.fetch('https://api.github.com/repos/'+REPO+path,{...options,credentials:'omit',cache:'no-store',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+this.settings.token,'X-GitHub-Api-Version':'2022-11-28',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal:AbortSignal.timeout(20000)});}
   catch{throw new Error('GitHub недоступен. Сохранённые на устройстве изменения будут отправлены при восстановлении связи.');}
   if(!res.ok){const error=new Error(res.status===401?'GitHub отклонил ключ доступа. Проверь срок действия ключа.':res.status===403?'GitHub не разрешил запись или временно ограничил запросы. Проверь доступ Contents: Read and write.':res.status===404?'Файл дневника не найден или ключу не разрешён доступ к my-training.':res.status===409?'Дневник одновременно изменился на другом устройстве.':'GitHub вернул ошибку '+res.status+'. Локальные записи сохранены.');error.status=res.status;throw error;}
   return res.json();
  }
  async remote(){
   const value=await this.api('/contents/'+FILE+'?ref='+BRANCH);
   if(value.encoding!=='base64'||!value.content||!value.sha)throw new Error('GitHub вернул неполный файл. Локальные записи сохранены.');
   const raw=new TextDecoder().decode(from64(value.content.replace(/\s/g,'')));
   const doc=await decrypt(JSON.parse(raw),this.settings.key,this.crypto),before=JSON.stringify(doc.workouts);
   normalizePrograms(doc);
   return {sha:value.sha,doc,programUpgrade:before!==JSON.stringify(doc.workouts)};
  }
  async connect(input){return this.run(async()=>{
   let token=String(input.token||'').trim(),key=String(input.key||'').replace(/\s/g,'');
   if(input.code){try{const raw=String(input.code).trim();if(!raw.startsWith('MT1.'))throw new Error();const parsed=JSON.parse(new TextDecoder().decode(from64(raw.slice(4))));token=parsed.token;key=parsed.key;}catch{throw new Error('Неверный код подключения. Скопируй его целиком с первого устройства.');}}
   if(typeof token!=='string'||!/^github_pat_[A-Za-z0-9_]+$|^ghp_[A-Za-z0-9]+$/.test(token)||token.length<25)throw new Error('Вставь ключ GitHub, начинающийся с github_pat_.');
   try{if(keyBytes(key).length!==32)throw new Error();}catch{throw new Error('Вставь код восстановления из сообщения о переносе дневника.');}
   if(this.pendingCount&&this.settings?.key!==key)throw new Error('На устройстве есть неотправленные изменения другого подключения. Сначала синхронизируй их.');
   const previous=this.settings;this.settings={token,key};
   try{const remote=await this.remote();this.settings={token,key};this.doc=this.replay(remote.doc,this.pending).doc;this.persist();return await this.syncUnlocked();}
   catch(e){if(!this.pendingCount){this.settings=previous;this.load();}throw e;}
  });}
  connectionCode(){if(!this.connected)throw new Error('Сначала подключи GitHub.');return 'MT1.'+bytesTo64(new TextEncoder().encode(JSON.stringify({token:this.settings.token,key:this.settings.key})));}
  async disconnect(){return this.run(async()=>{if(this.pendingCount)throw new Error('Сначала отправь ожидающие изменения. Подключение сохранено.');this.settings=null;this.doc=empty(this.workouts);this.lastSynced=null;this.persist();this.status={kind:'disconnected',message:'Устройство отключено. Дневник на GitHub сохранён.'};});}
  replay(remote,operations,programs=this.pendingPrograms){
   const doc=clone(remote),conflicts=[],acknowledged=[];
   for(const op of programs){
    const workout=doc.workouts.find(w=>w.id===op.workoutId);
    if(!workout)throw new Error('Тренировка не найдена. Локальная программа сохранена.');
    if(sameExercises(workout.exercises,op.exercises)){acknowledged.push(op.opId);continue;}
    if(!sameExercises(workout.exercises,op.baseExercises)){
     conflicts.push({kind:'program',id:'program-'+op.workoutId,workoutId:op.workoutId,local:clone(op.exercises),remote:clone(workout.exercises)});continue;
    }
    applyProgram(workout,op.exercises);
   }
   for(const op of operations){
    const index=doc.entries.findIndex(e=>e.id===op.id),current=doc.entries[index];
    if(current?.lastOperation===op.opId){acknowledged.push(op.opId);continue;}
    if((current?.version??null)!==op.baseVersion){conflicts.push({id:op.id,local:clone(op.value),remote:current?clone(current):null});continue;}
    const value={...clone(op.value),version:(current?.version||0)+1,lastOperation:op.opId};
    if(index<0)doc.entries.push(value);else doc.entries[index]=value;
   }
   return {doc,conflicts,acknowledged};
  }
  async sync(){return this.run(()=>this.syncUnlocked());}
  async syncUnlocked(){
   if(!this.connected)return this.data();
   this.status={kind:'syncing',message:'Синхронизация с GitHub…'};
   try{
    for(let attempt=0;attempt<3;attempt++){
     const remote=await this.remote(),operations=clone(this.pending),programs=clone(this.pendingPrograms),merged=this.replay(remote.doc,operations,programs);
     this.conflicts=merged.conflicts;
     if(merged.conflicts.length){
      // Keep local values visible and queue intact until the user decides.
      const visible=clone(merged.doc);for(const conflict of merged.conflicts){
       if(conflict.kind==='program'){applyProgram(visible.workouts.find(w=>w.id===conflict.workoutId),conflict.local);continue;}
       const i=visible.entries.findIndex(e=>e.id===conflict.id);if(i<0)visible.entries.push(conflict.local);else visible.entries[i]=conflict.local;
      }
      this.doc=visible;this.persist();this.status={kind:'conflict',message:'На двух устройствах изменены одни данные. Выбери версию в настройках синхронизации.'};return this.data();
     }
     const toWrite=[...operations,...programs].filter(o=>!merged.acknowledged.includes(o.opId));
     if(toWrite.length||remote.programUpgrade){
      const envelope=await encrypt(merged.doc,this.settings.key,this.crypto);
      try{await this.api('/contents/'+FILE,{method:'PUT',body:JSON.stringify({message:'Sync training diary',branch:BRANCH,sha:remote.sha,content:bytesTo64(new TextEncoder().encode(JSON.stringify(envelope)))})});}
      catch(e){if(e.status===409||e.status===422){if(attempt<2)continue;}throw e;}
     }
     this.doc=merged.doc;this.pending=[];this.pendingPrograms=[];this.lastSynced=new Date().toISOString();this.persist();this.status={kind:'synced',message:'Все изменения сохранены на GitHub.'};return this.data();
    }
   }catch(e){this.status={kind:'offline',message:e.message};throw e;}
  }
  validateSession(value){
   const workout=this.doc.workouts.find(w=>w.id===String(value.workoutId));
   if(!workout||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!Number.isFinite(Date.parse(value.date))||new Date(value.date).toISOString().slice(0,10)!==value.date)throw new Error('Проверь дату и номер тренировки.');
   const current=this.doc.entries.find(e=>e.id===value.id);
   if(current&&current.workoutId!==workout.id)throw new Error('Нельзя изменить номер сохранённой тренировки.');
   const known=[...(current?current.exercises.map(e=>({id:e.exerciseId,name:e.name})):[]),...workout.exercises,...(workout.archivedExercises||[]),...catalog];
   if(typeof value.id!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(value.id)||!Array.isArray(value.exercises)||!value.exercises.length||value.exercises.length>200)throw new Error('Неверная запись тренировки.');
   const ids=new Set();const exercises=value.exercises.map(item=>{
    const ex=known.find(e=>e.id===item.exerciseId);
    if(!ex||ids.has(ex.id))throw new Error('Список упражнений изменился. Обнови программу; черновик сохранён.');
    ids.add(ex.id);
    if(!item||!Array.isArray(item.setDetails)||!item.setDetails.length||item.setDetails.length>12)throw new Error('Проверь количество подходов.');
    const setDetails=item.setDetails.map(s=>{if(typeof s.weight!=='number'||!Number.isFinite(s.weight)||s.weight<0||s.weight>1000||!Number.isInteger(s.reps)||s.reps<1||s.reps>200||typeof s.done!=='boolean')throw new Error('Проверь вес и повторы.');return {weight:s.weight,reps:s.reps,done:s.done};});
    const done=setDetails.filter(s=>s.done);return {exerciseId:ex.id,name:ex.name,setDetails,completed:!!done.length,weight:done[0]?.weight??setDetails[0].weight,reps:done[0]?.reps??setDetails[0].reps,sets:done.length};
   });
   if(!exercises.some(e=>e.completed))throw new Error('Отметь хотя бы один выполненный подход.');
   return {...value,workoutId:workout.id,notes:String(value.notes||'').slice(0,2000),exercises,deleted:false};
  }
  async mutate(action,value){return this.run(async()=>{
   if(!this.connected)throw new Error('Сначала подключи GitHub для сохранения.');
   const before={doc:clone(this.doc),pending:clone(this.pending)},index=this.doc.entries.findIndex(e=>e.id===value.id),current=this.doc.entries[index];
   if(current&&(value.version??null)!==current.version)throw new Error('Эта запись уже изменилась. Открой актуальную запись из истории; введённый черновик сохранён.');
   if(!current&&value.version!=null)throw new Error('Запись не найдена. Черновик сохранён.');
   let next;
   if(action==='save'){if(current?.deleted)throw new Error('Запись в корзине. Сначала восстанови её.');next=this.validateSession(value);}
   else{if(!current)throw new Error('Запись не найдена.');next={...current,deleted:action==='delete'};}
   next={...next,createdAt:current?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),version:(current?.version||0)+1};
   const previous=this.pending.find(o=>o.id===value.id);
   const operation={id:value.id,baseVersion:previous?previous.baseVersion:(current?.version??null),value:next,opId:this.crypto.randomUUID()};
   this.pending=this.pending.filter(o=>o.id!==value.id);this.pending.push(operation);
   if(index<0)this.doc.entries.push(next);else this.doc.entries[index]=next;
   try{this.persist();}catch(e){this.doc=before.doc;this.pending=before.pending;throw e;}
   try{await this.syncUnlocked();}catch{}
   return {saved:true,synced:!this.pending.length,pending:this.pending.length};
  });}
  async saveProgram(workoutId,items,baseExercises){return this.run(async()=>{
   if(!this.connected)throw new Error('Сначала подключи дневник к GitHub.');
   const workout=this.doc.workouts.find(w=>w.id===workoutId);if(!workout)throw new Error('Тренировка не найдена.');
   const exercises=validateExercises(items);
   if(!sameExercises(workout.exercises,baseExercises))throw new Error('Программа уже изменилась. Закрой редактор и открой его снова.');
   if(sameExercises(workout.exercises,exercises))return {saved:true,synced:!this.pendingCount};
   const before={doc:clone(this.doc),pendingPrograms:clone(this.pendingPrograms)};
   const previous=this.pendingPrograms.find(o=>o.workoutId===workoutId);
   this.pendingPrograms=this.pendingPrograms.filter(o=>o.workoutId!==workoutId);
   this.pendingPrograms.push({workoutId,baseExercises:clone(previous?.baseExercises||workout.exercises),exercises,opId:this.crypto.randomUUID()});
   applyProgram(workout,exercises);
   try{this.persist();}catch(e){this.doc=before.doc;this.pendingPrograms=before.pendingPrograms;throw e;}
   try{await this.syncUnlocked();}catch{}
   return {saved:true,synced:!this.pendingCount};
  });}
  async resolve(id,choice){return this.run(async()=>{
   if(id.startsWith('program-')){
    const remote=await this.remote(),workoutId=id.slice(8),op=this.pendingPrograms.find(o=>o.workoutId===workoutId);if(!op)return;
    if(choice==='remote')this.pendingPrograms=this.pendingPrograms.filter(o=>o.workoutId!==workoutId);
    else if(choice==='local'){const current=remote.doc.workouts.find(w=>w.id===workoutId);if(!current)throw new Error('Тренировка не найдена.');op.baseExercises=clone(current.exercises);op.opId=this.crypto.randomUUID();}
    else throw new Error('Выбери версию программы.');
    this.doc=this.replay(remote.doc,this.pending).doc;this.persist();return this.syncUnlocked();
   }
   const remote=await this.remote(),op=this.pending.find(o=>o.id===id);if(!op)return;
   if(choice==='remote')this.pending=this.pending.filter(o=>o.id!==id);
   else if(choice==='local'){const current=remote.doc.entries.find(e=>e.id===id);op.baseVersion=current?.version??null;op.opId=this.crypto.randomUUID();}
   else throw new Error('Выбери версию записи.');
   this.doc=this.replay(remote.doc,this.pending).doc;this.persist();return this.syncUnlocked();
  });}
 }
 root.TrainingGitHub={GitHubStore,encrypt,decrypt,validateDoc,bytesTo64,from64,catalog,exerciseInfo,exerciseKey};
 if(typeof module!=='undefined')module.exports=root.TrainingGitHub;
})(globalThis);

