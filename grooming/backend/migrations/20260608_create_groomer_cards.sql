IF OBJECT_ID(N'dbo.Карточки_грумеров', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Карточки_грумеров (
    Код_сотрудника UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Фото_URL NVARCHAR(MAX) NULL,
    Описание NVARCHAR(MAX) NULL,
    Специализация NVARCHAR(500) NULL,
    Сертификаты NVARCHAR(MAX) NULL,
    Стаж_с_даты DATE NULL,
    Стаж_лет INT NULL,
    Дата_обновления DATETIME2 NOT NULL CONSTRAINT DF_Карточки_грумеров_Дата DEFAULT SYSUTCDATETIME()
  );
END;
